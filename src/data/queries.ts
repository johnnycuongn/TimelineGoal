import type { Couple, Member } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { coupleFromRow, memberFromRow } from "./mappers";

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
