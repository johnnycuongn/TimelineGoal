import type { PartnerColorKey } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { normalizeShareCode } from "@/lib/share-code";
import { supabase } from "@/lib/supabase";

function wrap(error: unknown): Error {
  return new Error(friendlyError(error), { cause: error });
}

export async function createDen(
  displayName: string,
  color: PartnerColorKey,
): Promise<{ coupleId: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc("create_den", {
    p_display_name: displayName.trim(),
    p_color: color,
  });
  if (error) {
    throw wrap(error);
  }
  const row = data[0];
  if (!row) {
    throw new Error("Could not create the den. Try again?");
  }
  return { coupleId: row.couple_id, inviteCode: row.invite_code };
}

export async function joinDen(
  code: string,
  displayName: string,
  color: PartnerColorKey,
): Promise<string> {
  const { data, error } = await supabase.rpc("join_den", {
    p_code: normalizeShareCode(code),
    p_display_name: displayName.trim(),
    p_color: color,
  });
  if (error) {
    throw wrap(error);
  }
  return data;
}

export async function mintInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc("mint_invite_code");
  if (error) {
    throw wrap(error);
  }
  return data;
}

export async function updateCouple(
  coupleId: string,
  patch: { pupName?: string; anniversary?: string | null },
): Promise<void> {
  const row: { pup_name?: string; anniversary?: string | null } = {};
  if (patch.pupName !== undefined) {
    row.pup_name = patch.pupName.trim();
  }
  if (patch.anniversary !== undefined) {
    row.anniversary = patch.anniversary;
  }
  const { error } = await supabase.from("couples").update(row).eq("id", coupleId);
  if (error) {
    throw wrap(error);
  }
}

export async function updateMember(
  userId: string,
  patch: { displayName?: string; color?: PartnerColorKey },
): Promise<void> {
  const row: { display_name?: string; color?: string } = {};
  if (patch.displayName !== undefined) {
    row.display_name = patch.displayName.trim();
  }
  if (patch.color !== undefined) {
    row.color = patch.color;
  }
  const { error } = await supabase.from("members").update(row).eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}
