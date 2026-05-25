import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

export class ProfileService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, name: true, email: true, role: true, level: true,
        status: true, isActivated: true, twoFactorEnabled: true, webAuthnEnabled: true,
        lastSeenAt: true, lastLoginAt: true, createdAt: true,
        uploadPermissions: {
          where: { revokedAt: null },
          select: { id: true, grantedAt: true },
        },
      },
    });
    if (!user) throw new NotFoundError("المستخدم غير موجود");

    const assignmentsCount = await prisma.assignment.count({
      where: { studentId: userId, deletedAt: null },
    });

    return { user: { ...user, stats: { assignmentsCount } } };
  }
}
