import { createClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";
import { friendlyError } from "@/lib/errors";

const OFFLINE = "We couldn't reach the den. Check your connection and try again.";

// A client pointed at a port nothing can answer: the same failure an offline phone has,
// shaped by the real postgrest-js rather than a hand-written stand-in.
vi.mock("@/lib/supabase", () => ({
  supabase: createClient("http://127.0.0.1:1", "not-a-real-key"),
}));

const { sendHeart, stamp, unstampHabit } = await import("./goal-mutations");

const COUPLE_ID = "11111111-1111-1111-1111-111111111111";
const GOAL_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";
const CHECKIN_ID = "44444444-4444-4444-4444-444444444444";
const DAY = "2026-09-19";

describe("an unreachable den", () => {
  test("postgrest reports a failed fetch as a plain object, not an Error", async () => {
    const { supabase } = await import("@/lib/supabase");
    // An insert, not a select: postgrest retries a failed GET, which would only slow the test.
    const { error } = await supabase.from("checkins").insert({
      couple_id: COUPLE_ID,
      goal_id: GOAL_ID,
      user_id: USER_ID,
      day: DAY,
      horizon: "day",
    });
    expect(error).not.toBeInstanceOf(Error);
    expect(error?.message).toContain("fetch");
    // Which is why a toast cannot read `error.message` and hope for readable copy.
    expect(friendlyError(error)).toBe(OFFLINE);
  });

  test("stamping a paw offline says so in the pup's voice", async () => {
    await expect(
      stamp({ coupleId: COUPLE_ID, goalId: GOAL_ID, uid: USER_ID, day: DAY }),
    ).rejects.toThrow(OFFLINE);
  });

  test("undoing a paw offline says so in the pup's voice", async () => {
    await expect(unstampHabit({ goalId: GOAL_ID, uid: USER_ID, day: DAY })).rejects.toThrow(
      OFFLINE,
    );
  });

  test("sending a heart offline says so in the pup's voice", async () => {
    await expect(
      sendHeart({ checkinId: CHECKIN_ID, uid: USER_ID, coupleId: COUPLE_ID }),
    ).rejects.toThrow(OFFLINE);
  });
});
