import type { NotificationKind } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { currentSubscription } from "@/lib/push";
import { supabase } from "@/lib/supabase";

function wrap(error: unknown): Error {
  return new Error(friendlyError(error), { cause: error });
}

const NO_ADDRESS = "This phone didn't give us anywhere to send notifications. Try again?";
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function savePushSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent: string,
  timezone: string,
): Promise<void> {
  if (!(sub.endpoint && sub.p256dh && sub.auth)) {
    throw new Error(NO_ADDRESS);
  }
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_user_agent: userAgent,
    p_timezone: timezone,
  });
  if (error) {
    throw wrap(error);
  }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    throw wrap(error);
  }
}

export async function updateNotificationPrefs(
  userId: string,
  patch: { muted?: NotificationKind[]; remindAt?: string },
): Promise<void> {
  if (patch.remindAt !== undefined && !HH_MM.test(patch.remindAt)) {
    throw new Error("Pick a time for your reminder.");
  }
  const { error } = await supabase
    .from("notification_prefs")
    .update({
      ...(patch.muted === undefined ? {} : { muted: patch.muted }),
      ...(patch.remindAt === undefined ? {} : { remind_at: patch.remindAt }),
    })
    .eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}

export async function syncTimezone(userId: string, timezone: string): Promise<void> {
  const { error } = await supabase
    .from("notification_prefs")
    .update({ timezone })
    .eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}

/** On sign-out: this phone stops buzzing for this account. Never blocks signing out. */
export async function forgetThisDevice(): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (!sub) {
      return;
    }
    await removePushSubscription(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  } catch {
    // No service worker (or it is still installing): nothing to forget.
  }
}
