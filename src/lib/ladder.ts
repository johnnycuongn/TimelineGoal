// Pure progress maths for the Timeline and the Den.
import type { Goal } from "./domain";
import { daysElapsedInPeriod, periodContainsDay, shiftDay } from "./periods";

export interface CheckInLite {
  goalId: string;
  uid: string;
  day: string;
}

export interface GoalProgress {
  own: number;
  ladder: number;
  progress: number;
  target: number;
  complete: boolean;
}

export interface HabitState {
  todayBy: Record<string, boolean>;
  last7: Record<string, boolean[]>;
  /** The 7 day keys `last7` covers, oldest first. */
  stripDays: string[];
  streakDays: number;
}

const EPSILON = 1e-9;
const STRIP_DAYS = 7;

function byGoal(checkins: CheckInLite[]): Map<string, CheckInLite[]> {
  const map = new Map<string, CheckInLite[]>();
  for (const c of checkins) {
    const list = map.get(c.goalId);
    if (list) {
      list.push(c);
    } else {
      map.set(c.goalId, [c]);
    }
  }
  return map;
}

/** Distinct days (by any member) a habit was stamped inside `period`, up to today. */
export function habitFraction(
  goal: Goal,
  checkins: CheckInLite[],
  period: string,
  today: string,
): number {
  const elapsed = daysElapsedInPeriod(period, today);
  if (elapsed === 0) {
    return 0;
  }
  const days = new Set<string>();
  for (const c of checkins) {
    if (c.goalId === goal.id && c.day <= today && periodContainsDay(period, c.day)) {
      days.add(c.day);
    }
  }
  return Math.min(1, days.size / elapsed);
}

export function computeProgress(
  goals: Goal[],
  checkins: CheckInLite[],
  today: string,
): Record<string, GoalProgress> {
  const active = goals.filter((g) => g.archivedAt === null);
  const grouped = byGoal(checkins);
  const children = new Map<string, Goal[]>();
  for (const g of active) {
    if (g.parentGoalId) {
      const list = children.get(g.parentGoalId);
      if (list) {
        list.push(g);
      } else {
        children.set(g.parentGoalId, [g]);
      }
    }
  }

  const memo = new Map<string, GoalProgress>();

  const progressOf = (goal: Goal): GoalProgress => {
    const cached = memo.get(goal.id);
    if (cached) {
      return cached;
    }
    const period = goal.period ?? "";
    const target = goal.targetUnits ?? 1;
    const own = Math.min(
      target,
      (grouped.get(goal.id) ?? []).filter((c) => periodContainsDay(period, c.day)).length,
    );
    let ladder = 0;
    for (const child of children.get(goal.id) ?? []) {
      if (child.horizon === "day") {
        ladder += habitFraction(child, grouped.get(child.id) ?? [], period, today);
      } else {
        const p = progressOf(child);
        ladder += Math.min(1, p.progress / p.target);
      }
    }
    const progress = Math.min(target, own + ladder);
    const result: GoalProgress = {
      own,
      ladder,
      progress,
      target,
      complete: progress + EPSILON >= target,
    };
    memo.set(goal.id, result);
    return result;
  };

  const out: Record<string, GoalProgress> = {};
  for (const g of active) {
    if (g.horizon !== "day") {
      out[g.id] = progressOf(g);
    }
  }
  return out;
}

export function filledPaws(progress: GoalProgress): number {
  return Math.floor(progress.progress + EPSILON);
}

export function computeHabitStates(
  goals: Goal[],
  checkins: CheckInLite[],
  today: string,
  memberIds: string[],
): Record<string, HabitState> {
  const grouped = byGoal(checkins);
  const stripDays: string[] = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i -= 1) {
    stripDays.push(shiftDay(today, -i));
  }
  const out: Record<string, HabitState> = {};
  for (const g of goals) {
    if (g.horizon !== "day" || g.archivedAt !== null) {
      continue;
    }
    const stamps = grouped.get(g.id) ?? [];
    const todayBy: Record<string, boolean> = {};
    const last7: Record<string, boolean[]> = {};
    for (const uid of memberIds) {
      const mine = new Set(stamps.filter((c) => c.uid === uid).map((c) => c.day));
      todayBy[uid] = mine.has(today);
      last7[uid] = stripDays.map((d) => mine.has(d));
    }
    const anyDays = new Set(stamps.map((c) => c.day));
    let streakDays = 0;
    let cursor = anyDays.has(today) ? today : shiftDay(today, -1);
    while (anyDays.has(cursor)) {
      streakDays += 1;
      cursor = shiftDay(cursor, -1);
    }
    out[g.id] = { todayBy, last7, stripDays, streakDays };
  }
  return out;
}
