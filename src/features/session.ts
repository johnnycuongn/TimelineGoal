/**
 * Session status = auth + couple, folded into the one question routing cares about:
 * "where should this person be right now?"
 */

import type { Href } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import type { Couple } from '@/lib/types';

export type SessionStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready';

export interface Session {
  status: SessionStatus;
  uid: string | null;
  coupleId: string | null;
  couple: Couple | null;
}

/** A couple is "set up" once it exists and the bulldog has been named. */
function isOnboarded(coupleId: string | null, couple: Couple | null): boolean {
  return !!coupleId && !!couple && couple.bulldog.name.trim().length > 0;
}

export function useSession(): Session {
  const { user, initializing } = useAuth();
  const { coupleId, couple, loading } = useCouple();

  let status: SessionStatus;
  if (initializing || loading) {
    status = 'loading';
  } else if (!user) {
    status = 'signed-out';
  } else if (!isOnboarded(coupleId, couple)) {
    status = 'onboarding';
  } else {
    status = 'ready';
  }

  return { status, uid: user?.uid ?? null, coupleId, couple };
}

/** The route group a given status belongs in. */
export const routeForStatus: Record<Exclude<SessionStatus, 'loading'>, Href> = {
  'signed-out': '/(auth)/sign-in',
  onboarding: '/(onboarding)',
  ready: '/(tabs)',
};
