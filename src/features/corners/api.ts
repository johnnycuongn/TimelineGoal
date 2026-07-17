/**
 * Corners data layer (pure functions over Firestore; emulator-tested).
 *
 * A corner is a shared topic space — chat + pinned scrapbook + polls — one per
 * thing the couple is dreaming up. Both partners own every corner together
 * (see .claude/skills/couple-growth: two people, one world).
 */

import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

import { CORNERS, COUPLES, type Corner } from '@/lib/types';

/**
 * Soft cover tints a corner can wear until it gets a cover photo.
 * Named on the doc, resolved per color scheme at render — dark mode stays cozy.
 */
export const CORNER_TINTS = [
  { name: 'blush', light: '#FBCFE8', dark: '#4A2238' },
  { name: 'butter', light: '#FDE68A', dark: '#4A3B12' },
  { name: 'mint', light: '#BBF7D0', dark: '#143D2A' },
  { name: 'sky', light: '#BAE6FD', dark: '#123B52' },
  { name: 'lilac', light: '#DDD6FE', dark: '#33285C' },
  { name: 'peach', light: '#FED7AA', dark: '#4E2E14' },
] as const;

export type CornerTintName = (typeof CORNER_TINTS)[number]['name'];

export function tintColor(name: string, scheme: 'light' | 'dark'): string {
  const tint = CORNER_TINTS.find((t) => t.name === name) ?? CORNER_TINTS[0];
  return tint[scheme];
}

export const MAX_CORNER_CHARMS = 3;

export interface CreateCornerInput {
  coupleId: string;
  uid: string;
  title: string;
  /** Up to MAX_CORNER_CHARMS emoji. */
  charms: string[];
  tint: string;
}

/** Open a new corner in the couple's world. Returns the new corner id. */
export async function createCorner(db: Firestore, input: CreateCornerInput): Promise<string> {
  const { coupleId, uid, title, charms, tint } = input;
  const ref = doc(collection(db, COUPLES, coupleId, CORNERS));
  await setDoc(ref, {
    title: title.trim(),
    charms: charms.slice(0, MAX_CORNER_CHARMS),
    tint,
    coverPhoto: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  return ref.id;
}

/** Edit a corner's title / charms / tint / cover photo. Either partner may. */
export async function updateCorner(
  db: Firestore,
  coupleId: string,
  cornerId: string,
  patch: Partial<Pick<Corner, 'title' | 'charms' | 'tint' | 'coverPhoto'>>,
): Promise<void> {
  await updateDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId), patch);
}

/** Close a corner for good (its chat + pins go with it — confirm in UI first). */
export async function deleteCorner(
  db: Firestore,
  coupleId: string,
  cornerId: string,
): Promise<void> {
  await deleteDoc(doc(db, COUPLES, coupleId, CORNERS, cornerId));
}
