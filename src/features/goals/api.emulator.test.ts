/**
 * Integration tests for goals + check-ins against the Firestore emulator (rules enforced).
 * Run: `npm run test:emulator`.
 */

import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';

import { checkIn, createGoal, reactToActivity, sealGoal } from './api';
import { weekPeriod } from './period';

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const STRANGER = 'stranger_uid';
const COUPLE_ID = 'couple_ab';

let testEnv: RulesTestEnvironment;
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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'couples', COUPLE_ID), {
      members: [ALICE, BOB],
      partnerColors: { [ALICE]: '#BE185D', [BOB]: '#0D9488' },
      bulldog: { name: 'Mochi', unlockedCosmetics: [], equipped: {} },
    });
  });
});

describe('createGoal + checkIn', () => {
  it('creates a weekly goal in the current period and stamps paw prints', async () => {
    const db = asUser(ALICE);
    const goalId = await createGoal(db, {
      coupleId: COUPLE_ID,
      uid: ALICE,
      title: 'Run together 3x',
      charm: '🏃',
      horizon: 'week',
      owner: 'shared',
      targetUnits: 3,
    });

    const saved = await getDoc(doc(db, 'couples', COUPLE_ID, 'goals', goalId));
    expect(saved.data()?.period).toBe(weekPeriod());
    expect(saved.data()?.targetUnits).toBe(3);

    // Both partners check in — append-only, no conflicts.
    await checkIn(db, {
      coupleId: COUPLE_ID,
      uid: ALICE,
      goalId,
      goalTitle: 'Run together 3x',
      charm: '🏃',
    });
    await checkIn(asUser(BOB), {
      coupleId: COUPLE_ID,
      uid: BOB,
      goalId,
      goalTitle: 'Run together 3x',
      charm: '🏃',
    });

    const checkins = await getDocs(
      collection(db, 'couples', COUPLE_ID, 'goals', goalId, 'checkins'),
    );
    expect(checkins.size).toBe(2);

    // Denormalized per-partner counters incremented in the same batch.
    const after = await getDoc(doc(db, 'couples', COUPLE_ID, 'goals', goalId));
    expect(after.data()?.progressBy).toEqual({ [ALICE]: 1, [BOB]: 1 });

    // Ticker activity written alongside.
    const activity = await getDocs(collection(db, 'couples', COUPLE_ID, 'activity'));
    expect(activity.size).toBe(2);
  });

  it('seals a shared goal once both partners press the wax', async () => {
    const db = asUser(ALICE);
    const goalId = await createGoal(db, {
      coupleId: COUPLE_ID,
      uid: ALICE,
      title: 'Save for Kyoto',
      charm: '✈️',
      horizon: 'quarter',
      owner: 'shared',
      targetUnits: 4,
    });

    await sealGoal(db, { coupleId: COUPLE_ID, goalId, uid: ALICE });
    let saved = await getDoc(doc(db, 'couples', COUPLE_ID, 'goals', goalId));
    expect(Object.keys(saved.data()?.seals ?? {})).toEqual([ALICE]);

    await sealGoal(asUser(BOB), { coupleId: COUPLE_ID, goalId, uid: BOB });
    saved = await getDoc(doc(db, 'couples', COUPLE_ID, 'goals', goalId));
    expect(Object.keys(saved.data()?.seals ?? {}).sort()).toEqual([ALICE, BOB].sort());

    // A stranger's paw never reaches the wax.
    await expect(
      sealGoal(asUser(STRANGER), { coupleId: COUPLE_ID, goalId, uid: STRANGER }),
    ).rejects.toBeTruthy();
  });

  it('lets a partner react to an activity item', async () => {
    const db = asUser(ALICE);
    const goalId = await createGoal(db, {
      coupleId: COUPLE_ID,
      uid: ALICE,
      title: 'Read',
      charm: '📚',
      horizon: 'week',
      owner: ALICE,
      targetUnits: 2,
    });
    await checkIn(db, {
      coupleId: COUPLE_ID,
      uid: ALICE,
      goalId,
      goalTitle: 'Read',
      charm: '📚',
    });
    const activity = await getDocs(collection(db, 'couples', COUPLE_ID, 'activity'));
    const activityId = activity.docs[0].id;

    await reactToActivity(asUser(BOB), {
      coupleId: COUPLE_ID,
      activityId,
      uid: BOB,
      reaction: 'heart',
    });

    const updated = await getDoc(doc(db, 'couples', COUPLE_ID, 'activity', activityId));
    expect(updated.data()?.reactions).toEqual({ [BOB]: 'heart' });
  });

  it('keeps strangers out of the couple’s goals', async () => {
    await expect(
      createGoal(asUser(STRANGER), {
        coupleId: COUPLE_ID,
        uid: STRANGER,
        title: 'sneaky goal',
        charm: '🎯',
        horizon: 'week',
        owner: STRANGER,
        targetUnits: 1,
      }),
    ).rejects.toBeTruthy();

    const db = asUser(STRANGER);
    await assertFails(getDocs(collection(db, 'couples', COUPLE_ID, 'goals')));
  });
});
