import type { Goal, Horizon, Member } from "./domain";
import { HORIZONS, SHARED_OWNER } from "./domain";
import { horizonsAbove, periodContainsPeriod, periodsOverlap } from "./periods";

/** A daily habit: every day, for as long as it is wanted. */
export function isHabit(goal: Goal): boolean {
  return goal.horizon === "day" && goal.period === null;
}

/** A one-off: a single thing to do on one named day. */
export function isTask(goal: Goal): boolean {
  return goal.horizon === "day" && goal.period !== null;
}

/** The day a one-off lands on, or null if this is not one. */
export function taskDay(goal: Goal): string | null {
  return isTask(goal) ? goal.period : null;
}

/** Who may put a paw on this goal: both partners if it is shared, else its owner. */
export function stampersOf(goal: Goal, members: Member[]): Member[] {
  return goal.owner === SHARED_OWNER ? members : members.filter((m) => m.id === goal.owner);
}

/**
 * Does a goal of `horizon` over `period` fit inside `parentPeriod`? Everything must sit
 * inside its parent's stretch of time, except a week: weeks ignore month lines, so the
 * one from 28 Sep to 4 Oct may feed September or October. `goals_validate` holds the
 * same rule in the database.
 */
export function fitsParentPeriod(horizon: Horizon, period: string, parentPeriod: string): boolean {
  return horizon === "week"
    ? periodsOverlap(parentPeriod, period)
    : periodContainsPeriod(parentPeriod, period);
}

/**
 * Active goals on any longer horizon that cover `period` — the stretch of time the goal
 * being written belongs to — shortest horizon first, then earliest. A habit has no period of its own,
 * so it climbs toward whatever holds today, which is the rule `goals_validate` enforces
 * in the database.
 */
export function parentCandidates(
  goals: Goal[],
  horizon: Horizon,
  period: string | null,
  today: string,
): Goal[] {
  const above = horizonsAbove(horizon);
  const anchor = period ?? today;
  return goals
    .filter(
      (g) =>
        above.includes(g.horizon) &&
        g.archivedAt === null &&
        g.period !== null &&
        fitsParentPeriod(horizon, anchor, g.period),
    )
    .sort(
      (a, b) =>
        HORIZONS.indexOf(a.horizon) - HORIZONS.indexOf(b.horizon) ||
        (a.period ?? "").localeCompare(b.period ?? ""),
    );
}
