import { prisma } from "@/lib/prisma";
import {
  generateAuthenticationOpts,
  verifyAuthentication,
  generateRegistrationOpts,
  verifyRegistration,
  listCredentials,
  revokeCredential,
  revokeAllCredentials,
} from "@/lib/webauthn";
import { generateAccessToken, setAuthCookies } from "@/lib/auth";
import { ValidationError, NotFoundError, UnauthorizedError } from "@/lib/errors";

export class WebAuthnService {
  static async startLogin(email: string, ipAddress?: string, userAgent?: string) {
    if (!email) {
      throw new ValidationError("البريد الإلكتروني مطلوب");
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user || !user.webAuthnEnabled) {
      return { options: null, userId: null };
    }

    const options = await generateAuthenticationOpts(user.id, ipAddress, userAgent);
    return { options, userId: user.id };
  }

  static async completeLogin(userId: string, authResponse: any, ip: string, userAgent?: string) {
    if (!userId || !authResponse) {
      throw new ValidationError("بيانات غير كافية");
    }

    await verifyAuthentication(userId, authResponse, ip, userAgent);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundError("المستخدم");
    if (user.status !== "ACTIVE") throw new UnauthorizedError("الحساب غير نشط");

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      level: user.level || undefined,
      tokenVersion: user.tokenVersion,
    };

    const { createInitialTokens } = await import("@/lib/auth");

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await createInitialTokens(user.id, {
      ipAddress: ip,
      userAgent,
      tokenVersion: user.tokenVersion,
    });

    await setAuthCookies(accessToken, refreshToken);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        severity: "INFO",
        description: "تسجيل دخول بالبصمة",
        ipAddress: ip,
        level: user.level,
      },
    });

    return { role: user.role, level: user.level, email: user.email, name: user.name };
  }

  static async startRegister(userId: string, userEmail: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const options = await generateRegistrationOpts(
      userId,
      userEmail,
      user?.name || userEmail,
      ipAddress,
      userAgent,
    );

    return { options };
  }

  static async completeRegister(userId: string, body: any, ipAddress?: string) {
    const result = await verifyRegistration(userId, body, ipAddress);
    return result;
  }

  static async listCredentials(userId: string) {
    return listCredentials(userId);
  }

  static async revokeCredential(credentialId: string, userId: string, ipAddress?: string) {
    await revokeCredential(credentialId, userId, ipAddress);
  }

  static async revokeAllCredentials(userId: string, ipAddress?: string) {
    await revokeAllCredentials(userId, ipAddress);
  }
}
