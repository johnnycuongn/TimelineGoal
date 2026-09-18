import { describe, expect, test } from "vitest";
import { PRESS_SCALE, springs, timings } from "@/lib/motion";

const SPRING_NAMES = ["default", "press", "bouncy"] as const;

describe("springs", () => {
  test("exposes exactly the three named springs", () => {
    expect(Object.keys(springs).sort()).toEqual([...SPRING_NAMES].sort());
  });

  test("every spring is a spring with positive physics", () => {
    for (const name of SPRING_NAMES) {
      const spring = springs[name];
      expect(spring.type).toBe("spring");
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.mass).toBeGreaterThan(0);
    }
  });

  test("press is the snappiest spring", () => {
    // Presses must settle faster than layout motion, or taps feel laggy.
    expect(springs.press.stiffness).toBeGreaterThan(springs.default.stiffness);
    expect(springs.press.mass).toBeLessThan(springs.default.mass);
  });

  test("bouncy overshoots more than default", () => {
    // Lower damping at comparable stiffness is what produces the celebratory bounce.
    expect(springs.bouncy.damping).toBeLessThan(springs.default.damping);
  });
});

describe("timings", () => {
  test("all timings are positive whole milliseconds", () => {
    for (const value of Object.values(timings)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  test("exit is quicker than enter", () => {
    expect(timings.exitMs).toBeLessThan(timings.enterMs);
  });

  test("stagger is short enough that a list settles within one enter", () => {
    expect(timings.staggerMs).toBeLessThan(timings.exitMs);
  });

  test("the reduced-motion fade is the shortest visible timing", () => {
    expect(timings.reducedMotionFadeMs).toBeLessThan(timings.exitMs);
  });
});

describe("PRESS_SCALE", () => {
  test("shrinks on press without collapsing the target", () => {
    expect(PRESS_SCALE).toBeGreaterThan(0.9);
    expect(PRESS_SCALE).toBeLessThan(1);
  });
});
