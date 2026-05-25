self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  const title = data.title || "سحابة الأمن السيبراني";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-96x96.png",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: data.requireInteraction || false,
    tag: "cyber-notification",
    renotify: true,
    sound: "/sounds/notification.mp3",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
