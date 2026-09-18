import { describe, expect, test } from "vitest";
import { IDLE_POOL, pickIdle } from "./idle-scheduler";

describe("pickIdle", () => {
  test("weights: random 0 picks the first, random just under 1 picks the last", () => {
    expect(pickIdle(() => 0).clip).toBe("Idle");
    expect(pickIdle(() => 0.999_999).clip).toBe("Walk");
  });

  test("hold is inside the clip's window in ms", () => {
    const { clip, holdMs } = pickIdle(() => 0.5);
    const entry = IDLE_POOL.find((e) => e[0] === clip);
    expect(entry).toBeDefined();
    if (entry) {
      expect(holdMs).toBeGreaterThanOrEqual(entry[2] * 1000);
      expect(holdMs).toBeLessThanOrEqual(entry[3] * 1000);
    }
  });

  test("over many draws every clip shows up", () => {
    const seen = new Set<string>();
    let seed = 1;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let i = 0; i < 500; i += 1) {
      seen.add(pickIdle(random).clip);
    }
    expect([...seen].sort()).toEqual(["Eating", "Idle", "Idle_2", "Walk"]);
  });
});
