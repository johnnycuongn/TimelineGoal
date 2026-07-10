import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { COUPLES, USERS, type Couple } from '@/lib/types';

interface CoupleState {
  /** The user's couple id, once they've created/joined one. */
  coupleId: string | null;
  /** Live couple document (members, bulldog, partnerColors…). */
  couple: Couple | null;
  /** True while the user doc / couple doc are first resolving. */
  loading: boolean;
}

const CoupleContext = createContext<CoupleState>({
  coupleId: null,
  couple: null,
  loading: true,
});

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [coupleLoaded, setCoupleLoaded] = useState(false);

  // Watch the user doc for their coupleId.
  useEffect(() => {
    if (!user) {
      setCoupleId(null);
      setCouple(null);
      setUserLoaded(false);
      setCoupleLoaded(false);
      return;
    }
    setUserLoaded(false);
    return onSnapshot(doc(db, USERS, user.uid), (snap) => {
      setCoupleId((snap.data()?.coupleId as string | undefined) ?? null);
      setUserLoaded(true);
    });
  }, [user]);

  // Watch the couple doc once we know the id.
  useEffect(() => {
    if (!coupleId) {
      setCouple(null);
      setCoupleLoaded(true);
      return;
    }
    setCoupleLoaded(false);
    return onSnapshot(doc(db, COUPLES, coupleId), (snap) => {
      setCouple(snap.exists() ? (snap.data() as Couple) : null);
      setCoupleLoaded(true);
    });
  }, [coupleId]);

  const loading = initializing || (!!user && (!userLoaded || !coupleLoaded));

  const value = useMemo(
    () => ({ coupleId, couple, loading }),
    [coupleId, couple, loading],
  );
  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple(): CoupleState {
  return useContext(CoupleContext);
}
