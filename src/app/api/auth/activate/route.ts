import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withErrorHandler } from "@/lib/errors";

const activateSchema = z
  .object({
    code: z.string().min(4, "كود التفعيل غير صحيح"),
    email: z.string().email("بريد إلكتروني غير صالح"),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = activateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { code, email, password } = validation.data;
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  const codeHash = hashToken(code);

  const user = await prisma.user.findFirst({
    where: {
      activationCodeHash: codeHash,
      isActivated: false,
      status: "PENDING",
      deletedAt: null,
    },
  });

  if (!user) {
    const activationCode = await prisma.activationCode.findFirst({
      where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!activationCode) {
      return NextResponse.json(
        { success: false, message: "كود التفعيل غير صحيح أو منتهي الصلاحية" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, message: "المستخدم المرتبط بكود التفعيل غير موجود" },
      { status: 404 },
    );
  }

  if (user.isActivated) {
    return NextResponse.json(
      { success: false, message: "الحساب مفعل بالفعل" },
      { status: 400 },
    );
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail && existingEmail.id !== user.id) {
    return NextResponse.json(
      {
        success: false,
        message: "البريد الإلكتروني مستخدم بالفعل في حساب آخر",
      },
      { status: 400 },
    );
  }

  const activationCode = await prisma.activationCode.findFirst({
    where: {
      codeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!activationCode) {
    return NextResponse.json(
      { success: false, message: "كود التفعيل غير صحيح أو منتهي الصلاحية" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      passwordHash,
      isActivated: true,
      status: "ACTIVE",
      activationCodeHash: null,
      activationExpires: null,
    },
  });

  await prisma.activationCode.update({
    where: { id: activationCode.id },
    data: {
      usedAt: new Date(),
      usedBy: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      severity: "INFO",
      description: "تم تفعيل الحساب بنجاح",
      ipAddress: ip,
      level: user.level,
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم تفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول.",
    data: {
      role: user.role,
      level: user.level,
      name: user.name,
    },
  });
});
