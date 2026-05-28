import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { imagekit } from "@/lib/imagekit";
import { APP_CONFIG } from "@/config";
import { broadcastEvent } from "@/lib/supabaseRealtime";
import { getUserChannelName } from "@/lib/realtimeChannels";
import { scanAndReject } from "@/lib/clamav";
import { withErrorHandler } from "@/lib/errors";
import { sendPushToUsers } from "@/lib/pushNotifications";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;
    const userRole = payload.role as string;
    const userLevel = payload.level as string;

    if (userRole !== "STUDENT") {
      return NextResponse.json(
        { success: false, message: "يجب أن تكون طالباً لرفع تكليف" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const subjectId = formData.get("subjectId") as string;

    if (!file || !subjectId) {
      return NextResponse.json(
        { success: false, message: "الملف والموضوع مطلوبان" },
        { status: 400 },
      );
    }

    if (file.size > APP_CONFIG.maxFileSize) {
      return NextResponse.json(
        { success: false, message: "حجم الملف كبير جداً (الحد 20MB)" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (APP_CONFIG.blockedFileExtensions.includes(`.${ext}`)) {
      return NextResponse.json(
        { success: false, message: "نوع الملف غير مسموح به" },
        { status: 400 },
      );
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المادة غير موجودة" },
        { status: 404 },
      );
    }

    if (subject.level !== userLevel) {
      return NextResponse.json(
        { success: false, message: "المادة غير متاحة لمستواك" },
        { status: 403 },
      );
    }

    if (!subject.isActive) {
      return NextResponse.json(
        { success: false, message: "المادة غير نشطة حالياً" },
        { status: 403 },
      );
    }

    const existing = await prisma.assignment.findFirst({
      where: {
        studentId: userId,
        subjectId,
        fileName: file.name,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "لقد رفعت هذا الملف من قبل لهذه المادة" },
        { status: 409 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const infected = await scanAndReject(buffer, file.name, userId);
    if (infected) {
      return NextResponse.json(
        { success: false, message: "الملف مصاب بفيروس! تم رفض الرفع." },
        { status: 400 },
      );
    }

    // اسم آمن للمجلد
    const safeSubjectName =
      subject.name.replace(/\s+/g, "-").replace(/[^\w\-\u0621-\u064A]/g, "") ||
      subject.code;
    const folder = `/level-${userLevel.replace("LEVEL_", "")}/assignments/${safeSubjectName}`;

    const uploadResponse = await imagekit.upload({
      file: buffer.toString("base64"),
      fileName: `${Date.now()}-${file.name}`,
      folder,
    });

    const assignment = await prisma.assignment.create({
      data: {
        studentId: userId,
        subjectId,
        fileUrl: uploadResponse.url,
        fileName: file.name,
        fileSize: file.size,
        status: "pending",
        semester: subject.semester,
      },
    });

    if (subject.teacherId) {
      const notif = await prisma.notification.create({
        data: {
          userId: subject.teacherId,
          type: "NEW_ASSIGNMENT",
          title: "تكليف جديد",
          body: `تم استلام تكليف جديد في مادة ${subject.name}`,
          linkUrl: "/teacher/assignments",
        },
      });

      broadcastEvent(getUserChannelName(subject.teacherId), "notification", {
        id: notif.id,
        type: "NEW_ASSIGNMENT",
        title: "تكليف جديد",
        body: `تم استلام تكليف جديد في مادة ${subject.name}`,
        linkUrl: "/teacher/assignments",
      });

      sendPushToUsers([subject.teacherId], {
        title: "تكليف جديد",
        body: `تم استلام تكليف جديد في مادة ${subject.name}`,
        data: { type: "assignment" },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPLOAD",
        severity: "INFO",
        description: `رفع تكليف: ${file.name} - مادة ${subject.name}`,
        level: userLevel as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم رفع التكليف بنجاح",
      data: assignment,
    });
  });
