/**
 * The bulldog's mood — a tiny UI state machine (see motion-spec skill).
 * Screens trigger moods; BulldogView renders them.
 *
 * Transient (auto-return to idle in the view): happy · love · party · proud
 * Persistent (until booped/cheered):           idle · sleepy · pout
 *
 * party = goal completed / seal slam (+confetti) · proud = quarter/year milestone
 * pout  = 3+ quiet days for BOTH partners (droopy jowls only — never text-guilt)
 */

import { create } from 'zustand';

export type BulldogMood = 'idle' | 'happy' | 'party' | 'proud' | 'sleepy' | 'pout' | 'love';

interface BulldogState {
  mood: BulldogMood;
  /** Bumps every trigger so repeat moods re-animate. */
  nonce: number;
  /** Trigger a mood (transient ones return to idle automatically in the view). */
  trigger: (mood: BulldogMood) => void;
  setIdle: () => void;
}

export const useBulldogStore = create<BulldogState>((set) => ({
  mood: 'idle',
  nonce: 0,
  trigger: (mood) => set((s) => ({ mood, nonce: s.nonce + 1 })),
  setIdle: () => set({ mood: 'idle' }),
}));
