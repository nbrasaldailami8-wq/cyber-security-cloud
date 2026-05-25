import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import { revokeAllSessions } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const PUT = withErrorHandler(async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  if (payload.role !== "ADMIN" && payload.role !== "MANAGEMENT") {
    throw new ForbiddenError();
  }

  const body = await request.json();
  const { name } = body;
  if (!name || name.length < 2) throw new ValidationError("الاسم قصير جداً");

  const entry = await prisma.generationLog.findUnique({ where: { id: params.id } });
  if (!entry || entry.deletedAt) throw new NotFoundError("السجل");

  if (payload.role === "MANAGEMENT" && payload.level !== entry.level) {
    throw new ForbiddenError("لا يمكنك تعديل سجل من مستوى آخر");
  }

  await prisma.generationLog.update({
    where: { id: params.id },
    data: { name },
  });

  return NextResponse.json({ success: true, message: "تم تعديل الاسم بنجاح" });
});

export const DELETE = withErrorHandler(async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  if (payload.role !== "ADMIN" && payload.role !== "MANAGEMENT") {
    throw new ForbiddenError();
  }

  const entry = await prisma.generationLog.findUnique({ where: { id: params.id } });
  if (!entry || entry.deletedAt) throw new NotFoundError("السجل");

  if (payload.role === "MANAGEMENT" && payload.level !== entry.level) {
    throw new ForbiddenError("لا يمكنك حذف سجل من مستوى آخر");
  }

  if (entry.email) {
    const user = await prisma.user.findUnique({ where: { email: entry.email } });
    if (user && !user.deletedAt) {
      if (user.role === "TEACHER") {
        await prisma.subject.updateMany({
          where: { teacherId: user.id, deletedAt: null },
          data: { deletedAt: new Date(), teacherId: null },
        });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date(), status: "SUSPENDED", passwordHash: "", tokenVersion: { increment: 1 } },
      });

      await revokeAllSessions(user.id);
    }
  }

  if (entry.code) {
    const codeHashValue = hashToken(entry.code);
    await prisma.activationCode.updateMany({
      where: { codeHash: codeHashValue, usedAt: null },
      data: { expiresAt: new Date(0) },
    }).catch(() => {});
  }

  await prisma.generationLog.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: payload.sub as string,
      action: "DELETE",
      description: `تم حذف الحساب المولد: ${entry.name} - ${entry.role}`,
      level: entry.level as any,
    },
  });

  return NextResponse.json({ success: true, message: "تم حذف السجل والمستخدم المرتبط به بنجاح" });
});
