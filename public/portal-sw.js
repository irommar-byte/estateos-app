self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Masz nową wiadomość." };
  }

  const title = payload.title || "EstateOS™ Live Chat";
  const options = {
    body: payload.body || "Masz nową wiadomość od agenta.",
    icon: "/portal-icon-192.png",
    badge: "/favicon-32x32.png",
    tag: payload.tag || "estateos-client-chat",
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || "/" },
    actions: [{ action: "open", title: "Otwórz czat" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
