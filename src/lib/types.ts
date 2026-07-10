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

export const COUPLES = 'couples';
export const USERS = 'users';
export const INVITES = 'invites';
