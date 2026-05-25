import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export interface PasswordResetResult {
  rawToken: string;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createResetToken(
  userId: string,
  email: string,
): Promise<PasswordResetResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const rawToken = crypto.randomBytes(3).toString("hex").toUpperCase();
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId,
      email: normalizedEmail,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  await cleanupExpiredTokens();

  return { rawToken };
}

export async function findResetToken(
  rawToken: string,
): Promise<{
  id: string;
  userId: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
} | null> {
  const tokenHash = hashToken(rawToken.toUpperCase());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, email: true, expiresAt: true, usedAt: true },
  });
  return record;
}

export async function tryConsumeResetToken(rawToken: string, email?: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken.toUpperCase());
  const where: Prisma.PasswordResetTokenUpdateManyArgs["where"] = {
    tokenHash,
    usedAt: null,
    expiresAt: { gt: new Date() },
  };
  if (email !== undefined) {
    where.email = email.trim().toLowerCase();
  }
  const result = await prisma.passwordResetToken.updateMany({
    where,
    data: { usedAt: new Date() },
  });
  return result.count > 0;
}

export async function revokeUserTokens(userId: string): Promise<number> {
  const result = await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count;
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() }, usedAt: null },
  });
  return result.count;
}
