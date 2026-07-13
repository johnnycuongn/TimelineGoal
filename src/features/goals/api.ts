/**
 * Goals + check-ins data layer (pure functions over Firestore; emulator-tested).
 *
 * Check-ins are APPEND-ONLY events — progress is a count, history is a keepsake
 * (see .claude/skills/couple-growth). Each check-in also writes a denormalized
 * activity item that powers the partner ticker.
 */

import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { ACTIVITY, CHECKINS, COUPLES, GOALS, type Goal } from '@/lib/types';
import { currentPeriod, type Horizon } from './period';

export interface CreateGoalInput {
  coupleId: string;
  uid: string;
  title: string;
  charm: string;
  horizon: Horizon;
  /** 'shared' or the owner's uid. */
  owner: string;
  targetUnits: number;
  parentGoalId?: string | null;
  /** Defaults to the current period for the horizon. */
  period?: string;
}

/** Create a goal in the couple's world. Returns the new goal id. */
export async function createGoal(db: Firestore, input: CreateGoalInput): Promise<string> {
  const {
    coupleId,
    uid,
    title,
    charm,
    horizon,
    owner,
    targetUnits,
    parentGoalId = null,
    period = currentPeriod(horizon),
  } = input;

  const goalRef = doc(collection(db, COUPLES, coupleId, GOALS));
  const batch = writeBatch(db);
  batch.set(goalRef, {
    title: title.trim(),
    charm,
    horizon,
    owner,
    period,
    targetUnits: Math.max(1, Math.min(20, Math.round(targetUnits))),
    parentGoalId,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return goalRef.id;
}

/**
 * Record one check-in (one paw print) for a goal, plus a ticker activity item.
 * Append-only: simultaneous partner check-ins can never conflict.
 */
export async function checkIn(
  db: Firestore,
  params: {
    coupleId: string;
    uid: string;
    goalId: string;
    goalTitle: string;
    charm: string;
    note?: string;
  },
): Promise<void> {
  const { coupleId, uid, goalId, goalTitle, charm, note } = params;
  const batch = writeBatch(db);
  const checkinRef = doc(collection(db, COUPLES, coupleId, GOALS, goalId, CHECKINS));
  batch.set(checkinRef, {
    uid,
    at: serverTimestamp(),
    ...(note ? { note } : {}),
  });
  // Denormalized per-partner counter (increment = conflict-free, offline-safe);
  // ladder rollups and the pulse ring read this instead of listening per goal.
  batch.update(doc(db, COUPLES, coupleId, GOALS, goalId), {
    [`progressBy.${uid}`]: increment(1),
  });
  const activityRef = doc(collection(db, COUPLES, coupleId, ACTIVITY));
  batch.set(activityRef, {
    type: 'checkin',
    uid,
    goalId,
    goalTitle,
    charm,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Press your paw into the wax on a shared goal. Each partner writes only their
 * own key; the goal counts as sealed once both are present (see ladder.isSealed).
 */
export async function sealGoal(
  db: Firestore,
  params: { coupleId: string; goalId: string; uid: string },
): Promise<void> {
  const { coupleId, goalId, uid } = params;
  await updateDoc(doc(db, COUPLES, coupleId, GOALS, goalId), {
    [`seals.${uid}`]: serverTimestamp(),
  });
}

/** React to a partner's activity item (heart / highfive / proud). */
export async function reactToActivity(
  db: Firestore,
  params: { coupleId: string; activityId: string; uid: string; reaction: string },
): Promise<void> {
  const { coupleId, activityId, uid, reaction } = params;
  await updateDoc(doc(db, COUPLES, coupleId, ACTIVITY, activityId), {
    [`reactions.${uid}`]: reaction,
  });
}

/** Edit a goal's title/charm/target. */
export async function updateGoal(
  db: Firestore,
  coupleId: string,
  goalId: string,
  patch: Partial<Pick<Goal, 'title' | 'charm' | 'targetUnits' | 'parentGoalId'>>,
): Promise<void> {
  await updateDoc(doc(db, COUPLES, coupleId, GOALS, goalId), patch);
}

/** Delete a goal (its check-in history goes with it — confirm in UI first). */
export async function deleteGoal(db: Firestore, coupleId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(db, COUPLES, coupleId, GOALS, goalId));
}
