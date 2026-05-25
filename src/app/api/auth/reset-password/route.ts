import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryConsumeResetToken } from "@/lib/passwordReset";
import { hashToken } from "@/lib/passwordReset";
import bcrypt from "bcryptjs";
import { revokeAllSessions } from "@/lib/auth";
import { resetPasswordRateLimiter } from "@/lib/ratelimit";
import { z } from "zod";
import { withErrorHandler } from "@/lib/errors";

const resetSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  code: z.string().min(6, "كود التحقق غير صحيح"),
  newPassword: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = resetSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email: rawEmail, code, newPassword } = validation.data;
  const email = rawEmail.trim().toLowerCase();
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  const { success: rateLimitOk } = await resetPasswordRateLimiter.limit(`${email}:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, message: "محاولات كثيرة. حاول لاحقاً." },
      { status: 429 },
    );
  }

  const consumed = await tryConsumeResetToken(code, email);
  if (!consumed) {
    const codeHash = hashToken(code.toUpperCase());
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: codeHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: tokenRecord?.userId || null,
        action: "FAILED_LOGIN",
        severity: "WARNING",
        description: tokenRecord?.usedAt
          ? "محاولة إعادة استخدام كود إعادة تعيين كلمة المرور"
          : "كود إعادة تعيين كلمة المرور غير صالح أو منتهي",
        ipAddress: ip,
      },
    });

    return NextResponse.json(
      { success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    select: { id: true, level: true, twoFactorEnabled: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, message: "حدث خطأ. الرجاء المحاولة مرة أخرى." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      status: "ACTIVE",
      lockedUntil: null,
      tokenVersion: { increment: 1 },
    },
  });

  await revokeAllSessions(user.id);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      severity: "WARNING",
      description: "تم تغيير كلمة المرور بنجاح",
      ipAddress: ip,
      level: user.level,
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
  });
});
