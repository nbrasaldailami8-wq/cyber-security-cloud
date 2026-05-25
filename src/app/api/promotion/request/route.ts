import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken, getEffectiveRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  await verifyAccessToken(accessToken);

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");

  if (!level) {
    return NextResponse.json(
      { success: false, message: "المستوى مطلوب" },
      { status: 400 },
    );
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: `current_semester_${level}` },
  });

  return NextResponse.json({
    success: true,
    data: { semester: config?.value || "TERM_1" },
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

  const effective = await getEffectiveRole(payload.sub);
  if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 403 },
    );
  }

  const { studentIds, fromLevel, toLevel } = await request.json();

  if (!studentIds?.length || !fromLevel || !toLevel) {
    return NextResponse.json(
      { success: false, message: "البيانات المدخلة غير كاملة" },
      { status: 400 },
    );
  }

  if (!["LEVEL_1", "LEVEL_2"].includes(fromLevel) || !["LEVEL_1", "LEVEL_2"].includes(toLevel)) {
    return NextResponse.json(
      { success: false, message: "المستوى غير صالح" },
      { status: 400 },
    );
  }

  const userLevel = effective.level as string | undefined;
  if (effective.role === "MANAGEMENT" && userLevel && fromLevel !== userLevel) {
    return NextResponse.json(
      { success: false, message: "لا يمكنك إنشاء طلبات ترقية لمستوى آخر" },
      { status: 403 },
    );
  }

  const students = await prisma.user.findMany({
    where: {
      id: { in: studentIds },
      role: "STUDENT",
      level: fromLevel as any,
      deletedAt: null,
    },
  });

  if (students.length !== studentIds.length) {
    return NextResponse.json(
      { success: false, message: "بعض الطلاب غير موجودين أو غير صالحين للترقية" },
      { status: 400 },
    );
  }

  await prisma.promotionRequest.createMany({
    data: students.map((s) => ({
      userId: s.id,
      fromLevel: fromLevel as any,
      toLevel: toLevel as any,
    })),
  });

  return NextResponse.json({
    success: true,
    message: "تم إرسال طلبات الترقية",
    count: students.length,
  });
});
