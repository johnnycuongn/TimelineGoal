import { describe, expect, test } from "vitest";
import {
  initialMoodState,
  type MoodState,
  moodReducer,
  TRANSIENT_MAX_MS,
} from "./pup-mood-context";

/** What the provider exposes as `mood`. */
const moodOf = (state: MoodState) => state.transient ?? state.persistent;

describe("moodReducer", () => {
  test("trigger latches the transient mood and bumps the nonce", () => {
    const next = moodReducer(initialMoodState, { type: "trigger", mood: "party" });
    expect(next.transient).toBe("party");
    expect(next.nonce).toBe(1);
    expect(moodOf(next)).toBe("party");
  });

  test("the same mood again bumps the nonce so the effect re-runs", () => {
    const once = moodReducer(initialMoodState, { type: "trigger", mood: "happy" });
    const twice = moodReducer(once, { type: "trigger", mood: "happy" });
    expect(twice.transient).toBe("happy");
    expect(twice.nonce).toBe(2);
  });

  test("settle clears the transient and uncovers the persistent mood", () => {
    const sleepy = moodReducer(initialMoodState, { type: "persistent", mood: "sleepy" });
    const partying = moodReducer(sleepy, { type: "trigger", mood: "party" });
    expect(moodOf(partying)).toBe("party");
    const settled = moodReducer(partying, { type: "settle" });
    expect(settled.transient).toBeNull();
    expect(moodOf(settled)).toBe("sleepy");
    // The nonce is untouched: settling is not a new trigger.
    expect(settled.nonce).toBe(partying.nonce);
  });

  test("settle with nothing latched is a no-op, so it is safe to dispatch freely", () => {
    // The reduced-motion branch of PupModel settles unconditionally; an
    // identical state keeps React from re-rendering and re-running that effect.
    expect(moodReducer(initialMoodState, { type: "settle" })).toBe(initialMoodState);
  });

  test("setting the persistent mood it already has is a no-op", () => {
    expect(moodReducer(initialMoodState, { type: "persistent", mood: "idle" })).toBe(
      initialMoodState,
    );
    const pouting = moodReducer(initialMoodState, { type: "persistent", mood: "pout" });
    expect(pouting.persistent).toBe("pout");
  });

  test("a persistent change while a transient is latched stays masked until it settles", () => {
    const partying = moodReducer(initialMoodState, { type: "trigger", mood: "party" });
    const pouting = moodReducer(partying, { type: "persistent", mood: "pout" });
    expect(moodOf(pouting)).toBe("party");
    expect(moodOf(moodReducer(pouting, { type: "settle" }))).toBe("pout");
  });
});

describe("TRANSIENT_MAX_MS", () => {
  test("is a finite bound, so a transient mood cannot latch for the session", () => {
    expect(Number.isFinite(TRANSIENT_MAX_MS)).toBe(true);
    expect(TRANSIENT_MAX_MS).toBeGreaterThan(0);
    // Long enough that the model's own clip-length settle normally wins, short
    // enough that a pup-less route recovers quickly.
    expect(TRANSIENT_MAX_MS).toBeLessThanOrEqual(5000);
  });
});
