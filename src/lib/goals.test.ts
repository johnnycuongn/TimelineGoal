import { describe, expect, test } from "vitest";
import type { Goal, Member } from "./domain";
import { SHARED_OWNER } from "./domain";
import { isHabit, isTask, parentCandidates, stampersOf, taskDay } from "./goals";

const A = "a";
const B = "b";

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

const members: Member[] = [
  { id: A, displayName: "Ann", color: "rose" },
  { id: B, displayName: "Bo", color: "teal" },
];

describe("habit and task", () => {
  test("a day goal without a period is a habit", () => {
    const g = goal({ id: "h", horizon: "day" });
    expect(isHabit(g)).toBe(true);
    expect(isTask(g)).toBe(false);
    expect(taskDay(g)).toBe(null);
  });

  test("a day goal with a day key is a task", () => {
    const g = goal({ id: "t", horizon: "day", period: "2026-11-14" });
    expect(isTask(g)).toBe(true);
    expect(isHabit(g)).toBe(false);
    expect(taskDay(g)).toBe("2026-11-14");
  });

  test("a milestone is neither", () => {
    const g = goal({ id: "m", horizon: "month", period: "2026-11" });
    expect(isHabit(g)).toBe(false);
    expect(isTask(g)).toBe(false);
    expect(taskDay(g)).toBe(null);
  });
});

describe("stampersOf", () => {
  test("a private goal is stamped by its owner alone", () => {
    expect(stampersOf(goal({ id: "g", horizon: "day", owner: B }), members)).toEqual([members[1]]);
  });

  test("a shared goal is stamped by both", () => {
    expect(stampersOf(goal({ id: "g", horizon: "day", owner: SHARED_OWNER }), members)).toEqual(
      members,
    );
  });
});

describe("parentCandidates", () => {
  const w40 = goal({ id: "w40", horizon: "week", period: "2026-W40" });
  const w46 = goal({ id: "w46", horizon: "week", period: "2026-W46" });
  const sep = goal({ id: "sep", horizon: "month", period: "2026-09" });
  const oct = goal({ id: "oct", horizon: "month", period: "2026-10" });
  const nov = goal({ id: "nov", horizon: "month", period: "2026-11" });
  const dec = goal({ id: "dec", horizon: "month", period: "2026-12" });
  const q3 = goal({ id: "q3", horizon: "quarter", period: "2026-Q3" });
  const q4 = goal({ id: "q4", horizon: "quarter", period: "2026-Q4" });
  const y26 = goal({ id: "y26", horizon: "year", period: "2026" });
  const goals = [y26, q4, q3, dec, nov, oct, sep, w46, w40];

  test("a month goal climbs toward its quarter or its year", () => {
    expect(parentCandidates(goals, "month", "2026-11", "2026-09-20")).toEqual([q4, y26]);
  });

  test("a quarter goal climbs toward its year", () => {
    expect(parentCandidates(goals, "quarter", "2026-Q4", "2026-09-20")).toEqual([y26]);
  });

  test("a week inside one month climbs toward that month, its quarter or its year", () => {
    expect(parentCandidates(goals, "week", "2026-W46", "2026-09-20")).toEqual([nov, q4, y26]);
  });

  test("a week across a month end may climb toward either month, and either quarter", () => {
    expect(parentCandidates(goals, "week", "2026-W40", "2026-09-20")).toEqual([
      sep,
      oct,
      q3,
      q4,
      y26,
    ]);
  });

  test("a goal planned for next year is not offered this year's parents", () => {
    expect(parentCandidates(goals, "quarter", "2027-Q1", "2026-09-20")).toEqual([]);
  });

  test("a task climbs toward its week, month, quarter or year", () => {
    expect(parentCandidates(goals, "day", "2026-11-14", "2026-09-20")).toEqual([w46, nov, q4, y26]);
  });

  test("a habit has no period, so it climbs toward whatever holds today", () => {
    expect(parentCandidates(goals, "day", null, "2026-11-12")).toEqual([w46, nov, q4, y26]);
  });

  test("a year goal has nothing above it", () => {
    expect(parentCandidates(goals, "year", "2026", "2026-09-20")).toEqual([]);
  });

  test("a goal never climbs toward something as short as itself", () => {
    expect(parentCandidates(goals, "month", "2026-10", "2026-09-20")).not.toContain(oct);
  });

  test("an archived parent is not offered", () => {
    const gone = goal({
      id: "gone",
      horizon: "quarter",
      period: "2026-Q4",
      archivedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(parentCandidates([gone], "month", "2026-11", "2026-09-20")).toEqual([]);
  });
});
