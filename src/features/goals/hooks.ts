/**
 * Live goal data for the UI. All real-time (onSnapshot) — partner presence is ambient.
 */

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/firebase';
import { ACTIVITY, CHECKINS, COUPLES, GOALS, type Activity, type CheckIn, type Goal } from '@/lib/types';
import { weekPeriod } from './period';

export interface GoalWithId extends Goal {
  id: string;
}

/** Live list of this week's goals for the couple. */
export function useWeeklyGoals(coupleId: string | null): { goals: GoalWithId[]; loading: boolean } {
  const [goals, setGoals] = useState<GoalWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const period = weekPeriod();

  useEffect(() => {
    if (!coupleId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, COUPLES, coupleId, GOALS),
      where('horizon', '==', 'week'),
      where('period', '==', period),
    );
    return onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Goal) }));
      // Stable, friendly order: shared first, then by creation time.
      next.sort((a, b) => {
        if ((a.owner === 'shared') !== (b.owner === 'shared')) {
          return a.owner === 'shared' ? -1 : 1;
        }
        return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
      });
      setGoals(next);
      setLoading(false);
    });
  }, [coupleId, period]);

  return { goals, loading };
}

/** Live check-ins for one goal (progress = checkins.length, per-partner splits derivable). */
export function useCheckIns(
  coupleId: string | null,
  goalId: string | null,
): { checkIns: (CheckIn & { id: string })[] } {
  const [checkIns, setCheckIns] = useState<(CheckIn & { id: string })[]>([]);

  useEffect(() => {
    if (!coupleId || !goalId) {
      setCheckIns([]);
      return;
    }
    const q = query(
      collection(db, COUPLES, coupleId, GOALS, goalId, CHECKINS),
      orderBy('at', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      setCheckIns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CheckIn) })));
    });
  }, [coupleId, goalId]);

  return { checkIns };
}

export interface ActivityWithId extends Activity {
  id: string;
}

/** Live recent activity (partner ticker), newest first. */
export function useActivity(coupleId: string | null, max = 10): { items: ActivityWithId[] } {
  const [items, setItems] = useState<ActivityWithId[]>([]);

  useEffect(() => {
    if (!coupleId) {
      setItems([]);
      return;
    }
    const q = query(
      collection(db, COUPLES, coupleId, ACTIVITY),
      orderBy('at', 'desc'),
      limit(max),
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Activity) })));
    });
  }, [coupleId, max]);

  return useMemo(() => ({ items }), [items]);
}
