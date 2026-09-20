import type { Goal, Horizon, Member } from "./domain";
import { SHARED_OWNER } from "./domain";
import { parentHorizon, periodContainsPeriod } from "./periods";

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
 * Active goals one horizon up that cover `period` — the stretch of time the goal being
 * written belongs to. A habit has no period of its own, so it climbs toward whatever
 * holds today, which is the rule `goals_validate` enforces in the database.
 */
export function parentCandidates(
  goals: Goal[],
  horizon: Horizon,
  period: string | null,
  today: string,
): Goal[] {
  const up = parentHorizon(horizon);
  if (!up || up === "day") {
    return [];
  }
  const anchor = period ?? today;
  return goals.filter(
    (g) =>
      g.horizon === up &&
      g.archivedAt === null &&
      g.period !== null &&
      periodContainsPeriod(g.period, anchor),
  );
}
