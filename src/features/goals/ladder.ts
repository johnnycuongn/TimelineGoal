/**
 * Ladder math — pure functions over goal data, unit-tested (no Firebase imports).
 *
 * The ladder rule (couple-growth: small taps feed the big dream): each child goal
 * is worth ONE unit of its parent, earned fractionally as the child fills — so
 * every weekly check-in visibly nudges the quarter, and the quarter the year.
 * Direct check-ins on a parent count one unit each, alongside the children.
 *
 * Progress comes from the denormalized `progressBy` counters kept by checkIn();
 * the append-only checkins/ subcollection stays the keepsake history.
 */

import { prevWeekPeriod } from './period';

/** Structural slice of a Goal (+id) that the ladder math needs. */
export interface GoalLike {
  id: string;
  horizon: 'week' | 'quarter' | 'year';
  owner: string;
  period: string;
  targetUnits: number;
  parentGoalId?: string | null;
  progressBy?: Record<string, number>;
  seals?: Record<string, unknown>;
}

/** Total check-ins on a goal (both partners). */
export function goalDone(goal: GoalLike): number {
  return Object.values(goal.progressBy ?? {}).reduce((sum, n) => sum + n, 0);
}

export function goalComplete(goal: GoalLike): boolean {
  return goalDone(goal) >= goal.targetUnits;
}

/** A child's contribution to its parent bar: its own completion fraction, 0..1. */
export function childUnits(child: GoalLike): number {
  if (child.targetUnits <= 0) return 0;
  return Math.min(goalDone(child) / child.targetUnits, 1);
}

export interface Rollup {
  /** Fractional units earned (direct check-ins + children's fractions), ≤ targetUnits. */
  done: number;
  /** done / targetUnits, 0..1. */
  fraction: number;
  complete: boolean;
  children: GoalLike[];
}

/** Roll a parent goal's progress up from its own check-ins plus all its children. */
export function rollup(parent: GoalLike, allGoals: GoalLike[]): Rollup {
  const children = allGoals.filter((g) => g.parentGoalId === parent.id);
  const raw = goalDone(parent) + children.reduce((sum, c) => sum + childUnits(c), 0);
  const done = Math.min(raw, parent.targetUnits);
  const fraction = parent.targetUnits > 0 ? done / parent.targetUnits : 0;
  // Float-tolerant: three thirds must make a whole.
  const complete = parent.targetUnits > 0 && done >= parent.targetUnits - 1e-9;
  return { done, fraction, complete, children };
}

/** Goals in one horizon+period, shared first then oldest first (stable friendly order). */
export function goalsForPeriod<G extends GoalLike>(
  goals: G[],
  horizon: GoalLike['horizon'],
  period: string,
): G[] {
  return goals.filter((g) => g.horizon === horizon && g.period === period);
}

/**
 * Weeks the couple "completed" — at least one weekly goal filled that week.
 * Deliberately kind (couple-growth fairness test): one finished goal lights the
 * week up; a quiet week is simply absent, never a failure state.
 */
export function completedWeeks(goals: GoalLike[]): Set<string> {
  const done = new Set<string>();
  for (const g of goals) {
    if (g.horizon === 'week' && goalComplete(g)) done.add(g.period);
  }
  return done;
}

/**
 * Consecutive completed weeks ending now. The current, still-in-progress week
 * never breaks the streak — it just hasn't drawn its doodle yet.
 */
export function weeklyStreak(completed: Set<string>, thisWeek: string): number {
  let week = completed.has(thisWeek) ? thisWeek : prevWeekPeriod(thisWeek);
  let n = 0;
  while (completed.has(week)) {
    n += 1;
    week = prevWeekPeriod(week);
  }
  return n;
}

/** Both partners' check-in totals across one week's goals — feeds the pulse ring. */
export function weeklyPulse(
  goals: GoalLike[],
  week: string,
  memberUids: string[],
): { byUid: Record<string, number>; targetTotal: number } {
  const byUid: Record<string, number> = {};
  for (const uid of memberUids) byUid[uid] = 0;
  let targetTotal = 0;
  for (const g of goals) {
    if (g.horizon !== 'week' || g.period !== week) continue;
    targetTotal += g.targetUnits;
    for (const [uid, n] of Object.entries(g.progressBy ?? {})) {
      byUid[uid] = (byUid[uid] ?? 0) + n;
    }
  }
  return { byUid, targetTotal };
}

/** Sealed = both partners have pressed the wax. */
export function isSealed(goal: GoalLike): boolean {
  return Object.keys(goal.seals ?? {}).length >= 2;
}

/**
 * Shared goals in a current period still waiting for `uid`'s seal.
 * Restricted to current periods so old unsealed goals archive quietly
 * instead of nagging (guilt is a design bug).
 */
export function pendingSeals<G extends GoalLike>(
  goals: G[],
  uid: string,
  currentPeriods: string[],
): G[] {
  return goals.filter(
    (g) =>
      g.owner === 'shared' &&
      currentPeriods.includes(g.period) &&
      !isSealed(g) &&
      !(g.seals ?? {})[uid],
  );
}
