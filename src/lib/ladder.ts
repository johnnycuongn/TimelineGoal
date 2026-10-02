// Pure progress maths for the Timeline and the Den.
import type { Goal, Member } from "./domain";
import { isTask, stampersOf } from "./goals";
import { daysBetween, periodContainsDay, periodRange, shiftDay } from "./periods";

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

export interface TaskState {
  /** Has each stamper put their paw on it? */
  doneBy: Record<string, boolean>;
  /** Every stamper has. A shared one-off waits for both. */
  done: boolean;
}

export interface HabitState {
  todayBy: Record<string, boolean>;
  last7: Record<string, boolean[]>;
  /** The 7 day keys `last7` covers, oldest first. */
  stripDays: string[];
  streakDays: number;
}

const EPSILON = 1e-9;
const DAY_KEY_LENGTH = 10;
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

/**
 * The first day a habit's record is held against. `createdAt` is UTC, which is a day
 * behind the calendar for anyone east of Greenwich in their morning, so the habit is
 * taken to start the UTC day after — unless it was stamped earlier than that, in which
 * case that stamp is the start.
 */
function habitStart(goal: Goal, stampedDays: Iterable<string>): string {
  let start = shiftDay(goal.createdAt.slice(0, DAY_KEY_LENGTH), 1);
  for (const day of stampedDays) {
    if (day < start) {
      start = day;
    }
  }
  return start;
}

/**
 * Distinct days (by any member) a habit was stamped inside `period`, up to today, over
 * the days it could have been. The clock starts at the later of the period's start and
 * the habit's own, so a habit begun in October and kept every day since is a whole paw
 * toward the year — not a quarter of one.
 */
export function habitFraction(
  goal: Goal,
  checkins: CheckInLite[],
  period: string,
  today: string,
): number {
  const days = new Set<string>();
  for (const c of checkins) {
    if (c.goalId === goal.id && c.day <= today && periodContainsDay(period, c.day)) {
      days.add(c.day);
    }
  }
  const { start, end } = periodRange(period);
  const born = habitStart(goal, days);
  const from = born > start ? born : start;
  const last = today < end ? today : end;
  if (last < from) {
    return 0;
  }
  return Math.min(1, days.size / (daysBetween(from, last) + 1));
}

/** Has every stamper put a paw on this one-off, on its own day? */
function taskDone(goal: Goal, stamps: CheckInLite[], members: Member[]): boolean {
  const stampers = stampersOf(goal, members);
  return (
    stampers.length > 0 &&
    stampers.every((m) => stamps.some((c) => c.uid === m.id && c.day === goal.period))
  );
}

export function computeTaskStates(
  goals: Goal[],
  checkins: CheckInLite[],
  members: Member[],
): Record<string, TaskState> {
  const grouped = byGoal(checkins);
  const out: Record<string, TaskState> = {};
  for (const g of goals) {
    if (!isTask(g) || g.archivedAt !== null) {
      continue;
    }
    const stamps = grouped.get(g.id) ?? [];
    const doneBy: Record<string, boolean> = {};
    for (const m of stampersOf(g, members)) {
      doneBy[m.id] = stamps.some((c) => c.uid === m.id && c.day === g.period);
    }
    out[g.id] = { doneBy, done: taskDone(g, stamps, members) };
  }
  return out;
}

export function computeProgress(
  goals: Goal[],
  checkins: CheckInLite[],
  today: string,
  members: Member[] = [],
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
      if (isTask(child)) {
        // One thing done on one day is a whole paw when it is finished — not the
        // day-out-of-the-month fraction a habit earns.
        ladder += taskDone(child, grouped.get(child.id) ?? [], members) ? 1 : 0;
      } else if (child.horizon === "day") {
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
    if (g.horizon !== "day" || isTask(g) || g.archivedAt !== null) {
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
