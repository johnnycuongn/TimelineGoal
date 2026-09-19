import { describe, expect, test } from "vitest";
import type { TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";
import { diffDen } from "./den-diff";

const item = (id: string, uid: string, reactions: Record<string, "heart"> = {}): TickerItem => ({
  checkinId: id,
  uid,
  goalId: "g",
  goalTitle: "Walk",
  charm: null,
  at: "2026-09-17T10:00:00.000Z",
  reactions,
});

const den = (ticker: TickerItem[]): DenData => ({
  habits: [],
  habitStates: {},
  ticker,
  waitingForMySeal: [],
  lastCheckInAt: null,
  todayCount: 0,
  members: [],
  me: "a",
  today: "2026-09-17",
  pupName: null,
});

describe("diffDen", () => {
  test("first load reports nothing", () => {
    expect(diffDen(null, den([item("1", "b")]), "a")).toEqual({
      partnerStamps: [],
      newHeartsOnMine: 0,
    });
  });

  test("new partner stamps are reported, my own are not", () => {
    const prev = den([item("1", "b")]);
    const next = den([item("3", "a"), item("2", "b"), item("1", "b")]);
    expect(diffDen(prev, next, "a").partnerStamps.map((i) => i.checkinId)).toEqual(["2"]);
  });

  test("a heart appearing on my stamp counts once", () => {
    const prev = den([item("1", "a")]);
    const next = den([item("1", "a", { b: "heart" })]);
    expect(diffDen(prev, next, "a").newHeartsOnMine).toBe(1);
    expect(diffDen(next, next, "a").newHeartsOnMine).toBe(0);
  });
});
