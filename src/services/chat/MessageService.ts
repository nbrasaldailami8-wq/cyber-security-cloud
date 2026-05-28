import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { getEffectiveRole } from "@/lib/auth";
import crypto from "crypto";
import { getUserChannelName } from "@/lib/realtimeChannels";

const purify = DOMPurify(new JSDOM("").window as any);

export class MessageService {
  static async getConversations(
    userId: string,
    limit: number,
    cursor?: string | null,
  ) {
    const effective = await getEffectiveRole(userId);
    const userRole = effective.role;
    const userLevel = effective.level;

    // Build Prisma-level auth filter instead of in-memory filtering
    let allowedOtherUserFilter: any = {};
    if (userRole === "MANAGEMENT") {
      allowedOtherUserFilter = {
        OR: [
          { role: "ADMIN" },
          ...(userLevel ? [{ level: userLevel }] : []),
        ],
      };
    } else if (userRole === "TEACHER") {
      allowedOtherUserFilter = {
        OR: [
          { role: "ADMIN" },
          ...(userLevel ? [{ role: "MANAGEMENT", level: userLevel }, { role: "STUDENT", level: userLevel }] : []),
        ],
      };
    } else if (userRole === "STUDENT") {
      allowedOtherUserFilter = {
        OR: [
          { role: "ADMIN" },
          ...(userLevel ? [{ role: "MANAGEMENT", level: userLevel }, { role: "TEACHER", level: userLevel }] : []),
        ],
      };
    }
    // ADMIN allows all — no filter needed

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, senderDeleted: false, receiver: allowedOtherUserFilter },
          { receiverId: userId, receiverDeleted: false, sender: allowedOtherUserFilter },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      select: {
        id: true, senderId: true, receiverId: true, body: true,
        encrypted: true, isRead: true, createdAt: true,
        sender: { select: { id: true, name: true, role: true, level: true, lastSeenAt: true, lastLoginAt: true } },
        receiver: { select: { id: true, name: true, role: true, level: true, lastSeenAt: true, lastLoginAt: true } },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const conversations: any[] = [];
    const seen = new Set<string>();

    for (const msg of items) {
      const other = msg.senderId === userId ? msg.receiver : msg.sender;
      const key = other.id;
      if (!seen.has(key)) {
        seen.add(key);
        const body = msg.encrypted ? decryptMessage(msg.body) : msg.body;
        conversations.push({
          userId: other.id, name: other.name, role: other.role,
          level: other.level, lastSeenAt: other.lastSeenAt,
          lastLoginAt: other.lastLoginAt, lastMessage: body.slice(0, 50),
          createdAt: msg.createdAt, isRead: msg.isRead, isSent: msg.senderId === userId,
        });
      }
    }

    return { conversations, nextCursor };
  }

  static async getMessages(
    userId: string,
    otherUserId: string,
    limit: number,
    cursor?: string | null,
  ) {
    const messages = await prisma.message.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              { senderId: userId, receiverId: otherUserId, senderDeleted: false },
              { senderId: otherUserId, receiverId: userId, receiverDeleted: false },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      select: {
        id: true, senderId: true, receiverId: true, body: true,
        encrypted: true, isRead: true, isEdited: true, createdAt: true,
        sender: { select: { id: true, name: true } },
        replyTo: { select: { id: true, body: true, sender: { select: { id: true, name: true } } } },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const decrypted = items.map((msg) => ({
      ...msg,
      body: msg.encrypted ? decryptMessage(msg.body) : msg.body,
      replyTo: msg.replyTo
        ? { ...msg.replyTo, body: msg.replyTo.body ? (() => { try { return decryptMessage(msg.replyTo!.body); } catch { return msg.replyTo!.body; } })() : "" }
        : null,
    }));

    await prisma.message.updateMany({
      where: { receiverId: userId, senderId: otherUserId, isRead: false },
      data: { isRead: true },
    });

    return { messages: decrypted, nextCursor };
  }

  static async sendMessage(
    senderId: string,
    receiverId: string,
    body: string,
    replyToId?: string,
    idempotencyKey?: string,
  ) {
    const sanitized = purify.sanitize(body, { ALLOWED_TAGS: [] });
    const encryptedBody = encryptMessage(sanitized);

    if (!idempotencyKey) {
      idempotencyKey = `${senderId}-${Date.now()}-${crypto.randomUUID()}`;
    }

    const existing = await prisma.message.findFirst({
      where: { senderId, idempotencyKey },
    });
    if (existing) return { message: existing, isDuplicate: true };

    const message = await prisma.message.create({
      data: {
        senderId, receiverId,
        body: encryptedBody, encrypted: true,
        ...(replyToId ? { replyToId } : {}),
        idempotencyKey,
      },
    });

    prisma.user.update({ where: { id: senderId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    return { message, isDuplicate: false };
  }

  static async editMessage(messageId: string, userId: string, newBody: string) {
    if (!messageId || !newBody || !newBody.trim()) {
      throw new ValidationError("البيانات مطلوبة");
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.senderId !== userId) {
      throw new ForbiddenError("غير مصرح");
    }

    const sanitized = purify.sanitize(newBody.trim(), { ALLOWED_TAGS: [] });
    const encryptedBody = encryptMessage(sanitized);

    await prisma.message.update({
      where: { id: messageId },
      data: { body: encryptedBody, isEdited: true },
    });

    try {
      const { broadcastEvent } = await import("@/lib/supabaseRealtime");
      const senderChan = getUserChannelName(message.senderId);
      const receiverChan = getUserChannelName(message.receiverId);
      const payload = { messageId, body: sanitized, updatedAt: new Date().toISOString() };
      broadcastEvent(senderChan, "message-edited", payload);
      if (receiverChan !== senderChan) broadcastEvent(receiverChan, "message-edited", payload);
    } catch (error) {
      console.error("[MessageService] فشل بث حدث التعديل:", error);
    }
  }

  static async deleteMessage(
    messageId: string,
    userId: string,
    action?: string,
    otherUserId?: string,
  ) {
    if (messageId && !otherUserId) {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) throw new NotFoundError("الرسالة");

      if (action === "delete-for-everyone") {
        if (message.senderId !== userId) {
          throw new ForbiddenError("فقط مرسل الرسالة يمكنه حذفها للجميع");
        }
        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt: new Date() },
        });
        try {
          const { broadcastEvent } = await import("@/lib/supabaseRealtime");
          const senderChan = getUserChannelName(message.senderId);
          const receiverChan = getUserChannelName(message.receiverId);
          broadcastEvent(senderChan, "message-deleted", { messageId });
          if (receiverChan !== senderChan) broadcastEvent(receiverChan, "message-deleted", { messageId });
        } catch { /* صامت */ }
        return;
      }

      if (message.senderId === userId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { senderDeleted: true },
        });
        try {
          const { broadcastEvent } = await import("@/lib/supabaseRealtime");
          broadcastEvent(getUserChannelName(message.senderId), "message-deleted", { messageId });
        } catch (error) {
          console.error("[MessageService] فشل بث حدث الحذف (مرسل):", error);
        }
      } else if (message.receiverId === userId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { receiverDeleted: true },
        });
        try {
          const { broadcastEvent } = await import("@/lib/supabaseRealtime");
          broadcastEvent(getUserChannelName(message.receiverId), "message-deleted", { messageId });
        } catch (error) {
          console.error("[MessageService] فشل بث حدث الحذف (مستقبل):", error);
        }
      } else {
        throw new ForbiddenError("غير مصرح");
      }
      return;
    }

    if (otherUserId && action === "delete-conversation") {
      await prisma.message.updateMany({
        where: { senderId: userId, receiverId: otherUserId },
        data: { senderDeleted: true },
      });
      await prisma.message.updateMany({
        where: { receiverId: userId, senderId: otherUserId },
        data: { receiverDeleted: true },
      });
      return;
    }

    if (otherUserId && action === "block") {
      await prisma.message.updateMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        data: { isBlocked: true },
      });
      return;
    }

    throw new ValidationError("إجراء غير معروف");
  }

  static async markConversationRead(userId: string, otherUserId: string) {
    const updatedCount = await prisma.message.updateMany({
      where: { receiverId: userId, senderId: otherUserId, isRead: false },
      data: { isRead: true },
    });

    if (updatedCount.count > 0) {
      try {
        const { broadcastEvent } = await import("@/lib/supabaseRealtime");
        broadcastEvent(getUserChannelName(otherUserId), "messages-read", {
          readBy: userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[MessageService] فشل بث حدث القراءة:", error);
      }
    }

    return updatedCount.count;
  }

  static async sendMessageWithSideEffects(
    senderId: string,
    receiverId: string,
    body: string,
    replyToId?: string,
    idempotencyKey?: string,
    ip?: string,
  ) {
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId } }),
      prisma.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!sender || !receiver) throw new NotFoundError("المستخدم");

    const isBlocked = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: receiverId, receiverId: senderId, isBlocked: true },
          { senderId: senderId, receiverId: receiverId, isBlocked: true },
        ],
      },
    });
    if (isBlocked) throw new ForbiddenError("لا يمكنك مراسلة هذا المستخدم");

    const { message, isDuplicate } = await this.sendMessage(
      senderId, receiverId, body, replyToId, idempotencyKey,
    );

    if (isDuplicate) return { message, isDuplicate };

    prisma.user.update({ where: { id: senderId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    try {
      const { isUserOnline, broadcastEvent } = await import("@/lib/supabaseRealtime");

      const isInChatWithSender = isUserOnline(receiverId);

      (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma.notification.create({
              data: {
                userId: receiverId,
                type: "NEW_MESSAGE",
                title: "رسالة جديدة",
                body: `رسالة جديدة من ${sender.name}`,
                linkUrl: "/chat",
              },
            });
            return;
          } catch (err) {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000));
            } else {
              console.error("[MessageService] فشل إنشاء إشعار بعد 3 محاولات:", err);
            }
          }
        }
      })();

      const receiverChan = getUserChannelName(receiverId);
      const senderChan = getUserChannelName(senderId);

      broadcastEvent(receiverChan, "new-message", {
        id: message.id, senderId, receiverId,
        createdAt: message.createdAt.toISOString(),
        type: "new-message",
      });

      broadcastEvent(senderChan, "new-message", {
        id: message.id, senderId, receiverId,
        createdAt: message.createdAt.toISOString(),
        type: "new-message",
      });

      if (!isInChatWithSender) {
        broadcastEvent(receiverChan, "notification", {
          id: message.id, type: "NEW_MESSAGE",
          title: "رسالة جديدة", body: `رسالة جديدة من ${sender.name}`, linkUrl: "/chat",
        });

        import("@/lib/pushNotifications")
          .then(({ sendPushToUsers }) => {
            sendPushToUsers([receiverId], {
              title: "💬 رسالة جديدة",
              body: `رسالة جديدة من ${sender.name}`,
              data: { url: "/chat" },
              sound: "/sounds/notification.mp3",
            }).catch((err) => {
              console.error("[MessageService] فشل إرسال Push Notification:", err);
            });
          })
          .catch((err) => {
            console.error("[MessageService] فشل تحميل pushNotifications:", err);
          });
      }
    } catch (error) {
      console.error("[MessageService] فشل في إرسال الآثار الجانبية للرسالة:", error);
    }

    return { message, isDuplicate };
  }
}
