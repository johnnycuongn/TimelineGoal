import { describe, expect, test } from "vitest";
import { derivePersistentMood } from "./mood";

const at = (h: number) => new Date(2026, 8, 17, h, 0, 0);

describe("derivePersistentMood", () => {
  test("idle by default, including a brand-new couple during the day", () => {
    expect(derivePersistentMood({ lastCheckInAt: null, todayCount: 0, now: at(19) })).toBe("idle");
  });

  test("sleepy after 20:00 local with nothing stamped today", () => {
    const recent = new Date(2026, 8, 16, 12).toISOString();
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 0, now: at(20) })).toBe(
      "sleepy",
    );
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 1, now: at(20) })).toBe(
      "idle",
    );
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 0, now: at(19) })).toBe(
      "idle",
    );
  });

  test("pout after three quiet days, and it beats sleepy", () => {
    const old = new Date(2026, 8, 13, 12).toISOString();
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(10) })).toBe("pout");
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(19) })).toBe("pout");
  });
});

describe("the pup's bedtime", () => {
  const stamped = new Date(2026, 8, 17, 12).toISOString();

  test("drowsy for the 21:00 hour, then down for the night", () => {
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 1, now: at(21) })).toBe(
      "drowsy",
    );
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 1, now: at(22) })).toBe(
      "resting",
    );
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 1, now: at(2) })).toBe(
      "resting",
    );
  });

  test("up again at 06:00", () => {
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 1, now: at(5) })).toBe(
      "resting",
    );
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 1, now: at(6) })).toBe(
      "idle",
    );
  });

  // Bedtime is the clock, not a reproach, so it needs no check-in history behind it —
  // unlike sleepy and pout, which a brand-new den never sees.
  test("a brand-new den still puts the pup to bed", () => {
    expect(derivePersistentMood({ lastCheckInAt: null, todayCount: 0, now: at(21) })).toBe(
      "drowsy",
    );
    expect(derivePersistentMood({ lastCheckInAt: null, todayCount: 0, now: at(23) })).toBe(
      "resting",
    );
  });

  test("sleepy keeps the 20:00 hour to itself, and pout outranks bedtime", () => {
    expect(derivePersistentMood({ lastCheckInAt: stamped, todayCount: 0, now: at(20) })).toBe(
      "sleepy",
    );
    const old = new Date(2026, 8, 13, 12).toISOString();
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(23) })).toBe("pout");
  });
});
