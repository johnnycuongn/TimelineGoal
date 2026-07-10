/**
 * Email/password auth actions (work today in Expo Go + the Auth emulator).
 *
 * Google & Apple sign-in need a native dev build + provider config; they'll be added
 * as additional actions here when we cut the dev build (M2 forces one for Rive anyway).
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { auth, db } from '@/lib/firebase';
import { ensureUserProfile } from '@/features/couple/api';

/** Turn a Firebase auth error into warm, human copy (never scary). */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email looks a little off — mind checking it?';
    case 'auth/email-already-in-use':
      return 'That email already has an account — try signing in.';
    case 'auth/weak-password':
      return 'Let’s pick a password with at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Try again?';
    case 'auth/network-request-failed':
      return 'Can’t reach the network right now — check your connection.';
    default:
      return 'Something hiccuped. Give it another try in a moment.';
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = displayName.trim();
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await ensureUserProfile(db, {
    uid: cred.user.uid,
    displayName: name || cred.user.email || 'Someone lovely',
    email: cred.user.email,
  });
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  // Make sure a profile exists (e.g. account created before profiles were tracked).
  await ensureUserProfile(db, {
    uid: cred.user.uid,
    displayName: cred.user.displayName || cred.user.email || 'Someone lovely',
    email: cred.user.email,
  });
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
