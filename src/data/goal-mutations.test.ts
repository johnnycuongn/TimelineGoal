import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GoalInput } from "@/lib/domain";
import { createGoal } from "./goal-mutations";

const client = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { single, select, insert, from };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: client.from } }));

const COUPLE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

function input(partial: Partial<GoalInput>): GoalInput {
  return {
    title: "Something",
    charm: null,
    horizon: "month",
    owner: USER_ID,
    period: "2026-11",
    targetUnits: 3,
    parentGoalId: null,
    ...partial,
  };
}

beforeEach(() => {
  client.from.mockClear();
  client.insert.mockClear();
  client.single.mockResolvedValue({
    data: {
      id: "g1",
      couple_id: COUPLE_ID,
      title: "Something",
      charm: null,
      horizon: "month",
      owner_id: USER_ID,
      period: "2026-11",
      target_units: 3,
      parent_goal_id: null,
      created_by: USER_ID,
      created_at: "2026-09-20T00:00:00.000Z",
      archived_at: null,
    },
    error: null,
  });
});

describe("createGoal", () => {
  test("writes a future period instead of deriving one from today", async () => {
    await createGoal({
      coupleId: COUPLE_ID,
      uid: USER_ID,
      input: input({ horizon: "quarter", period: "2027-Q1" }),
    });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: "2027-Q1", horizon: "quarter", target_units: 3 }),
    );
  });

  test("a habit is written with no period and no target", async () => {
    await createGoal({
      coupleId: COUPLE_ID,
      uid: USER_ID,
      input: input({ horizon: "day", period: null, targetUnits: 5 }),
    });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: null, target_units: null }),
    );
  });

  test("a one-off keeps its day and still takes no target", async () => {
    await createGoal({
      coupleId: COUPLE_ID,
      uid: USER_ID,
      input: input({ horizon: "day", period: "2026-11-14", targetUnits: 5 }),
    });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: "2026-11-14", target_units: null }),
    );
  });

  test("refuses a period that doesn't match the horizon, without touching the database", async () => {
    await expect(
      createGoal({ coupleId: COUPLE_ID, uid: USER_ID, input: input({ period: "2026-11-14" }) }),
    ).rejects.toThrow("That date doesn't match the kind of goal.");
    expect(client.from).not.toHaveBeenCalled();
  });

  test("refuses a milestone with no period at all", async () => {
    await expect(
      createGoal({ coupleId: COUPLE_ID, uid: USER_ID, input: input({ period: null }) }),
    ).rejects.toThrow("That date doesn't match the kind of goal.");
    expect(client.from).not.toHaveBeenCalled();
  });

  test("refuses a day that never happened", async () => {
    await expect(
      createGoal({
        coupleId: COUPLE_ID,
        uid: USER_ID,
        input: input({ horizon: "day", period: "2026-02-30" }),
      }),
    ).rejects.toThrow("That date doesn't match the kind of goal.");
    expect(client.from).not.toHaveBeenCalled();
  });
});
