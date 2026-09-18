import type { PostgrestError } from "@supabase/supabase-js";
import type { Couple, CoupleData, Member } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import {
  type CheckinRow,
  checkinFromRow,
  coupleFromRow,
  goalFromRow,
  memberFromRow,
  type ReactionRow,
} from "./mappers";

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

/** Rows per request. PostgREST caps a response at `db_max_rows`, 1000 on Supabase. */
const PAGE_SIZE = 1000;
/** 25 pages of paw prints is far past any real den; past that we say so instead of lying. */
const MAX_PAGES = 25;

type PagedSelect<Row> = (
  from: number,
  to: number,
) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null; count: number | null }>;

/**
 * Reads every row of a growing table. PostgREST truncates a response at `db_max_rows`
 * silently — no error, no flag — and with `at desc` the rows it drops are the oldest,
 * so a busy year would quietly lose its early history and under-count every milestone.
 * Ask for the exact count alongside the first page and keep paging until we hold it all.
 */
async function fetchAllRows<Row>(select: PagedSelect<Row>): Promise<Row[]> {
  const rows: Row[] = [];
  let total: number | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error, count } = await select(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    if (count !== null) {
      total = count;
    }
    const batch = data ?? [];
    for (const row of batch) {
      rows.push(row);
    }
    if (batch.length === 0 || (total !== null && rows.length >= total)) {
      return rows;
    }
  }
  throw new Error("This den has more paw prints than we can carry at once.");
}

/**
 * Everything a den needs, from 1 January of the viewed year. Six reads in parallel; the
 * two that grow with every stamp are paged so nothing is quietly left behind.
 */
export async function fetchCoupleData(coupleId: string, fromDay: string): Promise<CoupleData> {
  const [couple, members, goals, seals, checkins, reactions] = await Promise.all([
    supabase.from("couples").select("*").eq("id", coupleId).single(),
    supabase.from("members").select("*").eq("couple_id", coupleId).order("joined_at"),
    supabase.from("goals").select("*").eq("couple_id", coupleId).order("created_at"),
    supabase.from("goal_seals").select("*").eq("couple_id", coupleId),
    // Paged: two partners stamping a handful of shared habits pass 1000 rows inside a
    // year. The order is total (`id` breaks any tie on `at`), so the pages line up.
    fetchAllRows<CheckinRow>((from, to) =>
      supabase
        .from("checkins")
        .select("*", { count: "exact" })
        .eq("couple_id", coupleId)
        .gte("day", fromDay)
        .order("at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    ),
    // Paged too, and this one is not even bounded by the year: hearts accumulate for
    // the life of the den. Ordered by its primary key so the pages line up.
    fetchAllRows<ReactionRow>((from, to) =>
      supabase
        .from("reactions")
        .select("*", { count: "exact" })
        .eq("couple_id", coupleId)
        .order("checkin_id")
        .order("user_id")
        .range(from, to),
    ),
  ]);
  for (const result of [couple, members, goals, seals]) {
    if (result.error) {
      throw result.error;
    }
  }
  if (!couple.data) {
    throw new Error("This den is gone.");
  }
  const sealRows = seals.data ?? [];
  return {
    couple: coupleFromRow(couple.data),
    members: (members.data ?? []).map(memberFromRow),
    goals: (goals.data ?? []).map((g) => goalFromRow(g, sealRows)),
    checkins: checkins.map((c) => checkinFromRow(c, reactions)),
  };
}
