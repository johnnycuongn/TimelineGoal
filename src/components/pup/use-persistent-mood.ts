import { useEffect } from "react";
import { derivePersistentMood } from "@/lib/mood";
import { usePupMood } from "./pup-mood-context";

/** How often the clock is re-read, so bedtime arrives without waiting for a fetch. */
const TICK_MS = 60_000;

/**
 * Keeps the pup's persistent mood in step with the couple's activity and the local
 * clock. Every page that shows the pup wants this: bedtime is a fact about the hour,
 * and a pup on the timeline at midnight should be asleep the same as one in the den.
 *
 * A page with no activity figures to hand passes nulls and still gets bedtime, which is
 * the one mood that asks nothing of the couple's history.
 */
export function usePersistentMood(activity: {
  lastCheckInAt: string | null;
  todayCount: number;
}): void {
  const { setPersistent } = usePupMood();
  const { lastCheckInAt, todayCount } = activity;
  useEffect(() => {
    const derive = () =>
      setPersistent(derivePersistentMood({ lastCheckInAt, todayCount, now: new Date() }));
    derive();
    const id = window.setInterval(derive, TICK_MS);
    return () => window.clearInterval(id);
  }, [lastCheckInAt, todayCount, setPersistent]);
}
