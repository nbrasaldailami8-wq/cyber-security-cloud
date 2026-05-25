import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { imagekit } from "@/lib/imagekit";
import { APP_CONFIG } from "@/config";
import { scanAndReject } from "@/lib/clamav";
import { broadcastEvent } from "@/lib/supabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";
import { sendPushToUsers } from "@/lib/pushNotifications";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".js",
  ".apk",
  ".zip",
  ".rar",
  ".msi",
  ".cmd",
  ".ps1",
  ".vbs",
  ".scr",
];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
];

function getContentTypeFromMime(mimeType: string, fileName: string): string {
  const mimeMap: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/jpg": "JPG",
    "audio/mpeg": "MP3",
    "audio/wav": "WAV",
    "audio/mp3": "MP3",
  };

  if (mimeMap[mimeType]) return mimeMap[mimeType];

  const ext = fileName.split(".").pop()?.toUpperCase();
  const extMap: Record<string, string> = {
    PDF: "PDF",
    DOCX: "DOCX",
    XLSX: "XLSX",
    PNG: "PNG",
    JPG: "JPG",
    JPEG: "JPG",
    MP3: "MP3",
    WAV: "WAV",
  };
  return extMap[ext || ""] || "PDF";
}

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

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const uploadType = formData.get("uploadType") as string; // "material" | "general"
    const subjectId = formData.get("subjectId") as string;
    const youtubeUrl = formData.get("youtubeUrl") as string;
    const file = formData.get("file") as File | null;
    const targetLevel = formData.get("targetLevel") as string;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, message: "عنوان المنشور مطلوب" },
        { status: 400 },
      );
    }

    // التحقق من صلاحية النشر
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { uploadPermissions: { where: { revokedAt: null } } },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "المستخدم غير موجود" },
        { status: 404 },
      );
    }

    const hasPermission =
      userRole === "ADMIN" ||
      userRole === "MANAGEMENT" ||
      userRole === "TEACHER" ||
      (user.uploadPermissions && user.uploadPermissions.length > 0);

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "ليس لديك صلاحية النشر في المكتبة" },
        { status: 403 },
      );
    }

    let contentUrl: string | null = null;
    let contentYoutubeUrl: string | null = null;
    const effectiveLevel =
      userRole === "ADMIN" && targetLevel ? targetLevel : userLevel;
    let contentFileSize: number | null = null;
    let contentType = "YOUTUBE_LINK";

    // حالة: رابط يوتيوب
    if (youtubeUrl && youtubeUrl.trim()) {
      contentYoutubeUrl = youtubeUrl.trim();
      contentType = "YOUTUBE_LINK";
    }

    // حالة: ملف مرفوع
    if (file && file.size > 0) {
      // التحقق من الحجم
      if (file.size > APP_CONFIG.maxFileSize) {
        return NextResponse.json(
          { success: false, message: "حجم الملف كبير جداً (الحد الأقصى 20MB)" },
          { status: 400 },
        );
      }

      // التحقق من الامتداد
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { success: false, message: `نوع الملف (${ext}) غير مسموح به أبداً` },
          { status: 400 },
        );
      }

      // التحقق من MIME Type
      if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
        return NextResponse.json(
          { success: false, message: `نوع الملف (${file.type}) غير مسموح به` },
          { status: 400 },
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // فحص الفيروسات
      const infected = await scanAndReject(buffer, file.name, userId);
      if (infected) {
        return NextResponse.json(
          {
            success: false,
            message: "⚠️ تم اكتشاف فيروس في الملف! تم رفض الرفع.",
          },
          { status: 400 },
        );
      }

      // تحديد نوع المحتوى
      contentType = getContentTypeFromMime(file.type, file.name);

      // رفع إلى ImageKit
      const folderPath = `/library/level-${effectiveLevel.replace("LEVEL_", "")}/${contentType}`;
      const uploadResponse = await imagekit.upload({
        file: buffer.toString("base64"),
        fileName: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\u0621-\u064A_-]/g, "_")}`,
        folder: folderPath,
        useUniqueFileName: true,
      });

      contentUrl = uploadResponse.url;
      contentFileSize = file.size;
    }

    // يجب أن يكون هناك على الأقل ملف أو رابط يوتيوب
    if (!contentUrl && !contentYoutubeUrl) {
      return NextResponse.json(
        { success: false, message: "يجب إرفاق ملف أو إدخال رابط يوتيوب" },
        { status: 400 },
      );
    }

    // حفظ في قاعدة البيانات
    const content = await prisma.content.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type: contentType as any,
        fileUrl: contentUrl,
        youtubeUrl: contentYoutubeUrl,
        fileSize: contentFileSize,
        level: (effectiveLevel || "LEVEL_1") as any,
        semester: "TERM_1",
        publisherId: userId,
        subjectId: subjectId || undefined,
      },
      include: {
        publisher: { select: { id: true, name: true, role: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    // إرسال إشعار عبر Supabase للمستوى
    try {
      broadcastEvent(deriveStaticChannelName(`library-level-${effectiveLevel}`), "new-content", {
        id: content.id,
        title: content.title,
        type: content.type,
        fileUrl: content.fileUrl,
        youtubeUrl: content.youtubeUrl,
        publisherName: user.name,
        createdAt: content.createdAt.toISOString(),
      });
    } catch {
      // فشل الإشعار لا يمنع النشر
    }

    // إنشاء إشعارات للمستخدمين في نفس المستوى
    try {
      const usersInLevel = await prisma.user.findMany({
        where: {
          level: effectiveLevel as any,
          deletedAt: null,
          isActivated: true,
        },
        select: { id: true },
      });

      if (usersInLevel.length > 0) {
        // إشعارات قاعدة البيانات
        const notifications = usersInLevel.map((u) => ({
          userId: u.id,
          type: "NEW_CONTENT" as any,
          title: "📚 محتوى جديد في المكتبة",
          body: `${user.name} نشر: ${content.title}`,
          linkUrl: "/library",
        }));
        await prisma.notification.createMany({ data: notifications });

        // إرسال Push Notifications لكل المستخدمين في المستوى
        await sendPushToUsers(
          usersInLevel.map((u) => u.id),
          {
            title: "📚 محتوى جديد في المكتبة",
            body: `${user.name} نشر: ${content.title}`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-96x96.png",
            data: { url: "/library" },
            sound: "/sounds/alert.mp3",
            requireInteraction: true,
          },
        );
      }
    } catch {
      // الإشعارات لا تمنع النشر
    }

    return NextResponse.json({
      success: true,
      message: "تم نشر المحتوى بنجاح 🚀",
      data: content,
    });
  });
