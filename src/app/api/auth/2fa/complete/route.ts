import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findChallengeByToken } from "@/lib/mfa";
import { generateAccessToken, setAuthCookies, hashToken, REFRESH_SECRET } from "@/lib/auth";
import { verifyTwoFACode } from "@/lib/twofa";
import { twoFARateLimiter } from "@/lib/ratelimit";
import { withErrorHandler, ValidationError, UnauthorizedError, RateLimitError } from "@/lib/errors";
import { SignJWT } from "jose";
import { randomBytes } from "crypto";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const { challengeToken, totpToken } = body;

  if (!challengeToken || !totpToken) {
    throw new ValidationError("رمز التحدي ورمز المصادقة مطلوبان");
  }

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const challenge = await findChallengeByToken(challengeToken);
  if (!challenge) {
    throw new UnauthorizedError("تحدي المصادقة غير صالح");
  }

  if (challenge.usedAt) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "CRITICAL",
        description: "محاولة إعادة استخدام تحدي MFA منتهي",
        ipAddress: ip,
        metadata: { challengeId: challenge.id },
      },
    });
    throw new UnauthorizedError("تحدي المصادقة غير صالح أو منتهي");
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "WARNING",
        description: "محاولة استخدام تحدي MFA منتهي الصلاحية",
        ipAddress: ip,
        metadata: { challengeId: challenge.id, expiredAt: challenge.expiresAt.toISOString() },
      },
    });
    throw new UnauthorizedError("تحدي المصادقة غير صالح أو منتهي");
  }

  if (challenge.ipAddress && challenge.ipAddress !== ip) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "CRITICAL",
        description: "محاولة MFA من عنوان IP مختلف",
        ipAddress: ip,
        metadata: { challengeId: challenge.id, expectedIp: challenge.ipAddress },
      },
    });
    throw new UnauthorizedError("تحدي المصادقة غير صالح أو منتهي");
  }

  if (challenge.userAgent && challenge.userAgent !== userAgent) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "WARNING",
        description: "محاولة MFA من متصفح مختلف",
        ipAddress: ip,
        metadata: { challengeId: challenge.id },
      },
    });
    throw new UnauthorizedError("تحدي المصادقة غير صالح أو منتهي");
  }

  const rateKey = `${challenge.userId}:${ip}`;
  const { success: rateLimitOk } = await twoFARateLimiter.limit(rateKey);
  if (!rateLimitOk) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "CRITICAL",
        description: "محاولة MFA brute-force: تجاوز حد المحاولات",
        ipAddress: ip,
        metadata: { challengeId: challenge.id },
      },
    });
    throw new RateLimitError();
  }

  const userData = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true, id: true },
  });

  if (!userData?.twoFactorSecret || !userData.twoFactorEnabled) {
    throw new UnauthorizedError("المصادقة الثنائية غير مفعلة");
  }

  const { secret, backupCodes } = JSON.parse(userData.twoFactorSecret);

  let totpValid = verifyTwoFACode(secret, totpToken);
  let backupCodeUsed = false;

  if (!totpValid && backupCodes && Array.isArray(backupCodes)) {
    const idx = backupCodes.indexOf(totpToken);
    if (idx !== -1) {
      totpValid = true;
      backupCodeUsed = true;
      backupCodes.splice(idx, 1);
      await prisma.user.update({
        where: { id: userData.id },
        data: { twoFactorSecret: JSON.stringify({ secret, backupCodes }) },
      });
    }
  }

  if (!totpValid) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "FAILED_LOGIN",
        severity: "WARNING",
        description: "رمز مصادقة ثنائية غير صحيح",
        ipAddress: ip,
      },
    });
    throw new UnauthorizedError("رمز المصادقة الثنائية غير صحيح");
  }

  // Fetch user (needed for tokenVersion)
  const user = await prisma.user.findUnique({
    where: { id: challenge.userId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true, email: true, name: true, role: true, level: true,
      managementLevel: true, tokenVersion: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("الحساب غير نشط");
  }

  // Create JWT tokens (pure crypto — outside transaction)
  const genId = randomBytes(16).toString("hex");

  const accessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    level: user.level || undefined,
    tokenVersion: user.tokenVersion,
  });
  const refreshToken = await new SignJWT({
    sub: user.id,
    type: "refresh",
    jti: genId,
    tokenVersion: user.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .setIssuedAt()
    .sign(REFRESH_SECRET);

  const tokenHash = hashToken(refreshToken);

  // Single transaction: consume challenge + create tokens + update lastLogin
  const txCommitted = await prisma.$transaction(async (tx) => {
    const challengeHash = hashToken(challengeToken);
    const consumed = await tx.mfaChallenge.updateMany({
      where: { challengeHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) return false;

    const family = await tx.tokenFamily.create({
      data: { userId: user.id, ipAddress: ip, userAgent, mfaVerifiedAt: new Date() },
    });

    await tx.tokenGeneration.create({
      data: {
        id: genId, familyId: family.id, generation: 1,
        refreshTokenHash: tokenHash, ipAddress: ip, userAgent,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    return true;
  });

  if (!txCommitted) {
    await prisma.auditLog.create({
      data: {
        userId: challenge.userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "CRITICAL",
        description: "Race condition: تحدي MFA تم استهلاكه بشكل متزامن",
        ipAddress: ip,
      },
    });
    throw new UnauthorizedError("تحدي المصادقة غير صالح أو منتهي");
  }

  // Set cookies (outside transaction)
  await setAuthCookies(accessToken, refreshToken);

  const auditDescription = backupCodeUsed
    ? "تسجيل دخول ناجح (رمز احتياطي)"
    : "تسجيل دخول ناجح (مع المصادقة الثنائية)";

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      severity: "INFO",
      description: auditDescription,
      ipAddress: ip,
      level: user.level,
    },
  });

  return NextResponse.json({
    success: true,
    message: "تم تسجيل الدخول بنجاح",
    role: user.role,
    level: user.level,
    email: user.email,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      level: user.level,
      managementLevel: user.managementLevel || null,
    },
  });
});
