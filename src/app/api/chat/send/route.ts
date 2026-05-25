import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { MessageService } from "@/services/chat/MessageService";
import { withErrorHandler } from "@/lib/errors";
import { messageRateLimiter } from "@/lib/ratelimit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

const messageSchema = z.object({
  receiverId: z.string().min(1, "المستقبل مطلوب"),
  body: z.string().min(1, "الرسالة فارغة").max(2000, "الرسالة طويلة جداً"),
  replyToId: z.string().optional(),
  idempotencyKey: z.string().min(1).max(64).optional(),
});

const POST = withErrorHandler(async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const senderId = payload.sub as string;
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  const { success: rateLimitOk } = await messageRateLimiter.limit(`${ip}_${senderId}`);
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, message: "رسائل كثيرة. انتظر قليلاً." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const validation = messageSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { receiverId, body: messageBody, replyToId, idempotencyKey } = validation.data;

  // Academic isolation check
  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId } }),
    prisma.user.findUnique({ where: { id: receiverId } }),
  ]);

  if (!sender || !receiver) {
    return NextResponse.json(
      { success: false, message: "المستخدم غير موجود" },
      { status: 404 },
    );
  }

  const isAdmin = sender.role === "ADMIN";
  if (!isAdmin) {
    if (sender.role === "MANAGEMENT") {
      if (receiver.role === "TEACHER" || receiver.role === "STUDENT") {
        if (receiver.level !== sender.level) {
          return NextResponse.json(
            { success: false, message: "لا يمكنك مراسلة مستخدمين من مستوى آخر" },
            { status: 403 },
          );
        }
      }
    } else if (sender.role === "TEACHER") {
      if (receiver.role === "TEACHER") {
        return NextResponse.json(
          { success: false, message: "لا يمكنك مراسلة معلم آخر" },
          { status: 403 },
        );
      }
      if (receiver.role === "STUDENT" || receiver.role === "MANAGEMENT") {
        if (receiver.level !== sender.level) {
          return NextResponse.json(
            { success: false, message: "لا يمكنك مراسلة مستخدمين من مستوى آخر" },
            { status: 403 },
          );
        }
      }
    } else if (sender.role === "STUDENT") {
      if (receiver.role === "STUDENT") {
        return NextResponse.json(
          { success: false, message: "لا يمكنك مراسلة طالب آخر" },
          { status: 403 },
        );
      }
      if (receiver.role === "TEACHER" || receiver.role === "MANAGEMENT") {
        if (receiver.level !== sender.level) {
          return NextResponse.json(
            { success: false, message: "لا يمكنك مراسلة معلمين من مستوى آخر" },
            { status: 403 },
          );
        }
      }
    }
  }

  const result = await MessageService.sendMessageWithSideEffects(
    senderId, receiverId, messageBody, replyToId, idempotencyKey, ip,
  );

  return NextResponse.json({
    success: true,
    message: "تم إرسال الرسالة",
    data: result.message,
  });
});

export { POST };
