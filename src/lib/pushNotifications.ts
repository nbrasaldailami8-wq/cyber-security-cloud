import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = "mailto:noreply@cybersecurity.cloud";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string,
) {
  try {
    const subscription = await prisma.pushSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.endpoint) return;

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.authKey,
          p256dh: subscription.p256dhKey,
        },
      },
      JSON.stringify({ title, body, url }),
    );
  } catch {
    await prisma.pushSubscription.delete({ where: { userId } });
  }
}

export async function sendPushToUsers(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    requireInteraction?: boolean;
    sound?: string;
  },
) {
  if (!userIds || userIds.length === 0) return;

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || "/icons/icon-192x192.png",
      badge: notification.badge || "/icons/icon-96x96.png",
      data: notification.data || {},
      requireInteraction: notification.requireInteraction || false,
      sound: notification.sound || "/sounds/notification.mp3",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.authKey, p256dh: sub.p256dhKey },
          },
          payload,
        ),
      ),
    );

    // حذف الاشتراكات منتهية الصلاحية
    const invalidEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected" && result.reason?.statusCode === 410) {
        invalidEndpoints.push(subscriptions[index].endpoint);
      }
    });

    if (invalidEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: invalidEndpoints } },
      });
    }
  } catch (error) {
    console.warn("[Push] Bulk send failed:", error);
  }
}
