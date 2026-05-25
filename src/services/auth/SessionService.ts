import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { refreshUserRateLimiter } from "@/lib/ratelimit";
import { UnauthorizedError } from "@/lib/errors";

export class SessionService {
  static async refreshSession(
    refreshToken: string,
    ip?: string,
    userAgent?: string,
  ) {
    const {
      verifyRefreshToken,
      rotateRefreshToken,
      migrateSessionToFamily,
      generateAccessToken,
      setAuthCookies,
    } = await import("@/lib/auth");

    // 1. التحقق من صحة الـ refresh token
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) throw new UnauthorizedError("جلسة منتهية أو غير صالحة");

    // 1b. منع rotation spam لكل مستخدم
    try {
      const { success: userLimitOk } = await refreshUserRateLimiter.limit(payload.sub);
      if (!userLimitOk) {
        throw new UnauthorizedError("محاولات كثيرة. حاول لاحقاً.");
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      // Redis down — fail-open, سجل تحذير فقط
    }

    // 2. التحقق من حالة المستخدم
    const user = await prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        level: true,
        status: true,
        twoFactorEnabled: true,
        tokenVersion: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedError("الحساب غير نشط");
    }

    let newRefreshToken: string;

    if (payload.tokenGenerationId) {
      // ====== نمط الـ Rotation (جديد) ======

      // 3. التحقق من MFA — منع bypass
      if (user.twoFactorEnabled && !payload.mfaVerifiedAt) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "SUSPICIOUS_ACTIVITY",
            severity: "WARNING",
            description: "محاولة تحديث الجلسة بدون مصادقة ثنائية",
            ipAddress: ip || null,
            metadata: {
              tokenFamilyId: payload.tokenFamilyId,
              tokenGenerationId: payload.tokenGenerationId,
            },
          },
        });
        throw new UnauthorizedError(
          "الرجاء تسجيل الدخول مرة أخرى باستخدام المصادقة الثنائية",
        );
      }

      // 4. التدوير الذري
      const result = await rotateRefreshToken(
        payload.tokenFamilyId!,
        payload.tokenGenerationId,
        payload.generation!,
        user.id,
        ip,
        userAgent,
        user.tokenVersion,
      );

      if (result.reused) {
        throw new UnauthorizedError("تم اختراق الجلسة — الرجاء تسجيل الدخول مرة أخرى");
      }

      newRefreshToken = result.refreshToken;
    } else {
      // ====== نمط التوافق العكسي (قديم) — ترحيل + تدوير ======

      // 3. التحقق من MFA
      if (user.twoFactorEnabled && !payload.mfaVerifiedAt) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "SUSPICIOUS_ACTIVITY",
            severity: "WARNING",
            description: "محاولة تحديث جلسة قديمة بدون مصادقة ثنائية",
            ipAddress: ip || null,
          },
        });
        throw new UnauthorizedError(
          "الرجاء تسجيل الدخول مرة أخرى باستخدام المصادقة الثنائية",
        );
      }

      // 4. ترحيل الـ session القديمة إلى النمط الجديد
      try {
        newRefreshToken = await migrateSessionToFamily(
          refreshToken,
          user.id,
          ip,
          userAgent,
          user.tokenVersion,
        );
      } catch {
        throw new UnauthorizedError("جلسة منتهية أو غير صالحة");
      }
    }

    // 5. إنشاء Access Token جديد
    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      level: user.level || undefined,
      tokenVersion: user.tokenVersion,
    });

    // 6. تعيين الكوكيز
    await setAuthCookies(accessToken, newRefreshToken);

    // 7. تسجيل نجاح التحديث
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        severity: "INFO",
        description: "تم تجديد الجلسة بنجاح",
        ipAddress: ip || null,
        level: user.level,
      },
    });

    return accessToken;
  }

  static async logout(refreshToken: string) {
    const { revokeSession, clearAuthCookies } = await import("@/lib/auth");

    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    await clearAuthCookies();
  }

  static async revokeOtherSessions(
    userId: string,
    currentSessionToken: string,
  ) {
    const currentHash = hashToken(currentSessionToken);

    // التحقق من النمط الجديد
    const currentGen = await prisma.tokenGeneration.findUnique({
      where: { refreshTokenHash: currentHash },
    });

    if (currentGen) {
      // إبطال جميع العائلات الأخرى
      await prisma.tokenFamily.updateMany({
        where: {
          userId,
          id: { not: currentGen.familyId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await prisma.tokenGeneration.updateMany({
        where: {
          family: { userId },
          familyId: { not: currentGen.familyId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      return;
    }

    // النمط القديم
    const currentSession = await prisma.session.findUnique({
      where: { refreshTokenHash: currentHash },
    });

    if (currentSession) {
      await prisma.session.updateMany({
        where: { userId, id: { not: currentSession.id }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  static async getUserSessions(userId: string) {
    const sessions = await prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return sessions;
  }
}
