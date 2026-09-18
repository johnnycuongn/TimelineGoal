import { describe, expect, test } from "vitest";
import { derivePersistentMood } from "./mood";

const at = (h: number) => new Date(2026, 8, 17, h, 0, 0);

describe("derivePersistentMood", () => {
  test("idle by default, including a brand-new couple in the evening", () => {
    expect(derivePersistentMood({ lastCheckInAt: null, todayCount: 0, now: at(21) })).toBe("idle");
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
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(21) })).toBe("pout");
  });
});
