/**
 * Integration tests for corner chat (real-time messages + reactions),
 * run against the Firestore emulator WITH security rules enforced.
 * Run: `npm run test:emulator`.
 */

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore';

import { createCouple, joinCouple } from '@/features/couple/api';
import { createCorner } from './api';
import { reactToMessage, sendMessage } from './chat';

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const MALLORY = 'mallory_uid';

let testEnv: RulesTestEnvironment;
let coupleId: string;
let cornerId: string;

const asUser = (uid: string) =>
  testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  const created = await createCouple(asUser(ALICE), { uid: ALICE, partnerColor: '#BE185D' });
  coupleId = created.coupleId;
  await joinCouple(asUser(BOB), { uid: BOB, code: created.code, partnerColor: '#0D9488' });
  cornerId = await createCorner(asUser(ALICE), {
    coupleId,
    uid: ALICE,
    title: 'Kyoto trip',
    charms: ['⛩️'],
    tint: 'sky',
  });
});

describe('corner chat', () => {
  it('sends a message both partners can read, and bumps the corner alive', async () => {
    const before = await getDoc(doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId));
    const beforeAlive = before.data()?.lastActivityAt;

    // Firestore timestamps have millisecond precision — make sure time moves.
    await new Promise((r) => setTimeout(r, 5));
    const messageId = await sendMessage(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      text: 'ryokan or hotel?',
    });

    const asBob = await getDoc(
      doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId, 'messages', messageId),
    );
    expect(asBob.data()?.text).toBe('ryokan or hotel?');
    expect(asBob.data()?.uid).toBe(ALICE);

    const after = await getDoc(doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId));
    expect(after.data()?.lastActivityAt.toMillis()).toBeGreaterThan(beforeAlive.toMillis());
  });

  it('lets the partner react to a message (and re-tap to unreact)', async () => {
    const messageId = await sendMessage(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      text: 'found a machiya with a garden 🌿',
    });

    await reactToMessage(asUser(BOB), { coupleId, cornerId, messageId, uid: BOB, reaction: '❤️' });
    let snap = await getDoc(
      doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId, 'messages', messageId),
    );
    expect(snap.data()?.reactions).toEqual({ [BOB]: '❤️' });

    await reactToMessage(asUser(BOB), { coupleId, cornerId, messageId, uid: BOB, reaction: null });
    snap = await getDoc(
      doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId, 'messages', messageId),
    );
    expect(snap.data()?.reactions?.[BOB]).toBeUndefined();
  });

  it('locks strangers out of the chat', async () => {
    await sendMessage(asUser(BOB), { coupleId, cornerId, uid: BOB, text: 'private!' });
    const evil = asUser(MALLORY);
    await assertFails(
      getDocs(collection(evil, 'couples', coupleId, 'corners', cornerId, 'messages')),
    );
    await assertFails(
      sendMessage(evil, { coupleId, cornerId, uid: MALLORY, text: 'let me in' }),
    );
  });
});
