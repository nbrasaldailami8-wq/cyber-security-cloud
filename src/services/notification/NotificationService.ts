import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";

export class NotificationService {
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * safeLimit;

    const where = { userId };

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit: safeLimit };
  }

  static async markAsRead(notificationIds: string | string[], userId: string) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static async markRead(
    userId: string,
    notificationId?: string,
    all?: boolean,
  ) {
    if (all) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
    } else {
      throw new ValidationError("البيانات المدخلة غير كاملة");
    }
  }

  static async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return count;
  }
}
