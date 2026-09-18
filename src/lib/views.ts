// Turns one CoupleData fetch into what the Den and the Timeline render. Pure.
import {
  type CoupleData,
  type Goal,
  type Member,
  SHARED_OWNER,
  TICKER_LIMIT,
  type TickerItem,
} from "./domain";
import {
  type CheckInLite,
  computeHabitStates,
  computeProgress,
  type GoalProgress,
  type HabitState,
} from "./ladder";

export interface DenData {
  habits: Goal[];
  habitStates: Record<string, HabitState>;
  ticker: TickerItem[];
  /** Shared goals the viewer has not pressed their wax on yet. */
  waitingForMySeal: Goal[];
  lastCheckInAt: string | null;
  todayCount: number;
  members: Member[];
  me: string;
  today: string;
  pupName: string | null;
}

export interface TimelineData {
  goals: Goal[];
  checkins: CheckInLite[];
  progress: Record<string, GoalProgress>;
  habits: Record<string, HabitState>;
  members: Member[];
  me: string;
  today: string;
}

export function toLite(data: CoupleData): CheckInLite[] {
  return data.checkins.map((c) => ({ goalId: c.goalId, uid: c.uid, day: c.day }));
}

export function activeGoals(data: CoupleData): Goal[] {
  return data.goals.filter((g) => g.archivedAt === null);
}

export function denView(data: CoupleData, me: string, today: string): DenData {
  const goals = activeGoals(data);
  const habits = goals.filter((g) => g.horizon === "day");
  const lite = toLite(data);
  const byId = new Map(data.goals.map((g) => [g.id, g]));
  const ticker: TickerItem[] = data.checkins.slice(0, TICKER_LIMIT).map((c) => ({
    checkinId: c.id,
    uid: c.uid,
    goalId: c.goalId,
    goalTitle: byId.get(c.goalId)?.title ?? "a goal",
    charm: byId.get(c.goalId)?.charm ?? null,
    at: c.at,
    reactions: c.reactions,
  }));
  return {
    habits,
    habitStates: computeHabitStates(
      habits,
      lite,
      today,
      data.members.map((m) => m.id),
    ),
    ticker,
    // A shared goal always carries its creator's seal (goals_autoseal), so one with
    // no seals at all is waiting for nobody.
    waitingForMySeal: goals.filter(
      (g) => g.owner === SHARED_OWNER && !g.seals[me] && Object.keys(g.seals).length > 0,
    ),
    lastCheckInAt: data.checkins[0]?.at ?? null,
    todayCount: data.checkins.filter((c) => c.day === today).length,
    members: data.members,
    me,
    today,
    pupName: data.couple.pupName,
  };
}

export function timelineView(data: CoupleData, me: string, today: string): TimelineData {
  const goals = activeGoals(data);
  const lite = toLite(data);
  return {
    goals,
    checkins: lite,
    progress: computeProgress(goals, lite, today),
    habits: computeHabitStates(
      goals,
      lite,
      today,
      data.members.map((m) => m.id),
    ),
    members: data.members,
    me,
    today,
  };
}
