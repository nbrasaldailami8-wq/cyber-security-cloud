import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { WebAuthnService } from "@/services/auth/WebAuthnService";
import { withErrorHandler, UnauthorizedError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;

  const { credentialId, revokeAll } = await request.json();
  const ip = request.headers.get("x-forwarded-for") || undefined;

  if (revokeAll) {
    await WebAuthnService.revokeAllCredentials(userId, ip);
    return NextResponse.json({
      success: true,
      message: "تم إلغاء جميع البصمات بنجاح",
    });
  }

  if (!credentialId) {
    throw new ValidationError("معرف البصمة مطلوب");
  }

  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    select: { userId: true },
  });

  if (!cred || cred.userId !== userId) {
    throw new ValidationError("هذه البصمة غير موجودة أو لا تملك صلاحية حذفها");
  }

  await WebAuthnService.revokeCredential(credentialId, userId, ip);

  return NextResponse.json({
    success: true,
    message: "تم إلغاء البصمة بنجاح",
  });
});
