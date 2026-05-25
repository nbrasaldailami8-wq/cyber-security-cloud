import { prisma } from "@/lib/prisma";
import { generateAccessToken, setAuthCookies } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";
import bcrypt from "bcryptjs";

export class AuthService {
  static async login(
    username: string,
    password: string,
    ip: string,
    userAgent: string = "unknown",
  ) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: username }, { name: username }],
        deletedAt: null,
      },
    });

    if (!user) {
      await prisma.auditLog.create({
        data: {
          action: "FAILED_LOGIN",
          severity: "WARNING",
          description: `محاولة دخول فاشلة: المستخدم غير موجود (${username})`,
          ipAddress: ip,
        },
      });
      throw new UnauthorizedError("البيانات المدخلة غير صحيحة");
    }

    if (user.status === "LOCKED" || user.status === "SUSPENDED") {
      if (user.lockedUntil && new Date() > user.lockedUntil) {
        // Atomic unlock — prevents concurrent bypass (P1-2)
        const { count } = await prisma.user.updateMany({
          where: { id: user.id, status: "LOCKED", lockedUntil: { lte: new Date() } },
          data: { status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
        });
        if (count === 0) {
          throw new ForbiddenError("الحساب مقفل مؤقتاً. حاول مرة أخرى لاحقاً.");
        }
        // Refetch user to get updated tokenVersion
        const refreshed = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        Object.assign(user, refreshed);
      } else {
        throw new ForbiddenError("الحساب مقفل مؤقتاً. حاول مرة أخرى لاحقاً.");
      }
    }

    if (!user.isActivated) {
      throw new ForbiddenError("الحساب غير مفعل. يرجى تفعيل الحساب أولاً.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Atomic increment — prevents brute-force race condition (P1-1)
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      const failedAttempts = updated.failedLoginAttempts;
      const maxAttempts = 5;

      if (failedAttempts >= maxAttempts) {
        const lockMinutes = failedAttempts >= 10 ? 10080 : failedAttempts >= 8 ? 15 : 7;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: "LOCKED",
            lockedUntil: new Date(Date.now() + lockMinutes * 60 * 1000),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "FAILED_LOGIN",
          severity: failedAttempts >= maxAttempts ? "CRITICAL" : "WARNING",
          description: `محاولة دخول فاشلة: كلمة مرور خاطئة (المحاولة ${failedAttempts})`,
          ipAddress: ip,
          level: user.level,
        },
      });

      throw new UnauthorizedError("البيانات المدخلة غير صحيحة");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date(), lastLoginIp: ip },
    });

    if (user.twoFactorEnabled) {
      const { createMfaChallenge } = await import("@/lib/mfa");
      const challenge = await createMfaChallenge(user.id, ip, userAgent);

      return {
        requiresTwoFactor: true,
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          level: user.level,
          webAuthnEnabled: user.webAuthnEnabled || false,
          managementLevel: user.managementLevel || null,
        },
      };
    }

    const { createInitialTokens } = await import("@/lib/auth");

    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      level: user.level || undefined,
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = await createInitialTokens(user.id, {
      ipAddress: ip,
      userAgent,
      tokenVersion: user.tokenVersion,
    });
    await setAuthCookies(accessToken, refreshToken);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        severity: "INFO",
        description: `تسجيل دخول ناجح`,
        ipAddress: ip,
        level: user.level,
      },
    });

    return { user, accessToken };
  }

  static async logout(refreshToken: string) {
    const { revokeSession } = await import("@/lib/auth");
    await revokeSession(refreshToken);
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, name: true, email: true, role: true, level: true,
        status: true, managementLevel: true, lastSeenAt: true, lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundError("المستخدم");
    return user;
  }
}
