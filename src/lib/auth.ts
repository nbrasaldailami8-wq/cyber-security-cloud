import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { JWTPayload } from "@/lib/types";
import { UnauthorizedError } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
export const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET!,
);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateId(): string {
  return randomBytes(16).toString("hex");
}

export interface VerifyRefreshResult {
  sub: string;
  mfaVerifiedAt: Date | null;
  tokenFamilyId?: string;
  tokenGenerationId?: string;
  generation?: number;
}

// توليد Access Token
export async function generateAccessToken(
  payload: Omit<JWTPayload, "type" | "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES_IN || "15m")
    .setIssuedAt()
    .sign(ACCESS_SECRET);
}

// توليد Refresh Token (نمط قديم — للتوافق العكسي فقط)
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = await new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .setIssuedAt()
    .sign(REFRESH_SECRET);

  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return token;
}

// إنشاء TokenFamily + TokenGeneration(gen=1) — للمصادقة الجديدة
export async function createInitialTokens(
  userId: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    mfaVerified?: boolean;
    tokenVersion?: number;
  },
): Promise<string> {
  const genId = generateId();

  let tokenVersion = options?.tokenVersion;
  if (tokenVersion === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    tokenVersion = user?.tokenVersion ?? 0;
  }

  const refreshToken = await new SignJWT({
    sub: userId,
    type: "refresh",
    jti: genId,
    tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .setIssuedAt()
    .sign(REFRESH_SECRET);

  const tokenHash = hashToken(refreshToken);

  await prisma.$transaction(async (tx) => {
    const family = await tx.tokenFamily.create({
      data: {
        userId,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent || null,
        mfaVerifiedAt: options?.mfaVerified ? new Date() : null,
      },
    });

    await tx.tokenGeneration.create({
      data: {
        id: genId,
        familyId: family.id,
        generation: 1,
        refreshTokenHash: tokenHash,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent || null,
      },
    });
  });

  return refreshToken;
}

// تدوير Refresh Token بشكل ذري — استهلاك generation قديمة، إنشاء جديدة
export async function rotateRefreshToken(
  familyId: string,
  currentGenId: string,
  currentGenNum: number,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  tokenVersion?: number,
): Promise<{ refreshToken: string; reused: boolean }> {
  const newGenId = generateId();

  const refreshToken = await new SignJWT({
    sub: userId,
    type: "refresh",
    jti: newGenId,
    tokenVersion: tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .setIssuedAt()
    .sign(REFRESH_SECRET);

  const tokenHash = hashToken(refreshToken);

  return prisma.$transaction(async (tx) => {
    // 1. استهلاك ذري — هذه نقطة السباق
    const consumeResult = await tx.tokenGeneration.updateMany({
      where: { id: currentGenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (consumeResult.count === 0) {
      // الكشف عن إعادة استخدام — تم استهلاك هذه الـ generation سابقاً
      await tx.tokenFamily.update({
        where: { id: familyId },
        data: { compromisedAt: new Date(), revokedAt: new Date() },
      });

      await tx.tokenGeneration.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "SUSPICIOUS_ACTIVITY",
          severity: "CRITICAL",
          description: "الكشف عن إعادة استخدام رمز التحديث — العائلة معرضة للخطر",
          ipAddress: ipAddress || null,
          metadata: {
            familyId,
            generationId: currentGenId,
            generation: currentGenNum,
          },
        },
      });

      return { refreshToken: "", reused: true };
    }

    // 2. إنشاء generation جديدة
    await tx.tokenGeneration.create({
      data: {
        id: newGenId,
        familyId,
        generation: currentGenNum + 1,
        refreshTokenHash: tokenHash,
        parentGenerationId: currentGenId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // 3. تحديث بيانات العائلة
    await tx.tokenFamily.update({
      where: { id: familyId },
      data: {
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return { refreshToken, reused: false };
  });
}

// ترحيل Session قديمة إلى TokenFamily + TokenGeneration
export async function migrateSessionToFamily(
  oldRefreshToken: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  tokenVersion?: number,
): Promise<string> {
  const oldTokenHash = hashToken(oldRefreshToken);
  const newGenId = generateId();

  const refreshToken = await new SignJWT({
    sub: userId,
    type: "refresh",
    jti: newGenId,
    tokenVersion: tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .setIssuedAt()
    .sign(REFRESH_SECRET);

  const newTokenHash = hashToken(refreshToken);

  return prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { refreshTokenHash: oldTokenHash },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedError("جلسة منتهية");
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError("الجلسة منتهية الصلاحية");
    }

    const revokeResult = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revokeResult.count === 0) {
      throw new UnauthorizedError("جلسة منتهية");
    }

    const family = await tx.tokenFamily.create({
      data: {
        userId,
        ipAddress: ipAddress || session.ipAddress || null,
        userAgent: userAgent || session.deviceInfo || null,
        mfaVerifiedAt: session.mfaVerifiedAt,
      },
    });

    await tx.tokenGeneration.create({
      data: {
        id: newGenId,
        familyId: family.id,
        generation: 1,
        refreshTokenHash: newTokenHash,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return refreshToken;
  });
}

// التحقق من Access Token
export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    logger.warn("Access token verification failed", { error: String(error) });
    return null;
  }
}

// التحقق من Refresh Token — يدعم كلا النمطين (قديم + جديد)
export async function verifyRefreshToken(
  token: string,
): Promise<VerifyRefreshResult | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    const tokenHash = hashToken(token);

    // 1. محاولة النمط الجديد (TokenGeneration)
    const gen = await prisma.tokenGeneration.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { family: true },
    });

    if (gen) {
      if (gen.revokedAt) return null;
      if (gen.family.revokedAt) return null;
      if (gen.family.compromisedAt) return null;

      return {
        sub: payload.sub as string,
        mfaVerifiedAt: gen.family.mfaVerifiedAt,
        tokenFamilyId: gen.familyId,
        tokenGenerationId: gen.id,
        generation: gen.generation,
      };
    }

    // 2. النمط القديم (Session) — للتوافق العكسي
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
    });

    if (!session || session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    return { sub: payload.sub as string, mfaVerifiedAt: session.mfaVerifiedAt };
  } catch (error) {
    logger.warn("Refresh token verification failed", { error: String(error) });
    return null;
  }
}

// حذف جلسة (تسجيل خروج)
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  const gen = await prisma.tokenGeneration.findUnique({
    where: { refreshTokenHash: tokenHash },
  });

  if (gen) {
    await prisma.tokenGeneration.update({
      where: { id: gen.id },
      data: { revokedAt: new Date() },
    });
    return;
  }

  await prisma.session.updateMany({
    where: { refreshTokenHash: tokenHash },
    data: { revokedAt: new Date() },
  });
}

// حذف جميع جلسات المستخدم
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.tokenFamily.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.tokenGeneration.updateMany({
    where: { family: { userId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// تعيين الكوكيز
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60,
    path: "/",
  });

  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

// التحقق المتقاطع من JWT مع قاعدة البيانات
export async function verifyAuthWithDb(
  jwtPayload: JWTPayload,
): Promise<{ id: string; role: string; level: string | null; status: string }> {
  const user = await prisma.user.findUnique({
    where: { id: jwtPayload.sub, deletedAt: null },
    select: { id: true, role: true, level: true, status: true },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.status === "SUSPENDED" || user.status === "LOCKED") {
    throw new Error("ACCOUNT_DISABLED");
  }

  return user;
}

// الحصول على الدور الفعّال من قاعدة البيانات
export async function getEffectiveRole(userId: string): Promise<{
  role: string;
  managementLevel: string | null;
  level: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { role: true, managementLevel: true, level: true },
  });
  if (!user) return { role: "", managementLevel: null, level: null };
  return {
    role: user.managementLevel ? "MANAGEMENT" : user.role,
    managementLevel: user.managementLevel,
    level: user.level,
  };
}

// مسح الكوكيز
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set("accessToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  cookieStore.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
