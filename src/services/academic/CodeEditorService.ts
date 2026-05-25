import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { JWTPayload } from "@/lib/types";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

export class CodeEditorService {
  static async shareCode(
    userId: string,
    payload: JWTPayload,
    data: {
      fileUrl: string;
      fileName: string;
      language?: string;
      title?: string;
      authorName?: string;
      showAuthor?: boolean;
      level?: string;
      note?: string;
    },
  ) {
    const {
      fileUrl,
      fileName,
      language,
      title,
      authorName,
      showAuthor,
      level,
      note,
    } = data;

    if (!fileUrl || !fileName) {
      throw new ValidationError("البيانات غير مكتملة");
    }

    const shareId = `shared_${Date.now()}_${userId.slice(0, 8)}`;
    const shareData = {
      id: shareId,
      fileUrl,
      title: title || fileName,
      fileName,
      language: language || "txt",
      authorName: authorName || payload.email || "مستخدم",
      authorId: userId,
      showAuthor: showAuthor !== false,
      note: note || "",
      level: level || (payload as any).level || "LEVEL_1",
      createdAt: new Date().toISOString(),
    };

    const existingShares = await prisma.systemConfig.findFirst({
      where: { key: "code_editor_shares" },
    });

    let shares: any[] = [];
    if (existingShares) {
      try {
        shares = JSON.parse(existingShares.value);
      } catch {
        /* صامت */
      }
    }
    shares.unshift(shareData);
    if (shares.length > 200) shares = shares.slice(0, 200);

    await prisma.systemConfig.upsert({
      where: { key: "code_editor_shares" },
      update: { value: JSON.stringify(shares) },
      create: { key: "code_editor_shares", value: JSON.stringify(shares) },
    });

    try {
      const { broadcastEvent } = await import("@/lib/supabaseRealtime");
      broadcastEvent(deriveStaticChannelName("code-editor"), "file-shared", {
        fileName,
        level: level || (payload as any).level,
        authorName: showAuthor !== false ? payload.email : "مجهول",
      });
    } catch {
      /* صامت */
    }

    const usersInLevel = await prisma.user.findMany({
      where: {
        level: (level || (payload as any).level) as any,
        deletedAt: null,
        isActivated: true,
      },
      select: { id: true },
    });

    const notificationsData = usersInLevel
      .filter((u) => u.id !== userId)
      .map((u) => ({
        userId: u.id,
        type: "NEW_CONTENT" as const,
        title: "📢 ملف مشترك جديد",
        body: `تمت مشاركة ملف "${fileName}" في محرر الأكواد`,
        linkUrl: "/code-editor/shared",
      }));

    if (notificationsData.length > 0) {
      await prisma.notification.createMany({ data: notificationsData });
    }

    const userIds = usersInLevel.filter((u) => u.id !== userId).map((u) => u.id);
    if (userIds.length > 0) {
      try {
        const { sendPushToUsers } = await import("@/lib/pushNotifications");
        await sendPushToUsers(userIds, {
          title: "📢 ملف مشترك جديد",
          body: `تمت مشاركة ملف "${fileName}" في محرر الأكواد`,
          data: { url: "/code-editor/shared" },
          sound: "/sounds/alert.mp3",
          requireInteraction: true,
        });
      } catch {
        /* صامت */
      }
    }
  }

  static async getSharedCode(shareId: string) {
    const existingShares = await prisma.systemConfig.findFirst({
      where: { key: "code_editor_shares" },
    });

    if (!existingShares) throw new NotFoundError("الملف المشترك");

    let shares: any[] = [];
    try {
      shares = JSON.parse(existingShares.value);
    } catch {
      throw new NotFoundError("الملف المشترك");
    }

    const share = shares.find((s: any) => s.id === shareId);
    if (!share) throw new NotFoundError("الملف المشترك");

    return share;
  }

  static async listSharedCode(
    userId: string,
    query: { level?: string; page?: number; limit?: number },
  ) {
    const effective = await getEffectiveRole(userId);
    const effectiveRole = effective.role;
    const userLevel = effective.level || "LEVEL_1";

    const level = effectiveRole === "ADMIN" ? query.level || userLevel : userLevel;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const existingShares = await prisma.systemConfig.findFirst({
      where: { key: "code_editor_shares" },
    });

    let shares: any[] = [];
    if (existingShares) {
      try {
        shares = JSON.parse(existingShares.value);
      } catch {
        /* صامت */
      }
    }

    const filtered = shares.filter((s: any) => s.level === level);
    const total = filtered.length;
    const paginatedData = filtered.slice((page - 1) * limit, page * limit);

    return { data: paginatedData, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async deleteSharedCode(userId: string, id: string) {
    if (!id) throw new ValidationError("معرف الملف مطلوب");

    const effective = await getEffectiveRole(userId);
    const effectiveRole = effective.role;

    if (effectiveRole !== "ADMIN" && effectiveRole !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const existingShares = await prisma.systemConfig.findFirst({
      where: { key: "code_editor_shares" },
    });

    if (existingShares) {
      let shares = JSON.parse(existingShares.value);
      shares = shares.filter((s: any) => s.id !== id);
      await prisma.systemConfig.update({
        where: { key: "code_editor_shares" },
        data: { value: JSON.stringify(shares) },
      });
    }
  }

  static async updateSharedCodeVisibility(userId: string, id: string, showAuthor: boolean) {
    const effective = await getEffectiveRole(userId);
    const effectiveRole = effective.role;
    if (effectiveRole !== "ADMIN" && effectiveRole !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const existingShares = await prisma.systemConfig.findFirst({
      where: { key: "code_editor_shares" },
    });

    if (existingShares) {
      let shares = JSON.parse(existingShares.value);
      shares = shares.map((s: any) => {
        if (s.id === id) return { ...s, showAuthor };
        return s;
      });

      await prisma.systemConfig.update({
        where: { key: "code_editor_shares" },
        data: { value: JSON.stringify(shares) },
      });
    }
  }

  static async deleteMyFile(userId: string, fileId: string) {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
    const auth = Buffer.from(`${privateKey}:`).toString("base64");

    // 1. Fetch file metadata from ImageKit to verify ownership
    const detailRes = await fetch(
      `https://api.imagekit.io/v1/files/${fileId}/details`,
      { headers: { Authorization: `Basic ${auth}` } },
    );

    if (!detailRes.ok) {
      throw new NotFoundError("الملف غير موجود");
    }

    const fileDetail = await detailRes.json();
    const filePath: string = fileDetail.filePath || fileDetail.url || "";

    // 2. Verify the file path contains the authenticated user's ID
    //    Files are uploaded to: /code-editor/{level}/{userId}/{fileName}
    if (!filePath.includes(`/${userId}/`)) {
      throw new ForbiddenError("غير مصرح بحذف هذا الملف");
    }

    // 3. Ownership verified — proceed with deletion
    const deleteRes = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!deleteRes.ok) throw new ValidationError("فشل حذف الملف");
  }
}
