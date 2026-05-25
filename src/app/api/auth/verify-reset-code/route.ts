import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findResetToken } from "@/lib/passwordReset";
import { verifyResetRateLimiter } from "@/lib/ratelimit";
import { z } from "zod";
import { withErrorHandler } from "@/lib/errors";

const GENERIC_RESPONSE = {
  success: true as const,
  status: "success" as const,
  message: "تم التحقق من الكود",
};

const verifySchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  code: z.string().min(6, "كود التحقق غير صحيح"),
});

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = verifySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { code } = validation.data;
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  const { success: rateLimitOk } = await verifyResetRateLimiter.limit(ip);
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, message: "محاولات كثيرة. حاول لاحقاً." },
      { status: 429 },
    );
  }

  const record = await findResetToken(code);

  if (record) {
    await prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: "UPDATE",
        severity: "INFO",
        description: "تم التحقق من كود إعادة تعيين كلمة المرور",
        ipAddress: ip,
      },
    });
  } else {
    await prisma.auditLog.create({
      data: {
        action: "FAILED_LOGIN",
        severity: "WARNING",
        description: "محاولة التحقق من كود إعادة تعيين كلمة مرور غير صالح",
        ipAddress: ip,
      },
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
});
