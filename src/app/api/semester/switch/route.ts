import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");

  if (!level || !["LEVEL_1", "LEVEL_2"].includes(level)) {
    return NextResponse.json(
      { success: false, message: "المستوى غير صالح" },
      { status: 400 },
    );
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: `current_semester_${level}` },
  });

  return NextResponse.json({
    success: true,
    data: { level, semester: config?.value || "TERM_1" },
  });
});

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

  if (payload.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 403 },
    );
  }

  const { level, semester } = await request.json();

  if (!level || !semester) {
    return NextResponse.json(
      { success: false, message: "البيانات المدخلة غير كاملة" },
      { status: 400 },
    );
  }

  if (!["LEVEL_1", "LEVEL_2"].includes(level)) {
    return NextResponse.json(
      { success: false, message: "المستوى غير صالح" },
      { status: 400 },
    );
  }

  if (!["TERM_1", "TERM_2"].includes(semester)) {
    return NextResponse.json(
      { success: false, message: "الترم غير صالح" },
      { status: 400 },
    );
  }

  await prisma.subject.updateMany({
    where: { level: level as any },
    data: { isActive: false },
  });

  await prisma.systemConfig.upsert({
    where: { key: `current_semester_${level}` },
    update: { value: semester },
    create: { key: `current_semester_${level}`, value: semester },
  });

  await prisma.auditLog.create({
    data: {
      userId: payload.sub as string,
      action: "SEMESTER_SWITCH",
      severity: "INFO",
      description: `تم تبديل الترم للمستوى ${level} إلى ${semester}`,
      level: level as any,
      metadata: { level, semester },
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم تبديل الترم بنجاح",
    data: { level, semester },
  });
});
