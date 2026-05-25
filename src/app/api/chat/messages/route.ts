import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { MessageService } from "@/services/chat/MessageService";
import { withErrorHandler } from "@/lib/errors";
import { getEffectiveRole } from "@/lib/auth";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

const GET = withErrorHandler(async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;
  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get("userId");

  if (!otherUserId) {
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const cursor = searchParams.get("cursor");
    const result = await MessageService.getConversations(userId, limit, cursor);
    return NextResponse.json({ success: true, data: result.conversations, nextCursor: result.nextCursor });
  }

  const effective = await getEffectiveRole(userId);
  const userRole = effective.role;
  const userLevel = effective.level;

  function isSameLevel(targetUserLevel: string | null, targetUserRole?: string): boolean {
    if (userRole === "ADMIN") return true;
    if (userRole === "MANAGEMENT") {
      if (targetUserRole === "ADMIN") return true;
      if (!targetUserLevel || !userLevel) return false;
      return targetUserLevel === userLevel;
    }
    if (userRole === "TEACHER") {
      if (targetUserRole === "ADMIN") return true;
      if (targetUserRole === "MANAGEMENT") return targetUserLevel === userLevel;
      if (targetUserRole === "STUDENT") return targetUserLevel === userLevel;
      return false;
    }
    if (userRole === "STUDENT") {
      if (targetUserRole === "ADMIN") return true;
      if (targetUserRole === "MANAGEMENT") return targetUserLevel === userLevel;
      if (targetUserRole === "TEACHER") return targetUserLevel === userLevel;
      return false;
    }
    if (!targetUserLevel || !userLevel) return false;
    return targetUserLevel === userLevel;
  }

  const otherUser = await prisma.user.findUnique({
    where: { id: otherUserId, deletedAt: null },
    select: { id: true, level: true, role: true },
  });
  if (!otherUser) {
    return NextResponse.json({ success: false, message: "المستخدم غير موجود" }, { status: 404 });
  }
  if (!isSameLevel(otherUser.level, otherUser.role)) {
    return NextResponse.json({ success: false, message: "غير مصرح بالوصول لمحادثات هذا المستخدم" }, { status: 403 });
  }

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30")));
  const cursor = searchParams.get("cursor");

  await MessageService.markConversationRead(userId, otherUserId);
  const result = await MessageService.getMessages(userId, otherUserId, limit, cursor);

  return NextResponse.json({ success: true, data: result.messages, nextCursor: result.nextCursor });
});

const PATCH = withErrorHandler(async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;

  const body = await request.json();
  const { messageId, newBody } = body;

  await MessageService.editMessage(messageId, userId, newBody);

  return NextResponse.json({ success: true, message: "تم تعديل الرسالة" });
});

const DELETE = withErrorHandler(async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;

  const body = await request.json();
  const { messageId, otherUserId, action } = body;

  await MessageService.deleteMessage(messageId, userId, action, otherUserId);

  let successMessage = "تمت العملية بنجاح";
  if (action === "delete-for-everyone") successMessage = "تم حذف الرسالة للجميع";
  else if (messageId && !otherUserId) successMessage = "تم حذف الرسالة";
  else if (action === "delete-conversation") successMessage = "تم حذف المحادثة";
  else if (action === "block") successMessage = "تم حظر المستخدم";

  return NextResponse.json({ success: true, message: successMessage });
});

export { GET, PATCH, DELETE };
