import type { Goal, GoalInput, Horizon } from "@/lib/domain";
import { SHARED_OWNER } from "@/lib/domain";
import { friendlyError, isDuplicate } from "@/lib/errors";
import { periodFor } from "@/lib/periods";
import { supabase } from "@/lib/supabase";
import { goalFromRow } from "./mappers";

function wrap(error: unknown): Error {
  return new Error(friendlyError(error), { cause: error });
}

export async function createGoal(args: {
  coupleId: string;
  uid: string;
  input: GoalInput;
  today: string;
}): Promise<Goal> {
  const { coupleId, uid, input, today } = args;
  const milestone = input.horizon !== "day";
  const { data, error } = await supabase
    .from("goals")
    .insert({
      couple_id: coupleId,
      title: input.title.trim(),
      charm: input.charm?.trim() || null,
      horizon: input.horizon,
      owner_id: input.owner === SHARED_OWNER ? null : input.owner,
      period: input.horizon === "day" ? null : periodFor(input.horizon, today),
      target_units: milestone ? input.targetUnits : null,
      parent_goal_id: input.parentGoalId,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) {
    throw wrap(error);
  }
  // The creator's seal is added by a trigger; reflect it locally.
  const seals =
    input.owner === SHARED_OWNER
      ? [
          {
            goal_id: data.id,
            user_id: uid,
            couple_id: coupleId,
            sealed_at: new Date().toISOString(),
          },
        ]
      : [];
  return goalFromRow(data, seals);
}

export async function updateGoal(
  goalId: string,
  patch: {
    title?: string;
    charm?: string | null;
    targetUnits?: number;
    parentGoalId?: string | null;
    /** `null` brings a tucked-away goal back; the archive toast's undo uses it. */
    archivedAt?: string | null;
  },
): Promise<void> {
  const row: {
    title?: string;
    charm?: string | null;
    target_units?: number;
    parent_goal_id?: string | null;
    archived_at?: string | null;
  } = {};
  if (patch.title !== undefined) {
    row.title = patch.title.trim();
  }
  if (patch.charm !== undefined) {
    row.charm = patch.charm?.trim() || null;
  }
  if (patch.targetUnits !== undefined) {
    row.target_units = patch.targetUnits;
  }
  if (patch.parentGoalId !== undefined) {
    row.parent_goal_id = patch.parentGoalId;
  }
  if (patch.archivedAt !== undefined) {
    row.archived_at = patch.archivedAt;
  }
  const { error } = await supabase.from("goals").update(row).eq("id", goalId);
  if (error) {
    throw wrap(error);
  }
}

export async function archiveGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", goalId);
  if (error) {
    throw wrap(error);
  }
}

/** Press your wax on a shared goal. Pressing twice is a no-op. */
export async function sealGoal(goalId: string, uid: string, coupleId: string): Promise<void> {
  const { error } = await supabase
    .from("goal_seals")
    .insert({ goal_id: goalId, user_id: uid, couple_id: coupleId });
  if (error && !isDuplicate(error)) {
    throw wrap(error);
  }
}

/**
 * Stamp a paw. A second habit paw on the same day is reported, not thrown.
 * `horizon` is the goal's own: `checkins_validate` overwrites the column anyway, but
 * sending "day" for a milestone would collide on the daily unique index the moment
 * that assignment moved, and `isDuplicate` would swallow the stamp as "already done".
 */
export async function stamp(args: {
  coupleId: string;
  goalId: string;
  uid: string;
  day: string;
  horizon: Horizon;
}): Promise<{ created: boolean }> {
  const { error } = await supabase.from("checkins").insert({
    couple_id: args.coupleId,
    goal_id: args.goalId,
    user_id: args.uid,
    day: args.day,
    horizon: args.horizon,
  });
  if (error) {
    if (isDuplicate(error)) {
      return { created: false };
    }
    throw wrap(error);
  }
  return { created: true };
}

export async function unstampHabit(args: {
  goalId: string;
  uid: string;
  day: string;
}): Promise<void> {
  const { error } = await supabase
    .from("checkins")
    .delete()
    .eq("goal_id", args.goalId)
    .eq("user_id", args.uid)
    .eq("day", args.day);
  if (error) {
    throw wrap(error);
  }
}

export async function undoLastMilestonePaw(checkinId: string): Promise<void> {
  const { error } = await supabase.from("checkins").delete().eq("id", checkinId);
  if (error) {
    throw wrap(error);
  }
}

export async function sendHeart(args: {
  checkinId: string;
  uid: string;
  coupleId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("reactions")
    .insert({ checkin_id: args.checkinId, user_id: args.uid, couple_id: args.coupleId });
  if (error && !isDuplicate(error)) {
    throw wrap(error);
  }
}
