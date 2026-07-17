/**
 * Polls + ⭐ decisions data layer.
 *
 * A poll is a pin (type 'poll') on the corner's board: a question, 2–4 options,
 * and ONE vote per partner (changeable — deciding together, not outvoting;
 * see .claude/skills/couple-growth). When the couple lands on an answer they
 * stamp it ⭐ decided, and a decision can convert into a Timeline goal via
 * "Make it a goal →" (linkedGoalId points at the born goal).
 */

import {
  collection,
  doc,
  type Firestore,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { CORNERS, COUPLES, MESSAGES, PINS } from '@/lib/types';
import { scatterPosition } from './pins';

export const MAX_POLL_OPTIONS = 4;

/** Ask the corner a question. Returns the new poll pin's id. */
export async function createPoll(
  db: Firestore,
  params: {
    coupleId: string;
    cornerId: string;
    uid: string;
    question: string;
    options: string[];
    seed?: number;
  },
): Promise<string> {
  const { coupleId, cornerId, uid, question, options, seed } = params;
  const ref = doc(collection(db, COUPLES, coupleId, CORNERS, cornerId, PINS));
  const batch = writeBatch(db);
  batch.set(ref, {
    type: 'poll',
    poll: {
      question: question.trim(),
      options: options.map((o) => o.trim()).filter(Boolean).slice(0, MAX_POLL_OPTIONS),
      votes: {},
    },
    position: scatterPosition(seed ?? Math.floor(Math.random() * 997)),
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, COUPLES, coupleId, CORNERS, cornerId), {
    lastActivityAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

/** Cast (or change) my vote — each partner writes only their own key. */
export async function votePoll(
  db: Firestore,
  params: {
    coupleId: string;
    cornerId: string;
    pinId: string;
    uid: string;
    optionIndex: number;
  },
): Promise<void> {
  const { coupleId, cornerId, pinId, uid, optionIndex } = params;
  await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, PINS, pinId), {
    [`poll.votes.${uid}`]: optionIndex,
  });
}

/** Stamp (or unstamp) a pin as the couple's decision ⭐. */
export async function decidePin(
  db: Firestore,
  params: { coupleId: string; cornerId: string; pinId: string; decided: boolean },
): Promise<void> {
  const { coupleId, cornerId, pinId, decided } = params;
  const batch = writeBatch(db);
  batch.update(doc(db, COUPLES, coupleId, CORNERS, cornerId, PINS, pinId), { decided });
  batch.update(doc(db, COUPLES, coupleId, CORNERS, cornerId), {
    lastActivityAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Stamp (or unstamp) a chat message as a decision ⭐. */
export async function decideMessage(
  db: Firestore,
  params: { coupleId: string; cornerId: string; messageId: string; decided: boolean },
): Promise<void> {
  const { coupleId, cornerId, messageId, decided } = params;
  await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, MESSAGES, messageId), {
    decided,
  });
}

/** After "Make it a goal →" births a goal, point the decision at it. */
export async function linkDecisionToGoal(
  db: Firestore,
  params: {
    coupleId: string;
    cornerId: string;
    goalId: string;
    pinId?: string;
    messageId?: string;
  },
): Promise<void> {
  const { coupleId, cornerId, goalId, pinId, messageId } = params;
  if (pinId) {
    await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, PINS, pinId), {
      linkedGoalId: goalId,
      decided: true,
    });
  } else if (messageId) {
    await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, MESSAGES, messageId), {
      linkedGoalId: goalId,
      decided: true,
    });
  }
}
