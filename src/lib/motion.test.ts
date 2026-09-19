import { describe, expect, test } from "vitest";
import { PRESS_SCALE, springs, timings } from "@/lib/motion";

/**
 * The spec's motion tokens, written out. These assertions are the numbers from the
 * plan's global constraints — not relationships between the constants, which can never
 * fail for a reason anyone cares about — so any drift from the spec fails here.
 */
describe("motion tokens are the spec's numbers", () => {
  test("springs", () => {
    expect(springs.default).toEqual({ type: "spring", damping: 15, stiffness: 150, mass: 1 });
    expect(springs.press).toEqual({ type: "spring", damping: 18, stiffness: 320, mass: 0.7 });
    expect(springs.bouncy).toEqual({ type: "spring", damping: 9, stiffness: 180, mass: 0.9 });
  });

  test("timings: enter 250ms, exit 170ms, stagger 40ms, reduced-motion fade 120ms", () => {
    expect(timings).toEqual({
      enterMs: 250,
      exitMs: 170,
      staggerMs: 40,
      reducedMotionFadeMs: 120,
    });
  });

  test("press scale", () => {
    expect(PRESS_SCALE).toBe(0.96);
  });
});
