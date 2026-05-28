self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  const title = data.title || "سحابة الأمن السيبراني";

  // T2: Skip push if any app window is visible (avoids toast+push dual delivery)
  const shouldSkip = clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.visibilityState === "visible" || client.focused) {
        return true;
      }
    }
    return false;
  });

  event.waitUntil(
    shouldSkip.then((skip) => {
      if (skip) return;

      // T7: Dynamic tags so related notifications group and different types don't overwrite
      let tag = "general";
      if (data.tag) {
        tag = data.tag;
      } else if (data.type === "NEW_MESSAGE") {
        tag = "message";
      } else if (data.type === "ASSIGNMENT_EVALUATED" || data.type === "NEW_ASSIGNMENT") {
        tag = "assignment";
      } else if (data.type === "GRADES_DISTRIBUTED" || data.type === "ANALYSIS_COMPLETED") {
        tag = "grade";
      }

      const options = {
        body: data.body || "",
        icon: data.icon || "/icons/icon-192x192.png",
        badge: data.badge || "/icons/icon-96x96.png",
        data: { url: data.url || "/" },
        vibrate: [200, 100, 200],
        silent: false,
        requireInteraction: data.requireInteraction || false,
        tag,
        renotify: true,
        sound: "/sounds/notification.mp3",
      };

      return self.registration.showNotification(title, options);
    }),
  );
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
