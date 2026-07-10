/**
 * Couple + pairing data layer.
 *
 * Pure functions over a Firestore instance (so they're testable against the emulator).
 * Enforces the non-negotiables (see .claude/skills/couple-growth):
 *  - exactly two members, ever
 *  - both partners fully see the shared world (membership-gated in rules)
 */

import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  type Firestore,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { COUPLES, INVITES, USERS } from '@/lib/types';
import { INVITE_TTL_MS, generateInviteCode, normalizeInviteCode } from './inviteCode';

export class PairingError extends Error {
  constructor(
    public code:
      | 'invalid-code'
      | 'expired'
      | 'couple-full'
      | 'already-in-couple'
      | 'not-found',
    message: string,
  ) {
    super(message);
    this.name = 'PairingError';
  }
}

/** Ensure a users/{uid} profile exists (created on first sign-in). */
export async function ensureUserProfile(
  db: Firestore,
  user: { uid: string; displayName: string; email: string | null },
): Promise<void> {
  const ref = doc(db, USERS, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
}

/** Reserve an unused invite code (retries on the vanishingly rare collision). */
async function reserveUniqueCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const existing = await getDoc(doc(db, INVITES, code));
    if (!existing.exists()) return code;
  }
  throw new Error('Could not allocate a unique invite code');
}

export interface CreateCoupleResult {
  coupleId: string;
  code: string;
}

/**
 * Start a new couple with `uid` as the sole (first) member and mint an invite code
 * for the partner to join. Returns the new coupleId + shareable code.
 */
export async function createCouple(
  db: Firestore,
  params: { uid: string; partnerColor: string; bulldogName?: string },
): Promise<CreateCoupleResult> {
  const { uid, partnerColor, bulldogName = '' } = params;
  const coupleRef = doc(collection(db, COUPLES));
  const code = await reserveUniqueCode(db);

  const batch = writeBatch(db);
  batch.set(coupleRef, {
    members: [uid],
    createdBy: uid,
    createdAt: serverTimestamp(),
    partnerColors: { [uid]: partnerColor },
    bulldog: { name: bulldogName, unlockedCosmetics: [], equipped: {} },
    pendingInviteCode: code,
  });
  batch.set(doc(db, INVITES, code), {
    coupleId: coupleRef.id,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + INVITE_TTL_MS,
  });
  batch.set(doc(db, USERS, uid), { coupleId: coupleRef.id }, { merge: true });
  await batch.commit();

  return { coupleId: coupleRef.id, code };
}

/**
 * Join an existing couple via invite code. Atomically adds `uid` as the second
 * member, records their partner color, deletes the used invite, and links the user.
 */
export async function joinCouple(
  db: Firestore,
  params: { uid: string; code: string; partnerColor: string },
): Promise<{ coupleId: string }> {
  const { uid, partnerColor } = params;
  const code = normalizeInviteCode(params.code);

  // NOTE: the joiner isn't a member yet, so security rules deny reading the couple doc.
  // We therefore do a blind update — the rules enforce the 1 → 2 transition, so a full
  // (or nonexistent) couple is rejected server-side. The couple's data stays private.
  try {
    const coupleId = await runTransaction(db, async (tx) => {
      const inviteRef = doc(db, INVITES, code);
      const inviteSnap = await tx.get(inviteRef); // invites are readable by any signed-in user
      if (!inviteSnap.exists()) {
        throw new PairingError('invalid-code', 'That code doesn’t match any invite.');
      }
      const invite = inviteSnap.data() as { coupleId: string; expiresAt: number };
      if (typeof invite.expiresAt === 'number' && invite.expiresAt < Date.now()) {
        throw new PairingError('expired', 'That invite has expired — ask for a new one.');
      }

      const coupleRef = doc(db, COUPLES, invite.coupleId);
      tx.update(coupleRef, {
        members: arrayUnion(uid),
        [`partnerColors.${uid}`]: partnerColor,
        pendingInviteCode: deleteField(),
      });
      tx.delete(inviteRef);
      tx.set(doc(db, USERS, uid), { coupleId: invite.coupleId }, { merge: true });
      return invite.coupleId;
    });
    return { coupleId };
  } catch (err) {
    if (err instanceof PairingError) throw err;
    // A rules rejection here means the couple is already complete (or gone).
    if (isPermissionDenied(err)) {
      throw new PairingError('couple-full', 'This couple is already complete. 💕');
    }
    throw err;
  }
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'permission-denied'
  );
}

/** Name (or rename) the couple's bulldog. */
export async function setBulldogName(
  db: Firestore,
  coupleId: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, COUPLES, coupleId), { 'bulldog.name': name.trim() });
}

/** Cancel a pending invite (e.g. the creator wants a fresh code). */
export async function revokeInvite(db: Firestore, code: string): Promise<void> {
  await deleteDoc(doc(db, INVITES, normalizeInviteCode(code)));
}
