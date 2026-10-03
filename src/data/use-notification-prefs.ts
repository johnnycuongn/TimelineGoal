import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/auth/auth-provider";
import type { NotificationPrefs } from "@/lib/domain";
import { browserTimezone } from "@/lib/push";
import { syncTimezone } from "./notification-mutations";
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
