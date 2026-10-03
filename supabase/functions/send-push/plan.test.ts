import { describe, expect, test } from "vitest";
import {
  isGone,
  isPushServiceEndpoint,
  localDay,
  type OutboxRow,
  type PlanContext,
  planDeliveries,
  settle,
} from "./plan.ts";

const ARI = "a0000000-0000-4000-8000-00000000000a";
const MIA = "b0000000-0000-4000-8000-00000000000b";
const RUN = "c1000000-0000-4000-8000-000000000001";
const READ = "c1000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-03T09:00:00Z");

function row(over: Partial<OutboxRow>): OutboxRow {
  return {
    id: crypto.randomUUID(),
    recipient_id: ARI,
    actor_id: MIA,
    kind: "paw_shared",
    goal_id: RUN,
    attempts: 1,
    ...over,
  };
}

function ctx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    names: new Map([
      [ARI, "Ari"],
      [MIA, "Mia"],
    ]),
    goals: new Map([
      [RUN, { title: "Morning run", charm: "🏃", owner_id: null }],
      [READ, { title: "Read 20 pages", charm: "📚", owner_id: MIA }],
    ]),
    prefs: new Map([[ARI, { timezone: "Australia/Sydney", muted: [] }]]),
    openGoals: new Map(),
    now: NOW,
    ...over,
  };
}

describe("localDay", () => {
  test("uses the member's own calendar", () => {
    expect(localDay("Australia/Sydney", new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-04");
    expect(localDay("America/Los_Angeles", new Date("2026-10-03T05:00:00Z"))).toBe("2026-10-02");
  });

  test("falls back to UTC for a zone it does not know", () => {
    expect(localDay("Mars/Olympus", new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-03");
  });
});

describe("planDeliveries", () => {
  test("merges a recipient's shared and own paws into one delivery", () => {
    const a = row({ kind: "paw_shared", goal_id: RUN });
    const b = row({ kind: "paw_own", goal_id: READ });
    const { deliveries, skips } = planDeliveries([a, b], ctx());
    expect(skips).toEqual([]);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.rowIds.sort()).toEqual([a.id, b.id].sort());
    expect(deliveries[0]?.message.body).toBe("Mia pawed 2 goals: Morning run and Read 20 pages");
    expect(deliveries[0]?.message.tag).toBe("paws-2026-10-03");
    expect(deliveries[0]?.ttlSeconds).toBe(43_200);
  });

  test("the same goal pawed twice in a batch is named once", () => {
    const a = row({ goal_id: RUN });
    const b = row({ goal_id: RUN });
    const { deliveries } = planDeliveries([a, b], ctx());
    expect(deliveries[0]?.message.body).toBe("Mia pawed 🏃 Morning run for you both");
    expect(deliveries[0]?.rowIds).toHaveLength(2);
  });

  test("a muted kind is skipped, an unmuted one in the same batch still goes", () => {
    const a = row({ kind: "paw_own", goal_id: READ });
    const b = row({ kind: "paw_shared", goal_id: RUN });
    const prefs = new Map([[ARI, { timezone: "UTC", muted: ["paw_own" as const] }]]);
    const { deliveries, skips } = planDeliveries([a, b], ctx({ prefs }));
    expect(skips).toEqual([{ id: a.id, reason: "muted" }]);
    expect(deliveries[0]?.rowIds).toEqual([b.id]);
  });

  test("each non-paw row is its own delivery", () => {
    const heart = row({ kind: "heart", goal_id: RUN });
    const seal = row({ kind: "seal", goal_id: RUN });
    const { deliveries } = planDeliveries([heart, seal], ctx());
    expect(deliveries.map((d) => d.message.body)).toEqual([
      "Mia ❤️ your 🏃 Morning run paw",
      "Mia sealed 🏃 Morning run",
    ]);
  });

  test("a milestone on an own goal names the actor", () => {
    const done = row({ kind: "milestone_done", goal_id: READ });
    expect(planDeliveries([done], ctx()).deliveries[0]?.message.body).toBe(
      "Mia finished 📚 Read 20 pages! 🎉",
    );
  });

  test("an actor with no member row is 'Your partner'", () => {
    const joined = row({ kind: "partner_joined", goal_id: null, actor_id: "gone" });
    expect(planDeliveries([joined], ctx()).deliveries[0]?.message.body).toBe(
      "Your partner joined your den 🐶",
    );
  });

  test("a goal that vanished is skipped, not sent blank", () => {
    const lost = row({ kind: "seal", goal_id: "missing" });
    expect(planDeliveries([lost], ctx()).skips).toEqual([{ id: lost.id, reason: "missing goal" }]);
  });

  test("a reminder with paws left goes with a short TTL", () => {
    const r = row({ kind: "reminder", actor_id: null, goal_id: null });
    const { deliveries } = planDeliveries([r], ctx({ openGoals: new Map([[ARI, 2]]) }));
    expect(deliveries[0]?.message.body).toBe("Today's paws are waiting — 2 left");
    expect(deliveries[0]?.ttlSeconds).toBe(7_200);
  });

  test("a reminder with nothing open any more is skipped", () => {
    const r = row({ kind: "reminder", actor_id: null, goal_id: null });
    expect(planDeliveries([r], ctx({ openGoals: new Map([[ARI, 0]]) })).skips).toEqual([
      { id: r.id, reason: "nothing open" },
    ]);
  });

  test("a recipient with no prefs row is treated as UTC with nothing muted", () => {
    const r = row({ recipient_id: MIA, actor_id: ARI, kind: "heart", goal_id: RUN });
    const { deliveries } = planDeliveries([r], ctx());
    expect(deliveries[0]?.message.body).toBe("Ari ❤️ your 🏃 Morning run paw");
    expect(deliveries[0]?.message.tag).toBe("heart-2026-10-03");
  });
});

describe("isPushServiceEndpoint", () => {
  test("accepts the known push services", () => {
    expect(isPushServiceEndpoint("https://web.push.apple.com/QGuMCHanFake")).toBe(true);
    expect(isPushServiceEndpoint("https://1-edge.push.apple.com/QGuMCHanFake")).toBe(true);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(
      true,
    );
    expect(isPushServiceEndpoint("https://wns2-par02p.notify.windows.com/w/abc")).toBe(true);
  });

  test("rejects non-https, unparseable, and look-alike hosts", () => {
    expect(isPushServiceEndpoint("http://web.push.apple.com/x")).toBe(false);
    expect(isPushServiceEndpoint("https://evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://web.push.apple.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("not a url")).toBe(false);
  });
});

describe("settle", () => {
  test("any 2xx device means sent", () => {
    expect(settle([410, 201], 1)).toBe("sent");
  });

  test("every device gone means no devices", () => {
    expect(settle([404, 410], 1)).toBe("no-devices");
    expect(settle([], 1)).toBe("no-devices");
  });

  test("a transient failure retries until the fifth attempt", () => {
    expect(settle([503], 4)).toBe("retry");
    expect(settle([0, 410], 4)).toBe("retry");
    expect(settle([429], 5)).toBe("give-up");
  });

  test("isGone", () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    expect(isGone(500)).toBe(false);
  });
});
