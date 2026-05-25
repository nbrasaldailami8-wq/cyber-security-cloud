import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { verifyAuthWithDb, hashToken, revokeAllSessions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export class PasswordService {
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    await verifyAuthWithDb({ sub: userId } as any);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("��������");

    if (!currentPassword || !newPassword) {
      throw new ValidationError("�������� ������� ��� �����");
    }

    if (newPassword.length < 6) {
      throw new ValidationError("���� ������ ������� ����� ����");
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) throw new ValidationError("���� ������ ������� ��� �����");

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });

    await revokeAllSessions(userId);
  }

  static async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    if (currentRefreshToken) {
      const currentSession = await prisma.session.findUnique({
        where: { refreshTokenHash: hashToken(currentRefreshToken) },
      });
      if (currentSession) {
        await prisma.session.updateMany({
          where: { userId, id: { not: currentSession.id }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  static async requestEmailChange(userId: string, newEmail: string, currentEmail: string) {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new ValidationError("������ ���������� ��� ����");
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      throw new ValidationError("������ ���������� ������ ������");
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        severity: "INFO",
        description: `��� ����� ������ ���������� ���: ${newEmail}`,
        metadata: { newEmail },
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "ACCOUNT_MODIFIED",
          title: "��� ����� ���� ��������",
          body: `�������� ${currentEmail} ���� ����� ����� ���: ${newEmail}`,
        })),
      });
    }
  }

  static async requestNameChange(userId: string, newName: string, currentEmail: string) {
    if (!newName || newName.trim().length < 2) {
      throw new ValidationError("����� ������ ��� ����");
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        severity: "INFO",
        description: `��� ����� ����� ���: ${newName.trim()}`,
        metadata: { newName: newName.trim() },
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "ACCOUNT_MODIFIED",
          title: "��� ����� ���",
          body: `�������� ${currentEmail} ���� ����� ���� ���: ${newName.trim()}`,
        })),
      });
    }
  }
}
