/**
 * Corner pins data layer — the scrapbook cards pinned above the chat.
 *
 * A pin is a note, a link, a photo (path filled once Storage lands) or a poll.
 * Positions are normalized (0..1) board coordinates plus a sticker tilt, so the
 * scrapbook lays out the same on both partners' screens. Every new pin bumps
 * the corner's lastActivityAt in the same batch.
 */

import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { CORNERS, COUPLES, PINS, type PinPosition } from '@/lib/types';

export interface NewPin {
  type: 'note' | 'link' | 'photo';
  note?: string;
  url?: string;
  photoPath?: string;
  /** Omit to let the board pick a playful spot. */
  position?: PinPosition;
}

/**
 * Deterministic-ish playful placement for the n-th pin: walk a golden-angle
 * spiral so pins spread naturally without overlapping stacks.
 */
export function scatterPosition(seed: number): PinPosition {
  const golden = 137.508 * (Math.PI / 180);
  const angle = seed * golden;
  const r = 0.12 + 0.3 * Math.sqrt((seed % 9) / 9);
  return {
    x: Math.min(0.9, Math.max(0.1, 0.5 + r * Math.cos(angle))),
    y: Math.min(0.85, Math.max(0.12, 0.5 + r * Math.sin(angle))),
    rot: ((seed * 47) % 13) - 6, // -6..6 degrees of sticker tilt
  };
}

/** Pin something to the corner's scrapbook. Returns the new pin id. */
export async function createPin(
  db: Firestore,
  params: { coupleId: string; cornerId: string; uid: string; pin: NewPin; seed?: number },
): Promise<string> {
  const { coupleId, cornerId, uid, pin, seed } = params;
  const ref = doc(collection(db, COUPLES, coupleId, CORNERS, cornerId, PINS));
  const batch = writeBatch(db);
  batch.set(ref, {
    type: pin.type,
    ...(pin.note != null ? { note: pin.note.trim() } : {}),
    ...(pin.url != null ? { url: pin.url.trim() } : {}),
    ...(pin.photoPath != null ? { photoPath: pin.photoPath } : {}),
    position: pin.position ?? scatterPosition(seed ?? Math.floor(Math.random() * 997)),
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, COUPLES, coupleId, CORNERS, cornerId), {
    lastActivityAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

/** Nudge a pin somewhere else on the board (either partner may tidy). */
export async function movePin(
  db: Firestore,
  params: { coupleId: string; cornerId: string; pinId: string; position: PinPosition },
): Promise<void> {
  const { coupleId, cornerId, pinId, position } = params;
  await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, PINS, pinId), { position });
}

/** Take a pin down. */
export async function deletePin(
  db: Firestore,
  coupleId: string,
  cornerId: string,
  pinId: string,
): Promise<void> {
  await deleteDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId, PINS, pinId));
}
