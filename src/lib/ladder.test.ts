import { describe, expect, test } from "vitest";
import type { Goal } from "./domain";
import { type CheckInLite, computeHabitStates, computeProgress, filledPaws } from "./ladder";

const A = "user_a";
const B = "user_b";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "horizon">): Goal {
  return {
    coupleId: "c1",
    title: partial.id,
    charm: null,
    owner: A,
    period: null,
    targetUnits: null,
    parentGoalId: null,
    seals: {},
    createdBy: A,
    createdAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...partial,
  };
}

const ci = (goalId: string, uid: string, day: string): CheckInLite => ({ goalId, uid, day });

function get<T>(record: Record<string, T>, key: string): T {
  const value = record[key];
  if (!value) {
    throw new Error(`missing ${key}`);
  }
  return value;
}

describe("computeProgress", () => {
  test("own stamps within the period count, others do not", () => {
    const goals = [goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 4 })];
    const checkins = [ci("m", A, "2026-09-02"), ci("m", A, "2026-09-05"), ci("m", A, "2026-08-30")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(p.m).toEqual({ own: 2, ladder: 0, progress: 2, target: 4, complete: false });
  });

  test("a completed child adds one paw to its parent", () => {
    const goals = [
      goal({ id: "q", horizon: "quarter", period: "2026-Q3", targetUnits: 3 }),
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2, parentGoalId: "q" }),
    ];
    const checkins = [ci("m", A, "2026-09-02"), ci("m", A, "2026-09-05")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(get(p, "m").complete).toBe(true);
    expect(get(p, "q").ladder).toBe(1);
    expect(get(p, "q").progress).toBe(1);
  });

  test("a habit kept every day so far contributes one paw", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", parentGoalId: "m" }),
    ];
    const checkins = ["01", "02", "03"].map((d) => ci("h", A, `2026-09-${d}`));
    const p = computeProgress(goals, checkins, "2026-09-03");
    expect(get(p, "m").ladder).toBe(1);
  });

  test("a half-kept habit contributes half a paw; either partner counts", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", owner: "shared", parentGoalId: "m" }),
    ];
    const checkins = [ci("h", A, "2026-09-01"), ci("h", B, "2026-09-01"), ci("h", B, "2026-09-03")];
    const p = computeProgress(goals, checkins, "2026-09-04");
    expect(get(p, "m").ladder).toBe(0.5);
  });

  test("progress is capped at target and marks complete; ladder recurses", () => {
    const goals = [
      goal({ id: "y", horizon: "year", period: "2026", targetUnits: 1 }),
      goal({ id: "q", horizon: "quarter", period: "2026-Q3", targetUnits: 1, parentGoalId: "y" }),
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 1, parentGoalId: "q" }),
    ];
    const checkins = [ci("m", A, "2026-09-02"), ci("y", A, "2026-09-02")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(get(p, "q").complete).toBe(true);
    expect(p.y).toEqual({ own: 1, ladder: 1, progress: 1, target: 1, complete: true });
  });

  test("archived children are ignored", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", parentGoalId: "m", archivedAt: "2026-09-10T00:00:00.000Z" }),
    ];
    const p = computeProgress(goals, [ci("h", A, "2026-09-01")], "2026-09-01");
    expect(get(p, "m").ladder).toBe(0);
  });

  test("filledPaws floors", () => {
    expect(filledPaws({ own: 1, ladder: 0.5, progress: 1.5, target: 3, complete: false })).toBe(1);
  });
});

describe("computeHabitStates", () => {
  test("today flag per member and a 7-day strip ending today", () => {
    const goals = [goal({ id: "h", horizon: "day", owner: "shared" })];
    const checkins = [ci("h", A, "2026-09-17"), ci("h", B, "2026-09-15"), ci("h", B, "2026-09-16")];
    const s = computeHabitStates(goals, checkins, "2026-09-17", [A, B]);
    expect(get(s, "h").todayBy).toEqual({ [A]: true, [B]: false });
    expect(get(s, "h").last7[A]).toEqual([false, false, false, false, false, false, true]);
    expect(get(s, "h").last7[B]).toEqual([false, false, false, false, true, true, false]);
    expect(get(s, "h").stripDays).toEqual([
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
    ]);
  });

  test("streakDays counts consecutive days ending today (or yesterday) with any stamp", () => {
    const goals = [goal({ id: "h", horizon: "day" })];
    const three = ["15", "16", "17"].map((d) => ci("h", A, `2026-09-${d}`));
    expect(get(computeHabitStates(goals, three, "2026-09-17", [A]), "h").streakDays).toBe(3);
    expect(get(computeHabitStates(goals, three, "2026-09-18", [A]), "h").streakDays).toBe(3);
    expect(get(computeHabitStates(goals, three, "2026-09-19", [A]), "h").streakDays).toBe(0);
  });
});
