// The pup's bedtime pose, as numbers. Pure: the model feeds it time and Math.random.
//
// There is no lie-down clip in the GLB. The pose is the final frame of the "Death" clip
// — that frame only, never the collapse that leads to it — blended against Idle by a
// depth running from 0 (standing) to 1 (flat out). The numbers here were read off
// renders from the stage's own camera, so they are worth re-checking on screen if the
// camera in pup-stage moves.

/** Blend depth for each bedtime mood: a crouch at 21:00, flat out from 22:00. */
export const REST_DEPTH = { drowsy: 0.55, resting: 1 } as const;

/** Depth held during a stir — head and chest up, as if the pup half woke. */
export const STIR_DEPTH = 0.8;

/**
 * Neck and head are levelled back toward their bind orientation as the pose deepens.
 * The borrowed frame rolls the head onto its side and shows the jaw, which reads as a
 * dead dog rather than a sleeping one; everything below the neck is kept as it comes.
 * Sanitised names on purpose — three.js strips the dots out of "Neck1.L" and friends.
 */
export const LEVEL_BONES = ["Neck1", "Neck2", "Neck3", "Head"] as const;

/**
 * The borrowed frame carries the body this far along the pup's own X axis. Undone in
 * step with the depth, or he lies down half out of frame.
 */
export const REST_DRIFT_X = -0.403;

/**
 * Where the pup has to be nudged to stay framed, for a depth and a turntable angle.
 * The drift is a fact about the pose, which lives in the pup's own space, so it turns
 * with him: at a quarter turn the sideways shift has become a shift in depth.
 */
export function restShift(depth: number, turn: number): { x: number; z: number } {
  const shift = REST_DRIFT_X * depth;
  return { x: shift * Math.cos(turn), z: -shift * Math.sin(turn) };
}

/** Damping rate for the settle. Low enough that lying down takes about two seconds. */
export const REST_DAMP = 2.2;

/** A slow breath: one rise and fall every four seconds, two percent of the depth. */
export const BREATH_PERIOD_S = 4;
const BREATH_AMPLITUDE = 0.02;

export function breathingDepth(depth: number, elapsedS: number): number {
  const wave = (1 - Math.cos((2 * Math.PI * elapsedS) / BREATH_PERIOD_S)) / 2;
  return depth * (1 - BREATH_AMPLITUDE * wave);
}

const STIR_GAP_MIN_S = 14;
const STIR_GAP_MAX_S = 26;
const STIR_HOLD_MIN_S = 2.5;
const STIR_HOLD_MAX_S = 4.5;
const MS = 1000;

/** How long until the pup next lifts his head, and how long he holds it up. */
export function nextStir(random: () => number = Math.random): {
  afterMs: number;
  holdMs: number;
} {
  return {
    afterMs: Math.round((STIR_GAP_MIN_S + random() * (STIR_GAP_MAX_S - STIR_GAP_MIN_S)) * MS),
    holdMs: Math.round((STIR_HOLD_MIN_S + random() * (STIR_HOLD_MAX_S - STIR_HOLD_MIN_S)) * MS),
  };
}
