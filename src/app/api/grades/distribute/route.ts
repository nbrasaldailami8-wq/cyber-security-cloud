import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const { gradeDistributionId } = await request.json();

  if (!gradeDistributionId) {
    return NextResponse.json(
      { success: false, message: "معرف توزيع الدرجات مطلوب" },
      { status: 400 },
    );
  }

  const distribution = await prisma.gradeDistribution.findUnique({
    where: { id: gradeDistributionId },
    include: { subject: { select: { name: true } } },
  });

  if (!distribution) {
    return NextResponse.json(
      { success: false, message: "توزيع الدرجات غير موجود" },
      { status: 404 },
    );
  }

  if (distribution.teacherId !== payload.sub && userRole !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "غير مصرح بتوزيع هذه الدرجات" },
      { status: 403 },
    );
  }

  await prisma.gradeDistribution.update({
    where: { id: gradeDistributionId },
    data: {
      distributionData: { distributedAt: new Date().toISOString() },
    },
  });

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      level: distribution.level,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (students.length > 0) {
    await prisma.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        type: "GRADES_DISTRIBUTED",
        title: "توزيع درجات",
        body: `تم توزيع درجات مادة ${distribution.subject.name}`,
        linkUrl: "/student/grades",
      })),
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: payload.sub,
      action: "PUBLISH",
      severity: "INFO",
      description: `توزيع درجات مادة ${distribution.subject.name}`,
      level: distribution.level,
      metadata: { gradeDistributionId, subjectId: distribution.subjectId },
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم توزيع الدرجات وإرسال الإشعارات بنجاح",
  });
});
