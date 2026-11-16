/**
 * SoufAI Service Worker & Web Push Notification Handler
 * Handles background push notifications, badge management, and notification click navigation.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Web Push Notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "إشعار جديد من SoufAI",
    body: "لديك تحديث جديد في المنصة.",
    icon: "/icon.png",
    badge: "/icon.png",
    data: {
      url: "/ar/chat",
      timestamp: Date.now(),
    },
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || parsed.message || data.body,
        icon: parsed.icon || data.icon,
        badge: parsed.badge || data.badge,
        data: {
          url: parsed.data?.url || parsed.url || "/ar/chat",
          notificationId: parsed.id || parsed.data?.id,
          timestamp: Date.now(),
        },
        actions: parsed.actions || [
          { action: "open", title: "فتح المنصة" },
          { action: "dismiss", title: "تجاهل" },
        ],
      };
    }
  } catch (err) {
    console.warn("[SW] Push payload parse error, using text fallback:", err);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    dir: "rtl",
    lang: "ar",
    vibrate: [100, 50, 100],
    actions: data.actions,
    tag: data.data?.notificationId || "soufai-notification",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Handle Notification Click & Action Routing
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/ar/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (const client of windowClients) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl) || client.url.includes("/chat") || client.url.includes("/launch")) {
            return client.focus();
          }
        }
      }
      // If not open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push subscription change
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        return fetch("/api/v1/notifications/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
      })
      .catch((err) => console.error("[SW] Push subscription change re-subscribe failed:", err))
  );
});
