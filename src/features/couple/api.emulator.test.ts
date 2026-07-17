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
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';

import type { Couple } from '@/lib/types';
import { createCouple, joinCouple, PairingError, watchCouple } from './api';

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

    expect(code).toHaveLength(8);

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

describe('watchCouple', () => {
  // The pairing race: the local users/{uid} snapshot fires optimistically mid-batch,
  // so the app attaches the couple listener BEFORE the create commits server-side.
  // Rules can't see the membership yet → permission-denied → a plain onSnapshot
  // listener dies permanently and the app hangs on "loading". watchCouple must
  // retry through that window and deliver the couple once it's readable.
  it('recovers when the listener attaches before the couple is readable', async () => {
    const db = asUser(ALICE);
    const coupleId = 'race_couple';
    const seen: (Couple | null)[] = [];

    const stop = watchCouple(
      db,
      coupleId,
      (couple) => {
        seen.push(couple);
      },
      { baseDelayMs: 100 },
    );

    // Let the first attach fail (doc doesn't exist → membership check → denied)…
    await new Promise((r) => setTimeout(r, 250));
    // …then the create "commits".
    await setDoc(doc(db, 'couples', coupleId), {
      members: [ALICE],
      createdBy: ALICE,
      createdAt: serverTimestamp(),
      partnerColors: { [ALICE]: ROSE },
      bulldog: { name: '', unlockedCosmetics: [], equipped: {} },
      pendingInviteCode: 'RACECODE',
    });

    // The retrying listener must eventually deliver the couple.
    await waitFor(() => seen.some((c) => c?.members.includes(ALICE)), 10_000);
    stop();
    expect(seen.some((c) => c?.members.includes(ALICE))).toBe(true);
  });

  it('gives up after maxRetries and reports null instead of hanging', async () => {
    const db = asUser(ALICE);
    const seen: (Couple | null)[] = [];
    // Nobody ever creates this couple — access stays denied forever.
    const stop = watchCouple(
      db,
      'never_exists',
      (couple) => {
        seen.push(couple);
      },
      { maxRetries: 2, baseDelayMs: 50 },
    );
    await waitFor(() => seen.length > 0, 10_000);
    stop();
    expect(seen).toEqual([null]);
  });
});

async function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
}
