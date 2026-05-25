import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { broadcastEvent } from "@/lib/supabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";
import { sendPushToUsers } from "@/lib/pushNotifications";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

// ==================== POST: نشر تعميم ====================
export const POST = withErrorHandler(async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken)
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user)
      return NextResponse.json(
        { success: false, message: "المستخدم غير موجود" },
        { status: 404 },
      );
    const hasUploadPerm = await prisma.uploadPermission.findFirst({
      where: { userId, revokedAt: null },
    });
    const hasManagementLevel = !!user.managementLevel;
    if (
      !["ADMIN", "MANAGEMENT", "TEACHER"].includes(user.role) &&
      !hasUploadPerm &&
      !hasManagementLevel
    )
      return NextResponse.json(
        { success: false, message: "ليس لديك صلاحية النشر" },
        { status: 403 },
      );

    const { title, description, level } = await request.json();
    if (!title || !description)
      return NextResponse.json(
        { success: false, message: "العنوان والوصف مطلوبان" },
        { status: 400 },
      );

    const targetLevel =
      user.role === "ADMIN" ? level || user.level : user.level;
    if (!targetLevel)
      return NextResponse.json(
        { success: false, message: "المستوى غير محدد" },
        { status: 400 },
      );

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        level: targetLevel,
        publisherId: userId,
      },
    });

    const usersInLevel = await prisma.user.findMany({
      where: { level: targetLevel as any, deletedAt: null, isActivated: true },
      select: { id: true },
    });

    if (usersInLevel.length > 0) {
      await prisma.notification.createMany({
        data: usersInLevel.map((u) => ({
          userId: u.id,
          type: "NEW_ANNOUNCEMENT",
          title: "📢 تعميم جديد",
          body: title.trim(),
          linkUrl: "/announcements/create?tab=history",
        })),
      });

      // إشعارات خارجية
      try {
        await sendPushToUsers(
          usersInLevel.map((u) => u.id),
          {
            title: "📢 تعميم جديد",
            body: title.trim(),
            data: { url: "/announcements/create" },
            sound: "/sounds/alert.mp3",
            requireInteraction: true,
          },
        );
      } catch {
        /* صامت */
      }

      // إشعار لحظي لجميع مستخدمي المستوى دفعة واحدة
      broadcastEvent(deriveStaticChannelName(`level-${targetLevel}`), "new-announcement", {
        type: "NEW_ANNOUNCEMENT",
        title: "📢 تعميم جديد",
        body: title.trim(),
        linkUrl: "/announcements/create?tab=history",
        level: targetLevel,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "PUBLISH",
        severity: "INFO",
        description: `نشر تعميم: ${title.trim()}`,
        level: targetLevel as any,
        metadata: { announcementId: announcement.id },
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم نشر التعميم بنجاح",
    });
  });

// ==================== GET: جلب التعميمات ====================
export const GET = withErrorHandler(async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken)
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;
    const userRole = payload.role as string;
    const userLevel = payload.level as string;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10")),
    );

    const where: any = { deletedAt: null };

    if (userRole === "ADMIN") {
      if (searchParams.get("level")) {
        where.level = searchParams.get("level");
      }
    } else if (userRole === "TEACHER") {
      // المعلم يرى تعاميمه + تعاميم مستواه
      where.OR = [
        { publisherId: userId },
        { level: userLevel },
      ];
    } else if (userRole === "MANAGEMENT") {
      // الإدارة ترى تعاميم مستواها
      where.level = userLevel;
    } else {
      // الطالب يرى تعاميم مستواه فقط
      where.level = userLevel;
    }

    const [data, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          publisher: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  });

// ==================== PATCH: تعديل تعميم ====================
export const PATCH = withErrorHandler(async function PATCH(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken)
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;
    const userRole = payload.role as string;

    const { id, title, description } = await request.json();
    if (!id || !title)
      return NextResponse.json(
        { success: false, message: "البيانات مطلوبة" },
        { status: 400 },
      );

    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann)
      return NextResponse.json(
        { success: false, message: "التعميم غير موجود" },
        { status: 404 },
      );
    if (ann.publisherId !== userId && userRole !== "ADMIN")
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 },
      );

    await prisma.announcement.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || ann.description,
      },
    });

    return NextResponse.json({ success: true, message: "تم تعديل التعميم" });
  });

// ==================== DELETE: حذف تعميم ====================
export const DELETE = withErrorHandler(async function DELETE(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken)
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;
    const userRole = payload.role as string;

    const { id } = await request.json();
    if (!id)
      return NextResponse.json(
        { success: false, message: "المعرف مطلوب" },
        { status: 400 },
      );

    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann)
      return NextResponse.json(
        { success: false, message: "التعميم غير موجود" },
        { status: 404 },
      );
    if (ann.publisherId !== userId && userRole !== "ADMIN")
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 },
      );

    await prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "تم حذف التعميم" });
  });
