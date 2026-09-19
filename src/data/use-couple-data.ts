import { useEffect, useRef } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";
import { useAuth } from "@/auth/auth-provider";
import type { CoupleData } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { fetchCoupleData } from "./queries";

const FALLBACK_REFRESH_MS = 60_000;
const SETTLE_MS = 150;

const LIVE_TABLES = [
  { table: "couples", column: "id", me: true },
  { table: "members", column: "couple_id", me: true },
  { table: "goals", column: "couple_id", me: false },
  { table: "goal_seals", column: "couple_id", me: false },
  { table: "checkins", column: "couple_id", me: false },
  { table: "reactions", column: "couple_id", me: false },
] as const;

/**
 * The Realtime contract for this den. Read this before adding or removing a listener.
 *
 * Arrives live (one debounced refetch, SETTLE_MS after the event):
 *   - INSERT and UPDATE on all six tables above, filtered to this couple on
 *     `couple_id` (`id` for `couples`).
 *   - DELETE on `checkins`, deliberately *unfiltered*. Supabase does not apply RLS
 *     to DELETE events, and with RLS enabled and `replica identity full` the `old`
 *     record carries the primary key(s) alone — no `couple_id` for a filter to match,
 *     so a filtered delete listener would never fire and a partner's undo would sit
 *     on screen as a paw that no longer exists. The payload is only an id, which is
 *     all a refetch needs. The price is that another couple's undo also costs us one
 *     refetch, and that we see their bare check-in ids (no content); the app reads
 *     nothing out of the payload.
 *   - A check-in is the only row this app ever deletes (undo). Goals are archived,
 *     seals and hearts are forever, members and couples are never removed.
 *
 * Relies on the 60 s fallback: nothing. FALLBACK_REFRESH_MS and focus revalidation
 * are the safety net for a dropped socket, not the delivery path for any change.
 */
export function useCoupleData(coupleId: string, fromDay: string) {
  const { userId } = useAuth();
  const swr = useSWR<CoupleData>(
    ["couple", coupleId, fromDay],
    () => fetchCoupleData(coupleId, fromDay),
    {
      refreshInterval: FALLBACK_REFRESH_MS,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  const { mutate } = swr;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`couple:${coupleId}`);
    // Sticky across a collapsed burst: a members row arriving with a stamp must
    // still revalidate who-am-I, whichever event lands last.
    let alsoMe = false;
    const queue = (touchesMe: boolean) => {
      alsoMe = alsoMe || touchesMe;
      // Bursts (a stamp plus its reaction) collapse into one refetch.
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const refreshMe = alsoMe;
        alsoMe = false;
        void mutate();
        if (refreshMe && userId) {
          void mutateGlobal(["me", userId]);
        }
      }, SETTLE_MS);
    };

    for (const live of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: live.table,
          filter: `${live.column}=eq.${coupleId}`,
        },
        () => queue(live.me),
      );
    }
    // Unfiltered on purpose — see the Realtime contract above.
    channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "checkins" }, () =>
      queue(false),
    );
    channel.subscribe();
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [coupleId, mutate, userId]);

  return { data: swr.data, error: swr.error, refresh: mutate };
}
