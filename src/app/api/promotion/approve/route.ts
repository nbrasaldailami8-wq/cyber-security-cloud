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

  if (payload.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 403 },
    );
  }

  const { requestIds, action } = await request.json();

  if (!requestIds?.length || !action) {
    return NextResponse.json(
      { success: false, message: "البيانات المدخلة غير كاملة" },
      { status: 400 },
    );
  }

  if (!["APPROVED", "REJECTED"].includes(action)) {
    return NextResponse.json(
      { success: false, message: "الإجراء غير صالح" },
      { status: 400 },
    );
  }

  const requests = await prisma.promotionRequest.findMany({
    where: { id: { in: requestIds }, status: "PENDING" },
  });

  if (requests.length === 0) {
    return NextResponse.json(
      { success: false, message: "لا توجد طلبات معلقة" },
      { status: 400 },
    );
  }

  await prisma.promotionRequest.updateMany({
    where: { id: { in: requestIds } },
    data: {
      status: action as any,
      approvedBy: action === "APPROVED" ? (payload.sub as string) : undefined,
      approvedAt: action === "APPROVED" ? new Date() : undefined,
    },
  });

  if (action === "APPROVED") {
    for (const req of requests) {
      await prisma.user.update({
        where: { id: req.userId },
        data: { level: req.toLevel, tokenVersion: { increment: 1 } },
      });

      await prisma.notification.create({
        data: {
          userId: req.userId,
          type: "LEVEL_PROMOTED",
          title: "تمت الترقية",
          body: `تم ترقيتك من المستوى ${req.fromLevel} إلى ${req.toLevel}`,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: payload.sub as string,
          action: "LEVEL_PROMOTION",
          severity: "INFO",
          description: `تمت ترقية المستخدم ${req.userId} من ${req.fromLevel} إلى ${req.toLevel}`,
          level: req.toLevel,
          metadata: { requestId: req.id, userId: req.userId, fromLevel: req.fromLevel, toLevel: req.toLevel },
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: action === "APPROVED" ? "تمت الموافقة على الطلبات" : "تم رفض الطلبات",
    count: requests.length,
  });
});
