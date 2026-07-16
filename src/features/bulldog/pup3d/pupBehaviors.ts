/**
 * Ambient behavior system for the rig-less 3D pup — the repertoire that turns a
 * static scan into a real dog you can watch and take care of.
 *
 * Pure TS (no three / RN imports) so it unit-tests clean, mirroring ladder.ts.
 *
 * NATURALNESS MODEL (why this reads as alive, not a toy being shoved around):
 *  - HEAD moves independently of the BODY. A dog leads with its head — it looks,
 *    tilts, sniffs, and gazes with the neck while the body stays planted. The
 *    component drives head DOFs (headYaw/headPitch/headRoll) through a vertex
 *    shader that bends only the head region, so jowls and ears lag behind the
 *    nose via distance falloff. Deliberate looks are HEAD targets; the body only
 *    turns to actually walk or reorient.
 *  - The pup is NEVER perfectly still. `idleFidget` is a small always-on layer of
 *    incommensurate sines (head micro-sway, weight-shift, breathing) so even
 *    between actions he's breathing and shifting — the single biggest fix for
 *    "it just stands there frozen."
 *  - Deliberate moves SNAP then settle (spring, in the component), never a uniform
 *    linear glide. Fast texture (head-shake, walk-bob) is layered additively so
 *    the spring doesn't smear it.
 *
 * The component owns the clock, the springs, and the actual transform; this module
 * decides WHAT the pup is doing and writes posture TARGETS + oscillator AMPLITUDES.
 */

/** Where the pup wants to be this frame. Absolute values; the component eases toward them. */
export interface PupTarget {
  // Head (independent of body — the neck articulates these via shader):
  headYaw: number; // look left / right
  headPitch: number; // look up (+) / nose down (−)
  headRoll: number; // the curious tilt
  // Body:
  yaw: number; // heading (radians), ADDED on top of the user's drag orbit
  pitch: number; // whole-body lean (bow / sit / bark lunge)
  roll: number; // weight-shift lean
  x: number; // stage position (world units)
  z: number;
  sink: number; // 0 standing → 1 lying down
  mouth: number; // 0 closed → 1 tongue out / open
}

/** Oscillator amplitudes; the component supplies the phase from its clock. */
export interface PupOsc {
  wagAmp: number;
  wagSpeed: number;
  droop: number; // tail tucked-down (sadness) 0..1
  bob: number; // vertical step-bob (walking) — also drives the head-nod
  sway: number; // side-to-side weight roll while moving
  breath: number; // breathing depth multiplier (1 = normal)
  breathRate: number; // breathing speed multiplier
  wobble: number; // full-body shake-off (rare, brief)
  headShake: number; // fast head-only shake (fly-flick / waking)
  twitch: number; // sleeping dream-twitch
}

export type Rand = () => number;
export type Pool = 'neutral' | 'sad' | 'nap';

// ---- tiny math (kept local so this module imports nothing) ----
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smooth(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
/** 0→1→0 hump: ramps in by `inEnd`, holds, ramps out after `outStart`. */
function hump(k: number, inEnd = 0.22, outStart = 0.72): number {
  if (k < inEnd) return smooth(k / inEnd);
  if (k > outStart) return smooth((1 - k) / (1 - outStart));
  return 1;
}
/**
 * Hold `amt` until `until`, then ease back to 0 by k=1. Used for head targets:
 * the value jumps to `amt` at k=0 and the component's SPRING animates the snap in,
 * so a held target reads as a quick natural look-and-hold, not a linear pan.
 */
function held(k: number, amt: number, until = 0.82): number {
  if (k >= until) return amt * (1 - smooth((k - until) / (1 - until)));
  return amt;
}
const D2R = Math.PI / 180;

export function neutralTarget(): PupTarget {
  return {
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    x: 0,
    z: 0,
    sink: 0,
    mouth: 0,
  };
}
export function neutralOsc(): PupOsc {
  return {
    wagAmp: 0,
    wagSpeed: 12,
    droop: 0,
    bob: 0,
    sway: 0,
    breath: 1,
    breathRate: 1,
    wobble: 0,
    headShake: 0,
    twitch: 0,
  };
}
export function resetTarget(T: PupTarget): void {
  T.headYaw = T.headPitch = T.headRoll = 0;
  T.yaw = T.pitch = T.roll = T.x = T.z = T.sink = T.mouth = 0;
}
export function resetOsc(O: PupOsc): void {
  O.wagAmp = 0;
  O.wagSpeed = 12;
  O.droop = 0;
  O.bob = 0;
  O.sway = 0;
  O.breath = 1;
  O.breathRate = 1;
  O.wobble = 0;
  O.headShake = 0;
  O.twitch = 0;
}

/**
 * Always-on micro-life. Summed incommensurate sines → motion that never visibly
 * loops, keeping the pup breathing and shifting even between scheduled actions.
 * Returns small unit-ish signals; the component scales them to radians.
 */
export function idleFidget(t: number): { yaw: number; pitch: number; roll: number; sway: number } {
  return {
    yaw: Math.sin(t * 0.53) * 0.6 + Math.sin(t * 1.27 + 1.3) * 0.4,
    pitch: Math.sin(t * 0.41 + 2.1) * 0.5 + Math.sin(t * 0.97) * 0.3,
    roll: Math.sin(t * 0.31 + 0.7) * 0.6,
    sway: Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.19 + 1.1) * 0.5,
  };
}

/** The little patch of floor the pup wanders within (world units; camera fixed). */
export const STAGE = { x: 0.7, z: 0.28 };
export function clampToStage(x: number, z: number): { x: number; z: number } {
  return { x: clamp(x, -STAGE.x, STAGE.x), z: clamp(z, -STAGE.z, STAGE.z) };
}

export interface BehaviorDef {
  pool: Pool;
  weight: number;
  durMin: number;
  durMax: number;
  init?: (rand: Rand) => Record<string, number>;
  run: (k: number, p: Record<string, number>, T: PupTarget, O: PupOsc) => void;
}

export const BEHAVIORS: Record<string, BehaviorDef> = {
  // ============================ NEUTRAL ============================
  /** The default: stand, watch something for a while, occasional soft wag. */
  standWatch: {
    pool: 'neutral',
    weight: 20,
    durMin: 3.0,
    durMax: 5.0,
    init: (r) => ({ a: (r() * 2 - 1) * 22 * D2R, up: r() * 6 * D2R }),
    run: (k, p, T, O) => {
      T.headYaw = held(k, p.a, 0.9);
      T.headPitch = held(k, p.up, 0.9);
      if (k > 0.4 && k < 0.55) {
        O.wagAmp = 0.14;
        O.wagSpeed = 7;
      }
    },
  },
  /** Quick scan: snap one way, snap the other, settle. */
  lookAround: {
    pool: 'neutral',
    weight: 13,
    durMin: 2.6,
    durMax: 3.8,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1, a: (30 + r() * 18) * D2R }),
    run: (k, p, T) => {
      const s = p.dir;
      if (k < 0.4) T.headYaw = s * p.a;
      else if (k < 0.78) T.headYaw = -s * p.a * 0.85;
      else T.headYaw = held(k, 0, 0.78);
      T.headPitch = hump(k) * 4 * D2R;
    },
  },
  /** The curious "bork?" tilt — held long enough to be endearing. */
  headTilt: {
    pool: 'neutral',
    weight: 11,
    durMin: 2.0,
    durMax: 3.0,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1, a: (14 + r() * 8) * D2R }),
    run: (k, p, T, O) => {
      T.headRoll = held(k, p.dir * p.a, 0.78);
      T.headPitch = held(k, 6 * D2R, 0.78);
      O.wagAmp = 0.12 * hump(k);
      O.wagSpeed = 6;
    },
  },
  /** Gaze up — watching a bird, or nothing. */
  lookUp: {
    pool: 'neutral',
    weight: 6,
    durMin: 2.0,
    durMax: 3.0,
    run: (k, _p, T) => {
      T.headPitch = held(k, 17 * D2R, 0.72);
    },
  },
  /** Nose to the floor, sniff-sniff side to side, shuffle forward a touch. */
  sniffGround: {
    pool: 'neutral',
    weight: 12,
    durMin: 3.0,
    durMax: 4.5,
    init: (r) => ({ creep: (r() * 0.1 + 0.03) * (r() < 0.5 ? -1 : 1) }),
    run: (k, p, T, O) => {
      const on = hump(k, 0.2, 0.8);
      T.headPitch = -on * 24 * D2R;
      T.headYaw = Math.sin(k * 11) * 7 * D2R * on; // casting for a scent
      T.x = p.creep * smooth(k);
      O.bob = 0.012 * on;
    },
  },
  /** A quick head-shake, flicking off a fly. (Additive — bypasses the spring.) */
  headShake: {
    pool: 'neutral',
    weight: 7,
    durMin: 0.6,
    durMax: 0.9,
    run: (k, _p, _T, O) => {
      O.headShake = hump(k, 0.12, 0.55) * 0.55;
    },
  },
  /** Trot to a new spot with a waddle and a walking head-bob. Rare + short. */
  walk: {
    pool: 'neutral',
    weight: 8,
    durMin: 3.0,
    durMax: 4.4,
    init: (r) => {
      const dst = clampToStage((r() * 2 - 1) * STAGE.x, (r() * 2 - 1) * STAGE.z);
      return { x: dst.x, z: dst.z, face: Math.atan2(dst.x, 0.6) };
    },
    run: (k, p, T, O) => {
      T.x = p.x;
      T.z = p.z;
      T.yaw = p.face * 0.6;
      const moving = hump(k, 0.14, 0.8);
      O.bob = 0.028 * moving; // component turns bob into a head-nod too
      O.sway = 0.07 * moving;
      O.wagAmp = 0.12 * moving;
      O.wagSpeed = 8;
      T.headYaw = Math.sin(k * 4) * 7 * D2R * moving;
    },
  },
  /** Reorient — the head glances the way he's about to turn, then the body follows. */
  turnAround: {
    pool: 'neutral',
    weight: 6,
    durMin: 2.2,
    durMax: 3.2,
    init: (r) => ({ a: (80 + r() * 80) * D2R * (r() < 0.5 ? -1 : 1) }),
    run: (k, p, T, O) => {
      const s = Math.sign(p.a);
      T.headYaw = held(k, s * 16 * D2R, 0.4); // head leads
      T.yaw = p.a * smooth(clamp((k - 0.15) / 0.85, 0, 1)); // body catches up
      O.bob = 0.015 * hump(k, 0.15, 0.85);
      O.sway = 0.05 * hump(k, 0.15, 0.85);
    },
  },
  /** The whole-body shake-off — head shakes too. */
  shakeOff: {
    pool: 'neutral',
    weight: 6,
    durMin: 0.9,
    durMax: 1.3,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.15, 0.6);
      O.wobble = 0.15 * on;
      O.headShake = 0.5 * on;
      T.headPitch = -on * 3 * D2R;
    },
  },
  /** Relaxed pant — tongue lolling, quick shallow breaths, head a touch up. */
  pant: {
    pool: 'neutral',
    weight: 9,
    durMin: 3.0,
    durMax: 4.4,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.15, 0.82);
      T.mouth = on;
      T.headPitch = held(k, 4 * D2R, 0.85);
      O.breathRate = 1 + 1.5 * on;
      O.breath = 1 + 0.25 * on;
      O.wagAmp = 0.1 * on;
      O.wagSpeed = 7;
    },
  },
  /** Play-bow — front down, head down, rump up, tail high. An invitation. */
  playBow: {
    pool: 'neutral',
    weight: 4,
    durMin: 1.8,
    durMax: 2.6,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.25, 0.55);
      T.pitch = on * 22 * D2R;
      T.sink = on * 0.18;
      T.headPitch = -on * 12 * D2R;
      O.wagAmp = 0.3 * on;
      O.wagSpeed = 12;
    },
  },
  /** Sit — rock back onto the haunches, chest and head up, alert. */
  sit: {
    pool: 'neutral',
    weight: 8,
    durMin: 3.0,
    durMax: 5.0,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.18, 0.84);
      T.sink = on * 0.22;
      T.pitch = -on * 8 * D2R;
      T.headPitch = held(k, 5 * D2R, 0.85);
      O.wagAmp = 0.05 * on;
      O.wagSpeed = 5;
    },
  },
  /** A daytime rest — lie down, head on the floor a while, get back up. */
  lieDown: {
    pool: 'neutral',
    weight: 7,
    durMin: 5.0,
    durMax: 8.0,
    run: (k, _p, T, O) => {
      const on = smooth(Math.min(k * 2.4, 1)) * (k < 0.82 ? 1 : 1 - smooth((k - 0.82) / 0.18));
      T.sink = on * 0.5;
      T.pitch = -on * 3 * D2R;
      T.headPitch = -on * 9 * D2R;
      O.breath = 1 + 0.2 * on;
      O.breathRate = 1 - 0.3 * on;
    },
  },
  /** A spontaneous burst of happy tail + a little perk. */
  wagBurst: {
    pool: 'neutral',
    weight: 6,
    durMin: 1.4,
    durMax: 2.2,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.15, 0.7);
      O.wagAmp = 0.42 * on;
      O.wagSpeed = 20;
      T.headPitch = on * 3 * D2R;
    },
  },
  /** A bark or two — the head lunges with the mouth. (No haptic: ambient.) */
  barkOnce: {
    pool: 'neutral',
    weight: 3,
    durMin: 0.7,
    durMax: 1.1,
    init: (r) => ({ n: r() < 0.5 ? 1 : 2 }),
    run: (k, p, T) => {
      const lunge = Math.sin(clamp((k * p.n) % 1, 0, 1) * Math.PI);
      T.headPitch = lerp(6 * D2R, -13 * D2R, lunge);
      T.mouth = lunge;
      T.pitch = lunge * 4 * D2R;
    },
  },

  // ============================== SAD ==============================
  sigh: {
    pool: 'sad',
    weight: 12,
    durMin: 2.6,
    durMax: 3.6,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.3, 0.5);
      O.breath = 1 + 0.5 * on;
      O.breathRate = 0.7;
      T.headPitch = -on * 11 * D2R;
      T.pitch = -on * 4 * D2R;
      T.sink = on * 0.05;
      O.droop = 0.8;
    },
  },
  lookAway: {
    pool: 'sad',
    weight: 10,
    durMin: 3.0,
    durMax: 4.5,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1 }),
    run: (k, p, T, O) => {
      T.headYaw = p.dir * 34 * D2R * smooth(Math.min(k * 1.4, 1));
      T.headPitch = -6 * D2R;
      O.droop = 0.85;
      O.breathRate = 0.75;
    },
  },
  lieGlum: {
    pool: 'sad',
    weight: 8,
    durMin: 4.0,
    durMax: 6.0,
    run: (k, _p, T, O) => {
      const on = smooth(Math.min(k * 2, 1));
      T.sink = on * 0.5;
      T.headPitch = -on * 15 * D2R;
      T.pitch = -on * 4 * D2R;
      O.droop = 1;
      O.breath = 1 + 0.3 * on;
      O.breathRate = 0.6;
    },
  },

  // ============================== NAP ==============================
  napCycle: {
    pool: 'nap',
    weight: 1,
    durMin: 9,
    durMax: 13,
    run: (k, _p, T, O) => {
      if (k < 0.12) {
        const y = Math.sin((k / 0.12) * Math.PI); // yawn
        T.mouth = y;
        T.headPitch = y * 9 * D2R;
        O.breath = 1 + 0.4 * y;
      } else if (k < 0.28) {
        const dn = smooth((k - 0.12) / 0.16); // lie down
        T.sink = dn * 0.55;
        T.headPitch = -dn * 12 * D2R;
      } else if (k < 0.82) {
        T.sink = 0.55; // sleep
        T.headPitch = -12 * D2R;
        O.breath = 1.5;
        O.breathRate = 0.5;
        O.twitch = Math.random() < 0.01 ? 0.03 : 0;
      } else if (k < 0.92) {
        const up = smooth((k - 0.82) / 0.1); // wake + rise
        T.sink = 0.55 * (1 - up);
        T.headPitch = -12 * D2R * (1 - up);
        O.headShake = 0.5 * Math.sin(up * Math.PI);
      } else {
        const st = Math.sin(((k - 0.92) / 0.08) * Math.PI); // stretch (bow)
        T.pitch = st * 18 * D2R;
        T.headPitch = -st * 10 * D2R;
        T.sink = st * 0.15;
        O.wagAmp = 0.2 * st;
        O.wagSpeed = 10;
      }
    },
  },
};

/**
 * Which actions naturally follow which — so behavior flows (look → walk that way →
 * sniff → shake off) instead of reading as unrelated random twitches. Preferred
 * follow-ups get a weight boost in `pickBehavior`.
 */
export const TRANSITIONS: Record<string, string[]> = {
  standWatch: ['lookAround', 'sniffGround', 'walk'],
  lookAround: ['walk', 'sniffGround', 'headTilt'],
  walk: ['sniffGround', 'sit', 'standWatch'],
  sniffGround: ['shakeOff', 'standWatch', 'sit'],
  sit: ['lieDown', 'standWatch', 'lookAround'],
  lieDown: ['standWatch', 'shakeOff'],
  headTilt: ['standWatch', 'lookAround'],
  turnAround: ['walk', 'sniffGround'],
};

/** Weighted pick from a pool; `prefer` names get a boost (behavior chaining). */
export function pickBehavior(pool: Pool, rand: Rand, prefer?: readonly string[]): string {
  const names = Object.keys(BEHAVIORS).filter((n) => BEHAVIORS[n].pool === pool);
  const weightOf = (n: string) => BEHAVIORS[n].weight + (prefer?.includes(n) ? BEHAVIORS[n].weight * 2 : 0);
  const total = names.reduce((sum, n) => sum + weightOf(n), 0);
  let r = rand() * total;
  for (const n of names) {
    r -= weightOf(n);
    if (r <= 0) return n;
  }
  return names[names.length - 1];
}

export function behaviorDuration(name: string, rand: Rand): number {
  const def = BEHAVIORS[name];
  return def.durMin + rand() * (def.durMax - def.durMin);
}

/** How long to relax (with idle-fidget still running) before the next action. */
export function nextGap(pool: Pool, rand: Rand): number {
  return pool === 'sad' ? 1.5 + rand() * 2 : 0.6 + rand() * 2.4;
}
