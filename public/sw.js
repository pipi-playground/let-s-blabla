self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "렛블블", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "렛블블", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "letsblabla-push",
      renotify: true,
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) return existing.navigate(url).catch(() => {});
        return;
      }
      return self.clients.openWindow(url);
    })
  );
});
