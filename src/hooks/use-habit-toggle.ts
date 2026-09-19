import { useCallback, useState } from "react";
import { toast } from "sonner";
import { stamp, unstampHabit } from "@/data/goal-mutations";
import { localDayKey } from "@/lib/day";
import type { Goal } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import type { HabitState } from "@/lib/ladder";

export interface HabitToggle {
  /** Stamp or undo today's paw for `goal`; `current` is what the UI shows now. */
  toggle: (goal: Goal, current: boolean) => Promise<void>;
  /** Apply the optimistic override (if any) to a habit's fetched state. */
  view: (goalId: string, state: HabitState | undefined) => HabitState | undefined;
  busy: Set<string>;
}

export function useHabitToggle(
  ctx: { coupleId: string; me: string; refresh: () => Promise<unknown> },
  onStamped?: () => void,
): HabitToggle {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  const toggle = useCallback(
    async (goal: Goal, current: boolean) => {
      if (busy.has(goal.id)) {
        return;
      }
      setBusy((prev) => new Set(prev).add(goal.id));
      setOverrides((prev) => ({ ...prev, [goal.id]: !current }));
      const day = localDayKey();
      try {
        if (current) {
          await unstampHabit({ goalId: goal.id, uid: ctx.me, day });
        } else {
          const { created } = await stamp({
            coupleId: ctx.coupleId,
            goalId: goal.id,
            uid: ctx.me,
            day,
            horizon: goal.horizon,
          });
          if (created) {
            onStamped?.();
          }
        }
        await ctx.refresh();
      } catch (error) {
        toast.error(friendlyError(error, "That paw didn't land. Try again?"));
      } finally {
        setOverrides((prev) => {
          const { [goal.id]: _dropped, ...rest } = prev;
          return rest;
        });
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(goal.id);
          return next;
        });
      }
    },
    [busy, ctx, onStamped],
  );

  const view = useCallback(
    (goalId: string, state: HabitState | undefined): HabitState | undefined => {
      const override = overrides[goalId];
      if (override === undefined || !state) {
        return state;
      }
      return { ...state, todayBy: { ...state.todayBy, [ctx.me]: override } };
    },
    [overrides, ctx.me],
  );

  return { toggle, view, busy };
}
