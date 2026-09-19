import { describe, expect, test } from "vitest";
import { TICKER_LIMIT, type TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";
import { diffDen } from "./den-diff";

const item = (
  id: string,
  uid: string,
  reactions: Record<string, "heart"> = {},
  at = "2026-09-17T10:00:00.000Z",
): TickerItem => ({
  checkinId: id,
  uid,
  goalId: "g",
  goalTitle: "Walk",
  charm: null,
  at,
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

/** Minute `n` of the den's history, so item ages are explicit in each test. */
const minute = (n: number) => `2026-09-17T10:${String(n).padStart(2, "0")}:00.000Z`;

/**
 * `denView` hands out only the newest `TICKER_LIMIT` check-ins, `at desc`. This
 * builds such a window: `ids` newest first, each a minute older than the last.
 */
const window_ = (ids: string[], uid: string, reactions: Record<string, "heart"> = {}) =>
  den(ids.map((id, i) => item(id, uid, reactions, minute(ids.length - i))));

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

  test("a check-in shifted into the window by a delete is not a new stamp", () => {
    // The den has more than a window's worth of history; my partner undoes today's
    // paw, so the newest row is gone and rank 11 slides in at the bottom.
    const ids = Array.from({ length: TICKER_LIMIT }, (_, i) => `c${i}`);
    const prev = window_(ids, "b");
    const shifted = [...ids.slice(1), "older"];
    const next = den(shifted.map((id, i) => item(id, "b", {}, minute(TICKER_LIMIT - 1 - i))));
    expect(diffDen(prev, next, "a").partnerStamps).toEqual([]);
  });

  test("hearts already on a shifted-in stamp of mine are not reported", () => {
    const ids = Array.from({ length: TICKER_LIMIT }, (_, i) => `c${i}`);
    const prev = window_(ids, "a");
    const shifted = [...ids.slice(1), "older"];
    const next = den(
      shifted.map((id, i) =>
        item(id, "a", id === "older" ? { b: "heart" } : {}, minute(TICKER_LIMIT - 1 - i)),
      ),
    );
    expect(diffDen(prev, next, "a").newHeartsOnMine).toBe(0);
  });

  test("a real stamp still lands once the window has shifted", () => {
    const ids = Array.from({ length: TICKER_LIMIT }, (_, i) => `c${i}`);
    const prev = window_(ids, "b");
    const next = den([
      item("fresh", "b", {}, minute(TICKER_LIMIT + 1)),
      ...ids.slice(0, TICKER_LIMIT - 1).map((id, i) => item(id, "b", {}, minute(TICKER_LIMIT - i))),
    ]);
    expect(diffDen(prev, next, "a").partnerStamps.map((i) => i.checkinId)).toEqual(["fresh"]);
  });
});
