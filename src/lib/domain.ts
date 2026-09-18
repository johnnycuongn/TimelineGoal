// Browser-side domain model. Rows from Supabase are mapped into these shapes
// once (src/data/mappers.ts); everything else in the app speaks this language.

export const HORIZONS = ["day", "month", "quarter", "year"] as const;
export type Horizon = (typeof HORIZONS)[number];
export type MilestoneHorizon = Exclude<Horizon, "day">;

export type Mood = "idle" | "happy" | "party" | "proud" | "sleepy" | "pout" | "love";

export const PARTNER_COLORS = {
  rose: { light: "#BE185D", dark: "#F472B6" },
  teal: { light: "#0D9488", dark: "#2DD4BF" },
  blueberry: { light: "#4F46E5", dark: "#818CF8" },
  tangerine: { light: "#EA580C", dark: "#FB923C" },
  grape: { light: "#7C3AED", dark: "#A78BFA" },
  lime: { light: "#4D7C0F", dark: "#A3E635" },
  sky: { light: "#0284C7", dark: "#38BDF8" },
} as const;
export type PartnerColorKey = keyof typeof PARTNER_COLORS;
export const partnerColorKeys = Object.keys(PARTNER_COLORS) as PartnerColorKey[];
export const DEFAULT_COLOR_A: PartnerColorKey = "rose";

export function isPartnerColorKey(value: string): value is PartnerColorKey {
  return value in PARTNER_COLORS;
}

/** `owner` on a Goal is a member id or this sentinel. */
export const SHARED_OWNER = "shared";
export const GOAL_TITLE_MAX = 80;
export const GOAL_TARGET_MIN = 1;
export const GOAL_TARGET_MAX = 20;
export const PUP_NAME_MAX = 24;
export const DISPLAY_NAME_MAX = 40;
export const SHARE_CODE_LENGTH = 6;
export const TICKER_LIMIT = 10;
export const MAX_MEMBERS = 2;

export interface Member {
  id: string;
  displayName: string;
  color: PartnerColorKey;
}

export interface Couple {
  id: string;
  pupName: string | null;
  anniversary: string | null;
  inviteCode: string | null;
  createdBy: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  coupleId: string;
  title: string;
  charm: string | null;
  horizon: Horizon;
  /** A member id, or "shared". */
  owner: string;
  /** Milestones only; null for daily habits. */
  period: string | null;
  /** Milestones only; null for daily habits. */
  targetUnits: number | null;
  parentGoalId: string | null;
  /** Shared goals: member id -> ISO date they pressed the wax. */
  seals: Record<string, string>;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface GoalInput {
  title: string;
  charm: string | null;
  horizon: Horizon;
  owner: string;
  targetUnits: number | null;
  parentGoalId: string | null;
}

export interface CheckIn {
  id: string;
  coupleId: string;
  goalId: string;
  uid: string;
  day: string;
  at: string;
  horizon: Horizon;
  reactions: Record<string, "heart">;
}

/** Ticker entry: a check-in joined with its goal. */
export interface TickerItem {
  checkinId: string;
  uid: string;
  goalId: string;
  goalTitle: string;
  charm: string | null;
  at: string;
  reactions: Record<string, "heart">;
}

/** Everything one fetch returns for a couple. */
export interface CoupleData {
  couple: Couple;
  members: Member[];
  goals: Goal[];
  /** Check-ins since 1 January of the viewed year, newest first. */
  checkins: CheckIn[];
}

export function isSealed(goal: Goal, memberIds: string[]): boolean {
  return goal.owner === SHARED_OWNER && memberIds.every((m) => goal.seals[m]);
}
