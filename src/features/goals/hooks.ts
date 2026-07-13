/**
 * Live goal data for the UI. All real-time (onSnapshot) — partner presence is ambient.
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/firebase';
import { ACTIVITY, CHECKINS, COUPLES, GOALS, type Activity, type CheckIn, type Goal } from '@/lib/types';

export interface GoalWithId extends Goal {
  id: string;
}

/** Stable, friendly order: shared first, then by creation time. */
export function sortFriendly(goals: GoalWithId[]): GoalWithId[] {
  return [...goals].sort((a, b) => {
    if ((a.owner === 'shared') !== (b.owner === 'shared')) {
      return a.owner === 'shared' ? -1 : 1;
    }
    return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
  });
}

/**
 * Live: EVERY goal in the couple's world. One listener powers the week view,
 * ladder rollups, streak doodles, the pulse ring and seal nudges — a couple's
 * goal list stays small, and progress lives on the goal docs (progressBy).
 * Slice it with the pure selectors in ./ladder.
 */
export function useAllGoals(coupleId: string | null): { goals: GoalWithId[]; loading: boolean } {
  const [goals, setGoals] = useState<GoalWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(collection(db, COUPLES, coupleId, GOALS), (snap) => {
      setGoals(sortFriendly(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Goal) }))));
      setLoading(false);
    });
  }, [coupleId]);

  return { goals, loading };
}

/** Live single goal (the seal screen watches the wax in real time). */
export function useGoal(
  coupleId: string | null,
  goalId: string | null,
): { goal: GoalWithId | null; loading: boolean } {
  const [goal, setGoal] = useState<GoalWithId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId || !goalId) {
      setGoal(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(doc(db, COUPLES, coupleId, GOALS, goalId), (snap) => {
      setGoal(snap.exists() ? ({ id: snap.id, ...(snap.data() as Goal) } as GoalWithId) : null);
      setLoading(false);
    });
  }, [coupleId, goalId]);

  return { goal, loading };
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
