/**
 * Integration tests for polls + ⭐ decisions + the decision→goal link,
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
import { doc, getDoc, type Firestore } from 'firebase/firestore';

import { createCouple, joinCouple } from '@/features/couple/api';
import { createGoal } from '@/features/goals/api';
import { createCorner } from './api';
import { sendMessage } from './chat';
import { createPoll, decideMessage, decidePin, linkDecisionToGoal, votePoll } from './polls';

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

const pinDoc = (uid: string, pinId: string) =>
  getDoc(doc(asUser(uid), 'couples', coupleId, 'corners', cornerId, 'pins', pinId));

describe('polls', () => {
  it('creates a poll pin; both partners vote (one vote each, changeable)', async () => {
    const pinId = await createPoll(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      question: 'Where do we stay?',
      options: ['Ryokan', 'Hotel', 'Machiya'],
    });

    await votePoll(asUser(ALICE), { coupleId, cornerId, pinId, uid: ALICE, optionIndex: 0 });
    await votePoll(asUser(BOB), { coupleId, cornerId, pinId, uid: BOB, optionIndex: 2 });
    let snap = await pinDoc(BOB, pinId);
    expect(snap.data()?.poll.votes).toEqual({ [ALICE]: 0, [BOB]: 2 });

    // Bob comes around to the ryokan.
    await votePoll(asUser(BOB), { coupleId, cornerId, pinId, uid: BOB, optionIndex: 0 });
    snap = await pinDoc(ALICE, pinId);
    expect(snap.data()?.poll.votes).toEqual({ [ALICE]: 0, [BOB]: 0 });
  });

  it('stamps a poll decided ⭐ and links it to a goal', async () => {
    const pinId = await createPoll(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      question: 'Where do we stay?',
      options: ['Ryokan', 'Hotel'],
    });

    await decidePin(asUser(BOB), { coupleId, cornerId, pinId, decided: true });
    let snap = await pinDoc(ALICE, pinId);
    expect(snap.data()?.decided).toBe(true);

    const goalId = await createGoal(asUser(ALICE), {
      coupleId,
      uid: ALICE,
      title: 'Book the ryokan',
      charm: '⛩️',
      horizon: 'quarter',
      owner: 'shared',
      targetUnits: 3,
    });
    await linkDecisionToGoal(asUser(ALICE), { coupleId, cornerId, pinId, goalId });
    snap = await pinDoc(BOB, pinId);
    expect(snap.data()?.linkedGoalId).toBe(goalId);
  });

  it('stamps a chat message decided ⭐', async () => {
    const messageId = await sendMessage(asUser(BOB), {
      coupleId,
      cornerId,
      uid: BOB,
      text: 'ok final answer: first week of April',
    });
    await decideMessage(asUser(ALICE), { coupleId, cornerId, messageId, decided: true });
    const snap = await getDoc(
      doc(asUser(BOB), 'couples', coupleId, 'corners', cornerId, 'messages', messageId),
    );
    expect(snap.data()?.decided).toBe(true);
  });

  it('locks strangers out of poll writes', async () => {
    const pinId = await createPoll(asUser(ALICE), {
      coupleId,
      cornerId,
      uid: ALICE,
      question: 'Private?',
      options: ['yes', 'no'],
    });
    const evil = asUser(MALLORY);
    await assertFails(
      votePoll(evil, { coupleId, cornerId, pinId, uid: MALLORY, optionIndex: 0 }),
    );
    await assertFails(decidePin(evil, { coupleId, cornerId, pinId, decided: true }));
  });
});
