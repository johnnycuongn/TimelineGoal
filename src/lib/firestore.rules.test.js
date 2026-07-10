/**
 * Firestore security-rules tests (M0 scaffold).
 *
 * Verifies the core invariant: a couple's world is theirs alone.
 * Runs against the Firestore emulator — launch with `npm run test:rules`
 * (which wraps this in `firebase emulators:exec`).
 *
 * Uses a `demo-` project id so it never touches production.
 */

const { readFileSync } = require('fs');
const { resolve } = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const STRANGER = 'stranger_uid';
const COUPLE_ID = 'couple_ab';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** Seed data bypassing rules. */
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

describe('users/{uid}', () => {
  it('lets a user read their own profile', async () => {
    await seed((db) => setDoc(doc(db, 'users', ALICE), { name: 'Alice' }));
    const alice = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(alice, 'users', ALICE)));
  });

  it("forbids reading someone else's profile", async () => {
    await seed((db) => setDoc(doc(db, 'users', ALICE), { name: 'Alice' }));
    const bob = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(bob, 'users', ALICE)));
  });
});

describe('couples/{coupleId}', () => {
  beforeEach(async () => {
    await seed((db) =>
      setDoc(doc(db, 'couples', COUPLE_ID), { members: [ALICE, BOB], bulldog: { name: 'Mochi' } }),
    );
  });

  it('lets a member read the couple', async () => {
    const alice = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(alice, 'couples', COUPLE_ID)));
  });

  it('forbids a non-member from reading the couple', async () => {
    const stranger = testEnv.authenticatedContext(STRANGER).firestore();
    await assertFails(getDoc(doc(stranger, 'couples', COUPLE_ID)));
  });

  it('lets a member write a goal in the couple subtree', async () => {
    const bob = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      setDoc(doc(bob, 'couples', COUPLE_ID, 'goals', 'g1'), {
        title: 'Run 3x',
        owner: BOB,
        horizon: 'week',
      }),
    );
  });

  it('forbids a non-member from writing a goal in the couple subtree', async () => {
    const stranger = testEnv.authenticatedContext(STRANGER).firestore();
    await assertFails(
      setDoc(doc(stranger, 'couples', COUPLE_ID, 'goals', 'g1'), { title: 'sneaky' }),
    );
  });
});

describe('pairing', () => {
  it('lets a second person join a 1-member couple (1 → 2)', async () => {
    await seed((db) => setDoc(doc(db, 'couples', 'solo'), { members: [ALICE] }));
    const bob = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      setDoc(doc(bob, 'couples', 'solo'), { members: [ALICE, BOB] }, { merge: true }),
    );
  });

  it('forbids a stranger from muscling into a full (2-member) couple', async () => {
    await seed((db) => setDoc(doc(db, 'couples', COUPLE_ID), { members: [ALICE, BOB] }));
    const stranger = testEnv.authenticatedContext(STRANGER).firestore();
    await assertFails(
      setDoc(
        doc(stranger, 'couples', COUPLE_ID),
        { members: [ALICE, STRANGER] },
        { merge: true },
      ),
    );
  });
});
