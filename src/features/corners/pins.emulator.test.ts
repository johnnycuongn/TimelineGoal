/**
 * Integration tests for corner pins (scrapbook cards), run against the
 * Firestore emulator WITH security rules enforced.
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
import { createPin, deletePin, movePin } from './pins';

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

describe('corner pins', () => {
  it('pins a note both partners can read, and bumps the corner alive', async () => {
    const pinId = await createPin(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      pin: { type: 'note', note: 'cherry blossom week: Apr 1–8' },
    });

    const asBob = await getDoc(
      doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId, 'pins', pinId),
    );
    expect(asBob.data()?.type).toBe('note');
    expect(asBob.data()?.note).toBe('cherry blossom week: Apr 1–8');
    // A fresh pin lands somewhere on the board with a playful tilt.
    const pos = asBob.data()?.position;
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(1);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeLessThanOrEqual(1);
  });

  it('pins a link and lets either partner move it (scrapbook drag)', async () => {
    const pinId = await createPin(asUser(BOB), {
      coupleId,
      cornerId,
      uid: BOB,
      pin: { type: 'link', url: 'https://example.com/machiya' },
    });

    await movePin(asUser(ALICE), {
      coupleId,
      cornerId,
      pinId,
      position: { x: 0.25, y: 0.75, rot: -4 },
    });

    const snap = await getDoc(
      doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId, 'pins', pinId),
    );
    expect(snap.data()?.position).toEqual({ x: 0.25, y: 0.75, rot: -4 });
  });

  it('unpins', async () => {
    const pinId = await createPin(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      pin: { type: 'note', note: 'bye' },
    });
    await deletePin(asUser(BOB), coupleId, cornerId, pinId);
    const snap = await getDoc(
      doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId, 'pins', pinId),
    );
    expect(snap.exists()).toBe(false);
  });

  it('locks strangers out of the pin board', async () => {
    await createPin(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      pin: { type: 'note', note: 'private' },
    });
    const evil = asUser(MALLORY);
    await assertFails(getDocs(collection(evil, 'couples', coupleId, 'corners', cornerId, 'pins')));
    await assertFails(
      createPin(evil, { coupleId, cornerId, uid: MALLORY, pin: { type: 'note', note: 'hi' } }),
    );
  });
});
