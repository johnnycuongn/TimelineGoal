import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { Mood } from "@/lib/domain";
import type { PersistentMood } from "@/lib/mood";

export type TransientMood = "happy" | "party" | "proud" | "love";

/**
 * Upper bound on how long a transient mood may stay latched.
 *
 * `PupModel` normally settles a transient mood itself, on the clip's own
 * duration, but it can only do that while a stage is actually mounted and
 * animating. The mood machine must not depend on the renderer to close it:
 * with reduced motion on, with WebGL unavailable, while the lazy stage chunk is
 * still loading, or on any route that renders no `<Pup>`, nothing would ever
 * dispatch `settle` and the transient would mask the persistent mood for the
 * rest of the session. This backstop is comfortably longer than every transient
 * clip (the longest is under a second), so in the normal case the model's own
 * settle always wins and this timer is only ever cleared.
 */
export const TRANSIENT_MAX_MS = 3000;

export interface MoodState {
  persistent: PersistentMood;
  transient: TransientMood | null;
  nonce: number;
}

export type MoodAction =
  | { type: "trigger"; mood: TransientMood }
  | { type: "settle" }
  | { type: "persistent"; mood: PersistentMood };

export const initialMoodState: MoodState = { persistent: "idle", transient: null, nonce: 0 };

export function moodReducer(state: MoodState, action: MoodAction): MoodState {
  switch (action.type) {
    case "trigger":
      return { ...state, transient: action.mood, nonce: state.nonce + 1 };
    case "settle":
      return state.transient ? { ...state, transient: null } : state;
    case "persistent":
      return state.persistent === action.mood ? state : { ...state, persistent: action.mood };
    default:
      return state;
  }
}

interface PupMoodValue {
  mood: Mood;
  nonce: number;
  persistent: PersistentMood;
  trigger: (mood: TransientMood) => void;
  settle: () => void;
  setPersistent: (mood: PersistentMood) => void;
}

const PupMoodContext = createContext<PupMoodValue | null>(null);

export function PupMoodProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(moodReducer, initialMoodState);
  const trigger = useCallback((mood: TransientMood) => dispatch({ type: "trigger", mood }), []);
  const settle = useCallback(() => dispatch({ type: "settle" }), []);
  const setPersistent = useCallback(
    (mood: PersistentMood) => dispatch({ type: "persistent", mood }),
    [],
  );

  // Time-bound the transient mood here, not in the renderer. `nonce` is in the
  // deps so a repeat of the same mood restarts the bound.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` restarts the bound when the same mood re-triggers
  useEffect(() => {
    if (!state.transient) {
      return;
    }
    const id = window.setTimeout(settle, TRANSIENT_MAX_MS);
    return () => window.clearTimeout(id);
  }, [state.transient, state.nonce, settle]);

  const value = useMemo<PupMoodValue>(
    () => ({
      mood: state.transient ?? state.persistent,
      nonce: state.nonce,
      persistent: state.persistent,
      trigger,
      settle,
      setPersistent,
    }),
    [state, trigger, settle, setPersistent],
  );
  return <PupMoodContext.Provider value={value}>{children}</PupMoodContext.Provider>;
}

export function usePupMood(): PupMoodValue {
  const value = useContext(PupMoodContext);
  if (!value) {
    throw new Error("usePupMood must be used inside PupMoodProvider.");
  }
  return value;
}
