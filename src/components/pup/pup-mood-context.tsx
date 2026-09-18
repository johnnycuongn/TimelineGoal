import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { Mood } from "@/lib/domain";
import type { PersistentMood } from "@/lib/mood";

export type TransientMood = "happy" | "party" | "proud" | "love";

interface MoodState {
  persistent: PersistentMood;
  transient: TransientMood | null;
  nonce: number;
}

type Action =
  | { type: "trigger"; mood: TransientMood }
  | { type: "settle" }
  | { type: "persistent"; mood: PersistentMood };

function reducer(state: MoodState, action: Action): MoodState {
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
  const [state, dispatch] = useReducer(reducer, { persistent: "idle", transient: null, nonce: 0 });
  const trigger = useCallback((mood: TransientMood) => dispatch({ type: "trigger", mood }), []);
  const settle = useCallback(() => dispatch({ type: "settle" }), []);
  const setPersistent = useCallback(
    (mood: PersistentMood) => dispatch({ type: "persistent", mood }),
    [],
  );
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
