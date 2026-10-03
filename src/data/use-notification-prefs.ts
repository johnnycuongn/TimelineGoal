import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/auth/auth-provider";
import type { NotificationPrefs } from "@/lib/domain";
import {
  browserTimezone,
  currentSubscription,
  shouldRegisterDevice,
  subscribe,
  subscriptionKeys,
} from "@/lib/push";
import { savePushSubscription, syncTimezone } from "./notification-mutations";
import { fetchNotificationPrefs } from "./queries";

/** My own notification settings. `null` = never turned on; `undefined` = still loading. */
export function useNotificationPrefs() {
  const { userId } = useAuth();
  const swr = useSWR<NotificationPrefs | null>(userId ? ["notification-prefs", userId] : null, () =>
    fetchNotificationPrefs(userId ?? ""),
  );
  return { prefs: swr.data, refresh: swr.mutate };
}

/** Keeps the reminder on local time when the phone changes zone (travel, daylight rules). */
export function useTimezoneSync(): void {
  const { userId } = useAuth();
  const { prefs, refresh } = useNotificationPrefs();
  useEffect(() => {
    const zone = browserTimezone();
    if (!(userId && prefs) || prefs.timezone === zone) {
      return;
    }
    syncTimezone(userId, zone)
      .then(() => refresh())
      .catch(() => undefined);
  }, [userId, prefs, refresh]);
}

// Accounts already registered on this page load. A browser subscription plus a prefs row
// (from any device) doesn't prove this account has a row for this phone — a failed
// sign-out cleanup, a prune or a dead endpoint can leave it on the wrong account or none.
const registered = new Set<string>();

/**
 * Once per signed-in account per page load: if notifications are already allowed here,
 * make sure this phone's subscription belongs to this account. Never asks, never toasts.
 */
export function useDeviceRegistration(): void {
  const { userId } = useAuth();
  const { refresh } = useNotificationPrefs();
  useEffect(() => {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    const permission = typeof Notification === "undefined" ? null : Notification.permission;
    if (!(userId && vapidKey) || registered.has(userId)) {
      return;
    }
    if (!shouldRegisterDevice({ vapidKey, permission })) {
      return;
    }
    registered.add(userId);
    (async () => {
      const sub = (await currentSubscription()) ?? (await subscribe(vapidKey));
      await savePushSubscription(subscriptionKeys(sub), navigator.userAgent, browserTimezone());
      await refresh();
    })().catch(() => undefined);
  }, [userId, refresh]);
}
