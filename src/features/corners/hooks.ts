/**
 * Live corner data for the UI — real-time like everything else (partner presence
 * is ambient; a corner your partner just touched floats up the grid on its own).
 */

import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import { CORNERS, COUPLES, type Corner } from '@/lib/types';

export interface CornerWithId extends Corner {
  id: string;
}

/** Live: every corner, most-recently-alive first. A couple's corner list stays small. */
export function useCorners(coupleId: string | null): {
  corners: CornerWithId[];
  loading: boolean;
} {
  const [corners, setCorners] = useState<CornerWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) {
      setCorners([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, COUPLES, coupleId, CORNERS),
      orderBy('lastActivityAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setCorners(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Corner) })));
      setLoading(false);
    });
  }, [coupleId]);

  return { corners, loading };
}

/** Live single corner (the corner screen header watches title/charms/cover). */
export function useCorner(
  coupleId: string | null,
  cornerId: string | null,
): { corner: CornerWithId | null; loading: boolean } {
  const [corner, setCorner] = useState<CornerWithId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId || !cornerId) {
      setCorner(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(doc(db, COUPLES, coupleId, CORNERS, cornerId), (snap) => {
      setCorner(snap.exists() ? ({ id: snap.id, ...(snap.data() as Corner) } as CornerWithId) : null);
      setLoading(false);
    });
  }, [coupleId, cornerId]);

  return { corner, loading };
}
