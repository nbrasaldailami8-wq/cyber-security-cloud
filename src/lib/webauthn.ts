import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const rpName = "سحابة الأمن السيبراني";
const rpID =
  process.env.NODE_ENV === "production"
    ? new URL(
        process.env.NEXT_PUBLIC_APP_URL ||
          "https://cyber-security-cloud.vercel.app",
      ).hostname
    : "localhost";
const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function extractChallengeFromResponse(
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
): string {
  const decoded = Buffer.from(response.response.clientDataJSON, "base64url").toString("utf-8");
  const clientData = JSON.parse(decoded);
  return clientData.challenge as string;
}

async function tryConsumeChallenge(
  rawChallenge: string,
  userId: string,
  purpose: "registration" | "authentication",
): Promise<{ consumed: boolean; replay: boolean }> {
  const challengeHash = hashToken(rawChallenge);
  const result = await prisma.webAuthnChallenge.updateMany({
    where: {
      challengeHash,
      userId,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (result.count > 0) return { consumed: true, replay: false };

  const existing = await prisma.webAuthnChallenge.findUnique({
    where: { challengeHash },
    select: { usedAt: true },
  });

  return { consumed: false, replay: existing?.usedAt != null };
}

export async function cleanupExpiredChallenges(): Promise<number> {
  const expired = await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() }, usedAt: null },
  });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const old = await prisma.webAuthnChallenge.deleteMany({
    where: { usedAt: { lt: cutoff } },
  });
  return expired.count + old.count;
}

export async function generateRegistrationOpts(
  userId: string,
  userEmail: string,
  userName: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) throw new Error("المستخدم غير موجود");

  const existingCredentials = await prisma.webAuthnCredential.findMany({
    where: { userId, revokedAt: null },
    select: { credentialId: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    userDisplayName: userName,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    timeout: 60000,
  });

  const challengeHash = hashToken(options.challenge);

  await prisma.webAuthnChallenge.create({
    data: {
      challengeHash,
      userId,
      purpose: "registration",
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  cleanupExpiredChallenges().catch((err) =>
    logger.warn("WebAuthn cleanup failed", { error: String(err) }),
  );

  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  ipAddress?: string,
  _userAgent?: string,
) {
  const rawChallenge = extractChallengeFromResponse(response);

  const { consumed, replay } = await tryConsumeChallenge(
    rawChallenge,
    userId,
    "registration",
  );

  if (!consumed) {
    if (replay) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SUSPICIOUS_ACTIVITY",
          severity: "CRITICAL",
          description: "محاولة إعادة استخدام تحدي WebAuthn في التسجيل",
          ipAddress: ipAddress || null,
        },
      });
      throw new Error("تم استخدام هذا التحدي مسبقاً");
    }
    throw new Error("تحدي WebAuthn غير صالح أو منتهي الصلاحية");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: rawChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "FAILED_LOGIN",
        severity: "WARNING",
        description: "فشل التحقق من تسجيل البصمة",
        ipAddress: ipAddress || null,
      },
    });
    throw new Error("فشل التحقق من البصمة");
  }

  const regInfo = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: regInfo.credential.id,
      publicKey: Buffer.from(regInfo.credential.publicKey),
      signCount: regInfo.credential.counter,
      transports: regInfo.credential.transports || [],
      backupEligible: regInfo.credentialBackedUp,
      backupState: regInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
  });

  await syncWebAuthnEnabled(userId);

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      severity: "INFO",
      description: "تم تسجيل بصمة جديدة",
      ipAddress: ipAddress || null,
    },
  });

  return { success: true };
}

export async function generateAuthenticationOpts(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId, revokedAt: null },
    select: { credentialId: true, transports: true },
  });

  if (credentials.length === 0) {
    throw new Error("البصمة غير مفعلة لهذا الحساب");
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as any,
    })),
    userVerification: "required",
    timeout: 60000,
  });

  const challengeHash = hashToken(options.challenge);

  await prisma.webAuthnChallenge.create({
    data: {
      challengeHash,
      userId,
      purpose: "authentication",
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

export async function verifyAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
  ipAddress?: string,
  _userAgent?: string,
) {
  const rawChallenge = extractChallengeFromResponse(response);

  const { consumed, replay } = await tryConsumeChallenge(
    rawChallenge,
    userId,
    "authentication",
  );

  if (!consumed) {
    if (replay) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SUSPICIOUS_ACTIVITY",
          severity: "CRITICAL",
          description: "محاولة إعادة استخدام تحدي WebAuthn في تسجيل الدخول",
          ipAddress: ipAddress || null,
        },
      });
      throw new Error("تم استخدام هذا التحدي مسبقاً");
    }
    throw new Error("تحدي WebAuthn غير صالح أو منتهي الصلاحية");
  }

  const credentialId = response.id;
  const storedCredential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
  });

  if (!storedCredential || storedCredential.userId !== userId) {
    throw new Error("بيانات البصمة غير موجودة");
  }

  if (storedCredential.revokedAt) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "WARNING",
        description: "محاولة استخدام بصمة ملغاة",
        ipAddress: ipAddress || null,
      },
    });
    throw new Error("تم إلغاء هذه البصمة");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: rawChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(storedCredential.publicKey),
      counter: storedCredential.signCount,
      transports: storedCredential.transports as any,
    },
  });

  if (!verification.verified) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "FAILED_LOGIN",
        severity: "WARNING",
        description: "فشل التحقق من بصمة الدخول",
        ipAddress: ipAddress || null,
      },
    });
    throw new Error("فشل التحقق من البصمة");
  }

  await prisma.webAuthnCredential.update({
    where: { credentialId },
    data: {
      signCount: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  return { success: true };
}

export async function revokeCredential(
  credentialId: string,
  userId: string,
  ipAddress?: string,
): Promise<void> {
  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
  });

  if (!cred || cred.userId !== userId) return;

  await prisma.webAuthnCredential.update({
    where: { credentialId },
    data: { revokedAt: new Date() },
  });

  await syncWebAuthnEnabled(userId);

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      severity: "WARNING",
      description: `إلغاء بصمة: ${cred.deviceName || credentialId}`,
      ipAddress: ipAddress || null,
    },
  });
}

export async function revokeAllCredentials(
  userId: string,
  ipAddress?: string,
): Promise<void> {
  const count = await prisma.webAuthnCredential.count({
    where: { userId, revokedAt: null },
  });

  await prisma.webAuthnCredential.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { webAuthnEnabled: false },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      severity: "WARNING",
      description: `إلغاء جميع البصمات (${count})`,
      ipAddress: ipAddress || null,
    },
  });
}

export async function syncWebAuthnEnabled(userId: string): Promise<void> {
  const count = await prisma.webAuthnCredential.count({
    where: { userId, revokedAt: null },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { webAuthnEnabled: count > 0 },
  });
}

export async function listCredentials(userId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { userId, revokedAt: null },
    select: {
      id: true,
      credentialId: true,
      deviceName: true,
      transports: true,
      backupEligible: true,
      backupState: true,
      signCount: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
