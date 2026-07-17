/**
 * Integration tests for the Corners data layer, run against the Firestore emulator
 * WITH security rules enforced. A corner is a shared topic space — either partner
 * creates and edits, both always see it, strangers never do.
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
import { createCorner, deleteCorner, updateCorner } from './api';

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const MALLORY = 'mallory_uid';
const ROSE = '#BE185D';
const TEAL = '#0D9488';

let testEnv: RulesTestEnvironment;
let coupleId: string;

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
  const created = await createCouple(asUser(ALICE), { uid: ALICE, partnerColor: ROSE });
  coupleId = created.coupleId;
  await joinCouple(asUser(BOB), { uid: BOB, code: created.code, partnerColor: TEAL });
});

describe('corners', () => {
  it('either partner creates a corner; both can read it', async () => {
    const cornerId = await createCorner(asUser(ALICE), {
      coupleId,
      uid: ALICE,
      title: 'Kyoto trip',
      charms: ['⛩️', '🍜'],
      tint: 'sky',
    });

    const asBob = await getDoc(doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId));
    expect(asBob.data()?.title).toBe('Kyoto trip');
    expect(asBob.data()?.charms).toEqual(['⛩️', '🍜']);
    expect(asBob.data()?.tint).toBe('sky');
    expect(asBob.data()?.createdBy).toBe(ALICE);
    expect(asBob.data()?.lastActivityAt).toBeTruthy();
  });

  it('either partner can retitle / recharm / retint a corner', async () => {
    const cornerId = await createCorner(asUser(ALICE), {
      coupleId,
      uid: ALICE,
      title: 'House stuff',
      charms: ['🏡'],
      tint: 'mint',
    });

    await updateCorner(asUser(BOB), coupleId, cornerId, {
      title: 'Our first home',
      charms: ['🏡', '🔑', '🪴'],
      tint: 'butter',
    });

    const snap = await getDoc(doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId));
    expect(snap.data()?.title).toBe('Our first home');
    expect(snap.data()?.charms).toEqual(['🏡', '🔑', '🪴']);
    expect(snap.data()?.tint).toBe('butter');
  });

  it('locks strangers out of reading and writing corners', async () => {
    const cornerId = await createCorner(asUser(ALICE), {
      coupleId,
      uid: ALICE,
      title: 'Secret plans',
      charms: ['🤫'],
      tint: 'lilac',
    });

    const evil = asUser(MALLORY);
    await assertFails(getDoc(doc(evil, 'couples', coupleId, 'corners', cornerId)));
    await assertFails(getDocs(collection(evil, 'couples', coupleId, 'corners')));
    await assertFails(
      updateCorner(evil, coupleId, cornerId, { title: 'mine now' }),
    );
  });

  it('deletes a corner', async () => {
    const cornerId = await createCorner(asUser(ALICE), {
      coupleId,
      uid: ALICE,
      title: 'Old plan',
      charms: ['📦'],
      tint: 'peach',
    });
    await deleteCorner(asUser(BOB), coupleId, cornerId);
    const snap = await getDoc(doc(asUser(ALICE), 'couples', coupleId, 'corners', cornerId));
    expect(snap.exists()).toBe(false);
  });
});
