// Browser-side domain model. Rows from Supabase are mapped into these shapes
// once (src/data/mappers.ts); everything else in the app speaks this language.

export const HORIZONS = ["day", "month", "quarter", "year"] as const;
export type Horizon = (typeof HORIZONS)[number];
export type MilestoneHorizon = Exclude<Horizon, "day">;

export type Mood =
  | "idle"
  | "happy"
  | "party"
  | "proud"
  | "sleepy"
  | "pout"
  | "love"
  | "drowsy"
  | "resting";

/**
 * The spec's partner palette, plus the ink that goes *on* each swatch.
 *
 * A swatch is a background in its own right, so its ink does not follow the theme's
 * --foreground: every dark-theme swatch is a pastel and needs dark ink. `ink` is
 * therefore picked per colour and per theme for WCAG 4.5:1 at 12–14 px (PartnerDot's
 * initial is 12 px). Measured ratios, white / #0F172A:
 *   light  rose 6.04/2.96 · teal 3.74/4.77 · blueberry 6.29/2.84 · tangerine 3.56/5.02
 *          grape 5.70/3.13 · lime 4.99/3.58 · sky 4.10/4.36
 *   dark   every swatch clears 4.5 only against dark ink (5.98 blueberry … 11.84 lime).
 * Light sky is the one swatch neither reaches 4.5 on, so it takes #000000 (5.12).
 * These are hexes rather than tokens on purpose: the palette itself lives here, and no
 * theme token is dark in both themes.
 */
export const PARTNER_COLORS = {
  rose: { light: "#BE185D", dark: "#F472B6", ink: { light: "#FFFFFF", dark: "#0F172A" } },
  teal: { light: "#0D9488", dark: "#2DD4BF", ink: { light: "#0F172A", dark: "#0F172A" } },
  blueberry: { light: "#4F46E5", dark: "#818CF8", ink: { light: "#FFFFFF", dark: "#0F172A" } },
  tangerine: { light: "#EA580C", dark: "#FB923C", ink: { light: "#0F172A", dark: "#0F172A" } },
  grape: { light: "#7C3AED", dark: "#A78BFA", ink: { light: "#FFFFFF", dark: "#0F172A" } },
  lime: { light: "#4D7C0F", dark: "#A3E635", ink: { light: "#FFFFFF", dark: "#0F172A" } },
  sky: { light: "#0284C7", dark: "#38BDF8", ink: { light: "#000000", dark: "#0F172A" } },
} as const;
export type PartnerColorKey = keyof typeof PARTNER_COLORS;
export const partnerColorKeys = Object.keys(PARTNER_COLORS) as PartnerColorKey[];
export const DEFAULT_COLOR_A: PartnerColorKey = "rose";

export function isPartnerColorKey(value: string): value is PartnerColorKey {
  return value in PARTNER_COLORS;
}

function isNameWithin(value: string, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max;
}

/**
 * True when both names on the Us form are ones the database will accept.
 * `couples.pup_name` and `members.display_name` both carry length checks, so an
 * empty field has to be caught before the save, not after.
 */
export function denNamesReady(pupName: string, displayName: string): boolean {
  return isNameWithin(pupName, PUP_NAME_MAX) && isNameWithin(displayName, DISPLAY_NAME_MAX);
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
  /** Check-ins from the fetch's floor day onwards (`checkinFloor`), newest first. */
  checkins: CheckIn[];
}

export function isSealed(goal: Goal, memberIds: string[]): boolean {
  return goal.owner === SHARED_OWNER && memberIds.every((m) => goal.seals[m]);
}
