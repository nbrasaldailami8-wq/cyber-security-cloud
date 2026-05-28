async function getPublicKey(): Promise<string> {
  const res = await fetch("/api/push/subscribe");
  const data = await res.json();
  return data.publicKey;
}

export async function registerPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subObj = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subObj.endpoint,
          authKey: subObj.keys?.auth || "",
          p256dhKey: subObj.keys?.p256dh || "",
        }),
      });
      return true;
    }

    const publicKey = await getPublicKey();
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });

    const subObj = newSubscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subObj.endpoint,
        authKey: subObj.keys?.auth || "",
        p256dhKey: subObj.keys?.p256dh || "",
      }),
    });

    return true;
  } catch {
    return false;
  }
}

export async function unsubscribePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    await fetch("/api/push/unsubscribe", { method: "DELETE" });
    await registration.unregister();
  } catch {
    // best-effort, silent
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split("").map((ch) => ch.charCodeAt(0)));
}
