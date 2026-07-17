/**
 * Corner chat data layer — the conversation inside a topic space.
 *
 * Messages are append-only keepsakes like check-ins (history is the couple's
 * story). Every message bumps the corner's lastActivityAt in the same batch,
 * so the grid breathes and the partner's phone reorders live.
 */

import {
  collection,
  deleteField,
  doc,
  type Firestore,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { CORNERS, COUPLES, MESSAGES } from '@/lib/types';

export interface SendMessageInput {
  coupleId: string;
  cornerId: string;
  uid: string;
  text: string;
}

/** Send one chat message; bumps the corner's lastActivityAt in the same batch. */
export async function sendMessage(db: Firestore, input: SendMessageInput): Promise<string> {
  const { coupleId, cornerId, uid, text } = input;
  const messageRef = doc(collection(db, COUPLES, coupleId, CORNERS, cornerId, MESSAGES));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    uid,
    text: text.trim(),
    at: serverTimestamp(),
  });
  batch.update(doc(db, COUPLES, coupleId, CORNERS, cornerId), {
    lastActivityAt: serverTimestamp(),
  });
  await batch.commit();
  return messageRef.id;
}

/**
 * React to a message with an emoji (one per partner — tap again with `null`
 * to take it back). Each partner writes only their own key: conflict-free.
 */
export async function reactToMessage(
  db: Firestore,
  params: {
    coupleId: string;
    cornerId: string;
    messageId: string;
    uid: string;
    /** The reaction emoji, or null to remove yours. */
    reaction: string | null;
  },
): Promise<void> {
  const { coupleId, cornerId, messageId, uid, reaction } = params;
  await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, MESSAGES, messageId), {
    [`reactions.${uid}`]: reaction ?? deleteField(),
  });
}
