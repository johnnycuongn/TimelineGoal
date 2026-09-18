import type { Couple, CoupleData, Member } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { checkinFromRow, coupleFromRow, goalFromRow, memberFromRow } from "./mappers";

export interface Me {
  userId: string;
  couple: Couple | null;
  members: Member[];
}

/** Who am I and which den am I in. RLS returns only my own den's rows. */
export async function fetchMe(userId: string): Promise<Me> {
  const { data: members, error } = await supabase.from("members").select("*").order("joined_at");
  if (error) {
    throw error;
  }
  const self = members.find((m) => m.user_id === userId);
  if (!self) {
    return { userId, couple: null, members: [] };
  }
  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("*")
    .eq("id", self.couple_id)
    .single();
  if (coupleError) {
    throw coupleError;
  }
  return { userId, couple: coupleFromRow(couple), members: members.map(memberFromRow) };
}

/** Everything a den needs, from 1 January of the viewed year. Six small queries, in parallel. */
export async function fetchCoupleData(coupleId: string, fromDay: string): Promise<CoupleData> {
  const [couple, members, goals, seals, checkins, reactions] = await Promise.all([
    supabase.from("couples").select("*").eq("id", coupleId).single(),
    supabase.from("members").select("*").eq("couple_id", coupleId).order("joined_at"),
    supabase.from("goals").select("*").eq("couple_id", coupleId).order("created_at"),
    supabase.from("goal_seals").select("*").eq("couple_id", coupleId),
    supabase
      .from("checkins")
      .select("*")
      .eq("couple_id", coupleId)
      .gte("day", fromDay)
      .order("at", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("reactions").select("*").eq("couple_id", coupleId),
  ]);
  for (const result of [couple, members, goals, seals, checkins, reactions]) {
    if (result.error) {
      throw result.error;
    }
  }
  if (!couple.data) {
    throw new Error("This den is gone.");
  }
  const sealRows = seals.data ?? [];
  const reactionRows = reactions.data ?? [];
  return {
    couple: coupleFromRow(couple.data),
    members: (members.data ?? []).map(memberFromRow),
    goals: (goals.data ?? []).map((g) => goalFromRow(g, sealRows)),
    checkins: (checkins.data ?? []).map((c) => checkinFromRow(c, reactionRows)),
  };
}
