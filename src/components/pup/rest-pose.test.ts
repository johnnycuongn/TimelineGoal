import { describe, expect, test } from "vitest";
import {
  BREATH_PERIOD_S,
  breathingDepth,
  nextStir,
  REST_DEPTH,
  REST_DRIFT_X,
  restShift,
  STIR_DEPTH,
} from "./rest-pose";

describe("breathingDepth", () => {
  test("starts at the depth it was handed", () => {
    expect(breathingDepth(1, 0)).toBe(1);
    expect(breathingDepth(0.55, 0)).toBe(0.55);
  });

  test("lifts by a fraction of the depth at the top of the breath", () => {
    // Half a period in, the wave is at 1: the deepest part of the rise.
    expect(breathingDepth(1, BREATH_PERIOD_S / 2)).toBeCloseTo(0.98, 5);
    expect(breathingDepth(0.5, BREATH_PERIOD_S / 2)).toBeCloseTo(0.49, 5);
  });

  test("comes back round every period", () => {
    expect(breathingDepth(1, BREATH_PERIOD_S)).toBeCloseTo(1, 5);
  });

  test("never leaves the band between the depth and 2% under it", () => {
    for (let t = 0; t < 12; t += 0.13) {
      const d = breathingDepth(1, t);
      expect(d).toBeLessThanOrEqual(1);
      expect(d).toBeGreaterThanOrEqual(0.98 - 1e-9);
    }
  });

  test("a standing pup does not breathe through this", () => {
    expect(breathingDepth(0, 1.7)).toBe(0);
  });
});

describe("nextStir", () => {
  test("the low roll is the short end of both windows", () => {
    expect(nextStir(() => 0)).toEqual({ afterMs: 14_000, holdMs: 2500 });
  });

  test("the high roll is the long end", () => {
    expect(nextStir(() => 1)).toEqual({ afterMs: 26_000, holdMs: 4500 });
  });

  test("every roll lands inside the windows", () => {
    let seed = 0.017;
    for (let i = 0; i < 200; i += 1) {
      seed = (seed * 9301 + 0.49297) % 1;
      const { afterMs, holdMs } = nextStir(() => seed);
      expect(afterMs).toBeGreaterThanOrEqual(14_000);
      expect(afterMs).toBeLessThanOrEqual(26_000);
      expect(holdMs).toBeGreaterThanOrEqual(2500);
      expect(holdMs).toBeLessThanOrEqual(4500);
    }
  });
});

describe("restShift", () => {
  test("facing the camera, the whole correction is sideways", () => {
    const { x, z } = restShift(1, 0);
    expect(x).toBeCloseTo(REST_DRIFT_X, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  test("a quarter turn puts the whole correction into depth", () => {
    const { x, z } = restShift(1, Math.PI / 2);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-REST_DRIFT_X, 6);
  });

  test("turned right round, the correction comes back mirrored", () => {
    const { x, z } = restShift(1, Math.PI);
    expect(x).toBeCloseTo(-REST_DRIFT_X, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  test("the correction keeps its length whichever way he faces", () => {
    for (const turn of [0.3, 1.1, 2.7, -0.8, 5.9]) {
      const { x, z } = restShift(1, turn);
      expect(Math.hypot(x, z)).toBeCloseTo(Math.abs(REST_DRIFT_X), 6);
    }
  });

  test("it fades in with the depth, so a standing pup is never moved", () => {
    // Signed zeroes: the drift is negative, so a depth of 0 gives -0 on one axis.
    const standing = restShift(0, 1.2);
    expect(Math.hypot(standing.x, standing.z)).toBe(0);
    const half = restShift(0.5, 0.4);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(Math.abs(REST_DRIFT_X) / 2, 6);
  });
});

describe("the bedtime depths", () => {
  test("drowsy is a crouch, resting is flat out, a stir is in between", () => {
    expect(REST_DEPTH.drowsy).toBeLessThan(REST_DEPTH.resting);
    expect(STIR_DEPTH).toBeGreaterThan(REST_DEPTH.drowsy);
    expect(STIR_DEPTH).toBeLessThan(REST_DEPTH.resting);
  });
});
