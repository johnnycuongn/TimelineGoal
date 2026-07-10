/**
 * The bulldog's mood — a tiny UI state machine (see motion-spec skill).
 * Screens trigger moods; BulldogView renders them. Transient moods (happy, love)
 * auto-return to idle after their moment.
 *
 * States wired in M2: idle · happy · sleepy · love. party/proud/pout land in M3.
 */

import { create } from 'zustand';

export type BulldogMood = 'idle' | 'happy' | 'sleepy' | 'love';

interface BulldogState {
  mood: BulldogMood;
  /** Bumps every trigger so repeat moods re-animate. */
  nonce: number;
  /** Trigger a transient mood (returns to idle automatically in the view). */
  trigger: (mood: BulldogMood) => void;
  setIdle: () => void;
}

export const useBulldogStore = create<BulldogState>((set) => ({
  mood: 'idle',
  nonce: 0,
  trigger: (mood) => set((s) => ({ mood, nonce: s.nonce + 1 })),
  setIdle: () => set({ mood: 'idle' }),
}));
