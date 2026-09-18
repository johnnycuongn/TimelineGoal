import { describe, expect, test } from "vitest";
import type { CheckIn, CoupleData, Goal } from "./domain";
import { denView, timelineView } from "./views";

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

function checkin(
  id: string,
  goalId: string,
  uid: string,
  day: string,
  at: string,
  reactions: Record<string, "heart"> = {},
): CheckIn {
  return { id, coupleId: "c1", goalId, uid, day, at, horizon: "day", reactions };
}

const data: CoupleData = {
  couple: {
    id: "c1",
    pupName: "Mochi",
    anniversary: null,
    inviteCode: null,
    createdBy: A,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  members: [
    { id: A, displayName: "Ann", color: "rose" },
    { id: B, displayName: "Bo", color: "teal" },
  ],
  goals: [
    // Shared, and so autosealed by its creator: goals_autoseal fires for every
    // shared goal, whatever its horizon, so a zero-seal shared row cannot exist.
    goal({
      id: "walk",
      horizon: "day",
      owner: "shared",
      seals: { [A]: "2026-09-01T00:00:00.000Z" },
    }),
    goal({ id: "old", horizon: "day", archivedAt: "2026-09-02T00:00:00.000Z" }),
    goal({
      id: "m",
      horizon: "month",
      period: "2026-09",
      targetUnits: 2,
      owner: "shared",
      seals: { [A]: "2026-09-01T00:00:00.000Z" },
    }),
  ],
  checkins: [
    checkin("3", "walk", B, "2026-09-17", "2026-09-17T09:00:00.000Z"),
    checkin("2", "walk", A, "2026-09-17", "2026-09-17T08:00:00.000Z", { [B]: "heart" }),
    checkin("1", "walk", A, "2026-09-16", "2026-09-16T08:00:00.000Z"),
  ],
};

describe("denView", () => {
  test("shapes habits, states, ticker, seals, counts", () => {
    const den = denView(data, B, "2026-09-17");
    expect(den.habits.map((g) => g.id)).toEqual(["walk"]);
    expect(den.habitStates.walk?.todayBy).toEqual({ [A]: true, [B]: true });
    expect(den.ticker.map((t) => t.checkinId)).toEqual(["3", "2", "1"]);
    expect(den.ticker[1]?.goalTitle).toBe("walk");
    expect(den.ticker[1]?.reactions).toEqual({ [B]: "heart" });
    expect(den.waitingForMySeal.map((g) => g.id)).toEqual(["m"]);
    expect(den.lastCheckInAt).toBe("2026-09-17T09:00:00.000Z");
    expect(den.todayCount).toBe(2);
    expect(den.pupName).toBe("Mochi");
    expect(den.me).toBe(B);
  });

  test("a creator has nothing waiting for their seal", () => {
    expect(denView(data, A, "2026-09-17").waitingForMySeal).toEqual([]);
  });

  test("a shared habit is stamped, never sealed, so it never waits", () => {
    // `walk` is shared and carries only A's autoseal, so B has not sealed it — yet B
    // is never asked to press wax on a habit, because the day tab offers no seal.
    expect(data.goals[0]?.seals[B]).toBeUndefined();
    expect(denView(data, B, "2026-09-17").waitingForMySeal.map((g) => g.id)).toEqual(["m"]);
  });

  test("a milestone both have sealed waits for nobody", () => {
    const sealed: CoupleData = {
      ...data,
      goals: data.goals.map((g) =>
        g.id === "m" ? { ...g, seals: { ...g.seals, [B]: "2026-09-02T00:00:00.000Z" } } : g,
      ),
    };
    expect(denView(sealed, B, "2026-09-17").waitingForMySeal).toEqual([]);
  });
});

describe("timelineView", () => {
  test("carries active goals, lite checkins, progress and habit states", () => {
    const tl = timelineView(data, A, "2026-09-17");
    expect(tl.goals.map((g) => g.id)).toEqual(["walk", "m"]);
    expect(tl.checkins).toHaveLength(3);
    expect(tl.progress.m?.target).toBe(2);
    expect(tl.habits.walk?.streakDays).toBe(2);
  });
});
