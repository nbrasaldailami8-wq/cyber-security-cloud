import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imagekit } from "@/lib/imagekit";
import { APP_CONFIG } from "@/config";
import { scanAndReject } from "@/lib/clamav";
import { withErrorHandler } from "@/lib/errors";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const userRole = payload.role as string;

  if (userRole !== "TEACHER" && userRole !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const subjectId = formData.get("subjectId") as string;

  if (!file || !subjectId) {
    return NextResponse.json(
      { success: false, message: "الملف ومعرف المادة مطلوبان" },
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

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.level) {
    return NextResponse.json(
      { success: false, message: "المستخدم غير موجود" },
      { status: 404 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const infected = await scanAndReject(buffer, file.name, payload.sub);
  if (infected) {
    return NextResponse.json(
      { success: false, message: "الملف مصاب بفيروس! تم رفض الرفع." },
      { status: 400 },
    );
  }

  const uploadResponse = await imagekit.upload({
    file: buffer.toString("base64"),
    fileName: `${Date.now()}-${file.name}`,
    folder: `/level-${user.level}/grades`,
  });

  const gradeDistribution = await prisma.gradeDistribution.create({
    data: {
      teacherId: payload.sub,
      subjectId,
      fileUrl: uploadResponse.url,
      fileName: file.name,
      level: user.level,
      studentsCount: 0,
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم رفع توزيع الدرجات بنجاح",
    data: {
      id: gradeDistribution.id,
      fileUrl: gradeDistribution.fileUrl,
      fileName: gradeDistribution.fileName,
    },
  });
});
