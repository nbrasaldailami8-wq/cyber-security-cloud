import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_BYTES = 32;

export interface MfaChallengeResult {
  challengeId: string;
  challengeToken: string;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRawToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export async function createMfaChallenge(
  userId: string,
  ip: string,
  userAgent: string,
): Promise<MfaChallengeResult> {
  const rawToken = generateRawToken();
  const challengeHash = hashToken(rawToken);

  const record = await prisma.mfaChallenge.create({
    data: {
      challengeHash,
      userId,
      ipAddress: ip,
      userAgent,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  await cleanupExpiredChallenges();

  return { challengeId: record.id, challengeToken: rawToken };
}

export async function findChallengeByToken(
  challengeToken: string,
): Promise<{
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  usedAt: Date | null;
} | null> {
  const challengeHash = hashToken(challengeToken);
  const record = await prisma.mfaChallenge.findUnique({
    where: { challengeHash },
    select: {
      id: true,
      userId: true,
      ipAddress: true,
      userAgent: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  return record;
}

export async function tryConsumeChallenge(
  challengeToken: string,
): Promise<boolean> {
  const challengeHash = hashToken(challengeToken);
  const result = await prisma.mfaChallenge.updateMany({
    where: {
      challengeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  return result.count > 0;
}

export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.mfaChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() }, usedAt: null },
  });
  return result.count;
}
