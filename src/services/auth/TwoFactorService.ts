import { prisma } from "@/lib/prisma";
import { generateTwoFASecret, generateQRCode, verifyTwoFACode, generateBackupCodes } from "@/lib/twofa";
import { ValidationError } from "@/lib/errors";
import { verifyAuthWithDb, revokeAllSessions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export class TwoFactorService {
  static async setup(userId: string, userEmail: string) {
    await verifyAuthWithDb({ sub: userId } as any);
    const secret = generateTwoFASecret(userEmail);
    const qrCode = await generateQRCode(secret.otpauthUrl);
    const backupCodes = generateBackupCodes();

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: JSON.stringify({ secret: secret.base32, backupCodes }) },
    });

    return { secret: secret.base32, qrCode, backupCodes };
  }

  static async verify(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new ValidationError("لم يتم بدء الإعداد");

    const { secret, backupCodes } = JSON.parse(user.twoFactorSecret);

    let isValid = verifyTwoFACode(secret, token);
    if (!isValid && backupCodes) {
      const idx = backupCodes.indexOf(token);
      if (idx !== -1) {
        isValid = true;
        backupCodes.splice(idx, 1);
      }
    }

    if (!isValid) throw new ValidationError("الكود غير صحيح");

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: JSON.stringify({ secret, backupCodes }),
        tokenVersion: { increment: 1 },
      },
    });

    await revokeAllSessions(userId);

    return { backupCodes };
  }

  static async verifyTOTPOnly(userId: string, token: string): Promise<{ valid: boolean; consumedBackup?: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
      return { valid: false };
    }

    try {
      const { secret, backupCodes } = JSON.parse(user.twoFactorSecret);
      if (verifyTwoFACode(secret, token)) return { valid: true };

      if (backupCodes && Array.isArray(backupCodes)) {
        const idx = backupCodes.indexOf(token);
        if (idx !== -1) {
          backupCodes.splice(idx, 1);
          await prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: JSON.stringify({ secret, backupCodes }) },
          });
          return { valid: true, consumedBackup: true };
        }
      }

      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  static async disable(userId: string, currentPassword: string) {
    await verifyAuthWithDb({ sub: userId } as any);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new ValidationError("المستخدم غير موجود");

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new ValidationError("كلمة المرور الحالية غير صحيحة");

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, tokenVersion: { increment: 1 } },
    });

    await revokeAllSessions(userId);
  }
}
