"use client";

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPushNotifications() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize service worker & check subscription state
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    // Register Service Worker
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.warn("[WebPushHook] Service Worker registration notice:", err);
      });
  }, []);

  // Subscribe to Web Push
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("المتصفح لا يدعم إشعارات الويب الفورية.");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Request Notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setError("تم رفض إذن الإشعارات من إعدادات المتصفح.");
        setIsLoading(false);
        return false;
      }

      // 2. Fetch VAPID Public Key from server
      const keyRes = await fetch("/api/v1/notifications/push/public-key");
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.publicKey) {
        throw new Error(keyData.error || "تعذر جلب مفتاح VAPID العام.");
      }

      // 3. Register push manager subscription
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      // 4. Send subscription payload to server
      const saveRes = await fetch("/api/v1/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || "تعذر حفظ الاشتراك في الخادم.");
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.error("[WebPushHook] Subscription failed:", err);
      setError(err?.message || "حدث خطأ أثناء تفعيل الإشعارات.");
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  // Unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        await fetch("/api/v1/notifications/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.error("[WebPushHook] Unsubscribe failed:", err);
      setError(err?.message || "حدث خطأ أثناء إلغاء الاشتراك.");
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  // Send Test Push
  const sendTestPush = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestPush,
  };
}
