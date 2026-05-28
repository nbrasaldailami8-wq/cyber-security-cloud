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
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url, icon: "/icons/icon-192x192.png", badge: "/icons/icon-96x96.png" });

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

    const invalidEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const code = result.reason?.statusCode;
        if (code === 410 || code === 404) {
          invalidEndpoints.push(subscriptions[index].endpoint);
        } else {
          console.warn("[Push] sendPushNotification فشل:", code, result.reason?.message);
        }
      }
    });

    if (invalidEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: invalidEndpoints } },
      });
    }
  } catch (error) {
    console.error("[Push] sendPushNotification فشل:", error);
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

    const invalidEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const code = result.reason?.statusCode;
        if (code === 410 || code === 404) {
          invalidEndpoints.push(subscriptions[index].endpoint);
        } else {
          console.warn("[Push] فشل إرسال مع كود:", code, result.reason?.message);
        }
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
