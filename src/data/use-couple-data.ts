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
 * One SWR entry per couple and year, kept fresh three ways: Realtime rows for
 * this couple, focus/visibility revalidation (an iPhone PWA coming back from
 * the background), and a slow interval as the safety net.
 */
export function useCoupleData(coupleId: string, today: string) {
  const { userId } = useAuth();
  const year = today.slice(0, 4);
  const swr = useSWR<CoupleData>(
    ["couple", coupleId, year],
    () => fetchCoupleData(coupleId, `${year}-01-01`),
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
    for (const live of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: live.table,
          filter: `${live.column}=eq.${coupleId}`,
        },
        () => {
          // Bursts (a stamp plus its reaction) collapse into one refetch.
          if (timer.current !== null) {
            window.clearTimeout(timer.current);
          }
          timer.current = window.setTimeout(() => {
            timer.current = null;
            void mutate();
            if (live.me && userId) {
              void mutateGlobal(["me", userId]);
            }
          }, SETTLE_MS);
        },
      );
    }
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
