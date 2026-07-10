/**
 * Integration tests for the pairing data layer, run against the Firestore emulator
 * WITH security rules enforced (authenticated contexts from @firebase/rules-unit-testing).
 *
 * Verifies the real createCouple/joinCouple flows + the two-people-one-world invariant.
 * Run: `npm run test:emulator`.
 */

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doc, getDoc, type Firestore } from 'firebase/firestore';

import { createCouple, joinCouple, PairingError } from './api';

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const CAROL = 'carol_uid';
const ROSE = '#BE185D';
const TEAL = '#0D9488';
const GRAPE = '#7C3AED';

let testEnv: RulesTestEnvironment;

/** Authenticated Firestore for a given uid (rules enforced). */
const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;

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
});

describe('createCouple', () => {
  it('creates a couple with the creator as sole member, mints an invite, links the user', async () => {
    const db = asUser(ALICE);
    const { coupleId, code } = await createCouple(db, { uid: ALICE, partnerColor: ROSE });

    expect(code).toHaveLength(6);

    const couple = await getDoc(doc(db, 'couples', coupleId));
    expect(couple.data()?.members).toEqual([ALICE]);
    expect(couple.data()?.partnerColors).toEqual({ [ALICE]: ROSE });

    const invite = await getDoc(doc(db, 'invites', code));
    expect(invite.data()?.coupleId).toBe(coupleId);

    const user = await getDoc(doc(db, 'users', ALICE));
    expect(user.data()?.coupleId).toBe(coupleId);
  });
});

describe('joinCouple', () => {
  it('adds a second member (1 → 2), records their color, consumes the invite', async () => {
    const { coupleId, code } = await createCouple(asUser(ALICE), {
      uid: ALICE,
      partnerColor: ROSE,
    });

    const { coupleId: joinedId } = await joinCouple(asUser(BOB), {
      uid: BOB,
      code,
      partnerColor: TEAL,
    });
    expect(joinedId).toBe(coupleId);

    // Bob is now a member and can read the couple.
    const couple = await getDoc(doc(asUser(BOB), 'couples', coupleId));
    expect(couple.data()?.members.sort()).toEqual([ALICE, BOB].sort());
    expect(couple.data()?.partnerColors).toEqual({ [ALICE]: ROSE, [BOB]: TEAL });

    // Invite was consumed.
    const invite = await getDoc(doc(asUser(BOB), 'invites', code));
    expect(invite.exists()).toBe(false);

    // Bob's user doc is linked.
    expect((await getDoc(doc(asUser(BOB), 'users', BOB))).data()?.coupleId).toBe(coupleId);
  });

  it('rejects an unknown code', async () => {
    await expect(
      joinCouple(asUser(BOB), { uid: BOB, code: 'ZZZZZZ', partnerColor: TEAL }),
    ).rejects.toMatchObject({ code: 'invalid-code' });
  });

  it('refuses a third person once the couple is complete', async () => {
    const { code } = await createCouple(asUser(ALICE), { uid: ALICE, partnerColor: ROSE });
    // Bob joins (consumes the invite)…
    await joinCouple(asUser(BOB), { uid: BOB, code, partnerColor: TEAL });
    // …Carol tries the same (now-deleted) code → invalid-code, and even a fresh attempt is blocked.
    await expect(
      joinCouple(asUser(CAROL), { uid: CAROL, code, partnerColor: GRAPE }),
    ).rejects.toBeInstanceOf(PairingError);
  });
});
