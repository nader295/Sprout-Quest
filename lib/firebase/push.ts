"use client";

import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { app } from "@/lib/firebase/client";

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch {
      return null;
    }
  }
  return messaging;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "";

/**
 * Request push notification permission and get FCM token.
 * Registers the service worker if not already registered.
 */
export async function requestPushPermission(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // Register service worker
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/",
      });
      await registration.update();
    } catch (err) {
      console.warn("SW registration failed:", err);
    }
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const m = getMessagingInstance();
    if (!m) return null;
    const token = await getToken(m, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

/**
 * Listen for foreground messages and call the handler.
 */
export function onForegroundMessage(handler: (payload: {
  title?: string;
  body?: string;
  link?: string;
  type?: string;
}) => void): () => void {
  const m = getMessagingInstance();
  if (!m) return () => {};

  const unsubscribe = onMessage(m, (payload) => {
    handler({
      title: payload.notification?.title,
      body: payload.notification?.body,
      link: payload.data?.link,
      type: payload.data?.type,
    });
  });
  return unsubscribe;
}

/**
 * Save FCM token to backend for this user.
 */
export async function savePushToken(token: string, authToken: string): Promise<void> {
  try {
    await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: "web" }),
    });
  } catch {}
}

/**
 * Full setup: request permission → get token → save to backend.
 * Returns true if successful.
 */
export async function setupPushNotifications(getAuthToken: () => Promise<string>): Promise<boolean> {
  try {
    const fcmToken = await requestPushPermission();
    if (!fcmToken) return false;
    const authToken = await getAuthToken();
    await savePushToken(fcmToken, authToken);
    return true;
  } catch {
    return false;
  }
}
