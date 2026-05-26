import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateResetPasswordEmail } from "@/lib/email";
import { passwordResetRateLimiter } from "@/lib/ratelimit";
import { createResetToken, revokeUserTokens } from "@/lib/passwordReset";
import { z } from "zod";
import { withErrorHandler } from "@/lib/errors";

const GENERIC_SUCCESS = "إذا كان البريد مسجلاً، سيتم إرسال تعليمات إعادة تعيين كلمة المرور";
const MIN_REQUEST_DURATION_MS = 1500;

const forgotSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
});

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = forgotSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email: rawEmail } = validation.data;
  const email = rawEmail.trim().toLowerCase();
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const startTime = Date.now();

  const { success: rateLimitOk } = await passwordResetRateLimiter.limit(`${email}:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, message: "طلبات كثيرة. حاول مرة أخرى بعد ساعة." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null, isActivated: true },
    select: { id: true, email: true, level: true },
  });

  if (user) {
    await revokeUserTokens(user.id);

    const { rawToken } = await createResetToken(user.id, user.email);

    const emailHtml = generateResetPasswordEmail(rawToken);

    sendEmail({
      to: user.email,
      subject: "استعادة كلمة المرور - سحابة الأمن السيبراني",
      html: emailHtml,
    })
      .then((emailSent) => {
        return prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "UPDATE",
            severity: emailSent ? "INFO" : "WARNING",
            description: emailSent
              ? "تم إرسال بريد إعادة تعيين كلمة المرور"
              : "فشل إرسال بريد إعادة تعيين كلمة المرور",
            ipAddress: ip,
            level: user.level,
          },
        });
      })
      .catch((err) => {
        console.error("Background email/audit operation failed:", err);
      });
  }

  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_REQUEST_DURATION_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_DURATION_MS - elapsed));
  }

  return NextResponse.json({
    success: true,
    message: GENERIC_SUCCESS,
  });
});
