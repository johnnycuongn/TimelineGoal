import type { Tables } from "@/lib/database.types";
import {
  type CheckIn,
  type Couple,
  type Goal,
  isPartnerColorKey,
  type Member,
  SHARED_OWNER,
} from "@/lib/domain";

export type MemberRow = Tables<"members">;
export type CoupleRow = Tables<"couples">;
export type GoalRow = Tables<"goals">;
export type SealRow = Tables<"goal_seals">;
export type CheckinRow = Tables<"checkins">;
export type ReactionRow = Tables<"reactions">;

export function memberFromRow(row: MemberRow): Member {
  return {
    id: row.user_id,
    displayName: row.display_name,
    color: isPartnerColorKey(row.color) ? row.color : "rose",
  };
}

export function coupleFromRow(row: CoupleRow): Couple {
  return {
    id: row.id,
    pupName: row.pup_name,
    anniversary: row.anniversary,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function goalFromRow(row: GoalRow, seals: SealRow[]): Goal {
  const mine = seals.filter((s) => s.goal_id === row.id);
  const sealMap: Record<string, string> = {};
  for (const s of mine) {
    sealMap[s.user_id] = s.sealed_at;
  }
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    charm: row.charm,
    horizon: row.horizon,
    owner: row.owner_id ?? SHARED_OWNER,
    period: row.period,
    targetUnits: row.target_units,
    parentGoalId: row.parent_goal_id,
    seals: sealMap,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function checkinFromRow(row: CheckinRow, reactions: ReactionRow[]): CheckIn {
  const mine: Record<string, "heart"> = {};
  for (const r of reactions) {
    if (r.checkin_id === row.id) {
      mine[r.user_id] = "heart";
    }
  }
  return {
    id: row.id,
    coupleId: row.couple_id,
    goalId: row.goal_id,
    uid: row.user_id,
    day: row.day,
    at: row.at,
    horizon: row.horizon,
    reactions: mine,
  };
}
