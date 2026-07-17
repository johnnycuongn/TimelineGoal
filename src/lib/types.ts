/**
 * Firestore data model (see docs/superpowers/specs/2026-07-10-timelinegoal-design.md).
 * These types mirror the documents stored under each collection.
 */

import type { Timestamp } from 'firebase/firestore';

/** A signed-in person. Doc id = Firebase Auth uid. */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  /** Set once the user creates or joins a couple. */
  coupleId?: string;
  createdAt: Timestamp;
}

/** The bulldog mascot — one per couple. */
export interface Bulldog {
  name: string;
  /** Cosmetic unlocks earned at milestones (empty at start). */
  unlockedCosmetics: string[];
  equipped: Record<string, string>;
}

/** The shared world for exactly two people. Doc id = coupleId. */
export interface Couple {
  members: string[]; // 1 while pairing, 2 once joined
  createdBy: string;
  createdAt: Timestamp;
  /** Each partner's chosen accent color, keyed by uid. */
  partnerColors: Record<string, string>;
  bulldog: Bulldog;
  anniversary?: Timestamp;
  /** The outstanding invite code while waiting for the partner; cleared once paired. */
  pendingInviteCode?: string | null;
}

/** A short-lived pairing code. Doc id = the code itself. */
export interface Invite {
  coupleId: string;
  createdBy: string;
  createdAt: Timestamp;
  /** Epoch ms after which the code should be considered expired. */
  expiresAt: number;
}

/** A goal at any horizon. Lives at couples/{coupleId}/goals/{goalId}. */
export interface Goal {
  title: string;
  /** User-chosen emoji charm decorating the goal (allowed as decoration, never UI icons). */
  charm: string;
  horizon: 'week' | 'quarter' | 'year';
  /** uidA | uidB for personal goals, or 'shared'. Always visible to both. */
  owner: string;
  /** Period the goal belongs to, e.g. 2026-W28 / 2026-Q3 / 2026. */
  period: string;
  /** How many paw prints fill the goal (1–10 for weekly). */
  targetUnits: number;
  /** Parent goal in the ladder (weekly → quarterly → yearly). */
  parentGoalId?: string | null;
  /**
   * Denormalized check-in counts by uid, incremented in the same batch as each
   * check-in (like `activity` — the append-only checkins/ stays the history).
   * Powers ladder rollups and the pulse ring without per-goal listeners.
   */
  progressBy?: Record<string, number>;
  /** Shared goals only: uid → when they pressed the wax. Sealed once both are in. */
  seals?: Record<string, Timestamp>;
  createdBy: string;
  createdAt: Timestamp;
}

/** Append-only check-in event. Lives at .../goals/{goalId}/checkins/{id}. */
export interface CheckIn {
  uid: string;
  at: Timestamp;
  note?: string;
}

/**
 * Denormalized activity feed for the partner ticker.
 * Lives at couples/{coupleId}/activity/{id}; written alongside each check-in.
 */
export interface Activity {
  type: 'checkin';
  uid: string;
  goalId: string;
  goalTitle: string;
  charm: string;
  at: Timestamp;
  /** Reactions keyed by reacting uid, e.g. { uidB: 'heart' }. */
  reactions?: Record<string, string>;
}

/**
 * A shared topic space — one cozy board per thing the couple is planning,
 * discussing or deciding. Lives at couples/{coupleId}/corners/{cornerId}.
 * No owner concept: either partner creates and edits, both always see it.
 */
export interface Corner {
  title: string;
  /** Up to 3 user-chosen emoji decorating the card (decoration, never UI icons). */
  charms: string[];
  /** Named soft tint for the card cover (resolved per light/dark theme at render). */
  tint: string;
  /** Storage path of the cover photo once one is set; tint shows until then. */
  coverPhoto?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  /** Bumped by chat + pins so the grid can order by "most alive". */
  lastActivityAt: Timestamp;
}

/**
 * One chat message inside a corner — an append-only keepsake, like check-ins.
 * Lives at couples/{coupleId}/corners/{cornerId}/messages/{id}.
 */
export interface CornerMessage {
  uid: string;
  text: string;
  at: Timestamp;
  /** One emoji reaction per partner, keyed by reacting uid. */
  reactions?: Record<string, string>;
  /** ⭐ stamped when the couple marks this message a decision (M4 polls item). */
  decided?: boolean;
  /** Set once the decision is converted into a Timeline goal. */
  linkedGoalId?: string | null;
}

export const COUPLES = 'couples';
export const USERS = 'users';
export const INVITES = 'invites';
export const GOALS = 'goals';
export const CHECKINS = 'checkins';
export const ACTIVITY = 'activity';
export const CORNERS = 'corners';
export const MESSAGES = 'messages';
