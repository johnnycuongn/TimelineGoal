import { isIos } from "@/hooks/use-is-standalone";

// Browser-side Web Push. No Supabase here: saving a subscription is a mutation.

export type PushSupport = "unsupported" | "needs-install" | "default" | "granted" | "denied";

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  standalone: boolean;
  ios: boolean;
}

/** iOS only exposes Web Push to a Home Screen app, so a Safari tab is told to install. */
export function pushSupport(env: PushEnv): PushSupport {
  if (env.ios && !env.standalone) {
    return "needs-install";
  }
  if (!(env.hasServiceWorker && env.hasPushManager && env.hasNotification) || !env.permission) {
    return "unsupported";
  }
  return env.permission;
}

export function readPushEnv(standalone: boolean): PushEnv {
  const hasNotification = typeof Notification !== "undefined";
  return {
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
    standalone,
    ios: isIos(),
  };
}

/**
 * Whether to (re)register this phone for the signed-in account on load. Only when the site
 * has a key and the person already allowed notifications — this never prompts.
 */
export function shouldRegisterDevice(env: {
  vapidKey: string | undefined;
  permission: NotificationPermission | null;
}): boolean {
  return Boolean(env.vapidKey) && env.permission === "granted";
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  // `.ready` waits forever when no worker is registered yet (dev, or a fresh session
  // before activation) — `getRegistration()` resolves immediately either way.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return null;
  }
  return registration.pushManager.getSubscription();
}

export async function subscribe(vapidKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error("Notifications need the app to finish loading. Reload and try again.");
  }
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}

export function subscriptionKeys(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
