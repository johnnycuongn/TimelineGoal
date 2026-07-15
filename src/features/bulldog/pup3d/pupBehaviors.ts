/**
 * Ambient behavior system for the rig-less 3D pup — the repertoire that turns a
 * static scan into a real dog you can watch and take care of.
 *
 * Pure TS (no three / RN imports) so it unit-tests clean, mirroring ladder.ts.
 * The component owns the clock and the actual transform; this module only decides
 * WHAT the pup is doing and writes posture TARGETS + oscillator AMPLITUDES that
 * the frame loop damps toward. Because targets are damped (never assigned to the
 * mesh directly), every behavior is inherently springy and interruptible — a real
 * mood event (a check-in) can cut in mid-yawn and it eases over gracefully
 * (motion-spec: everything springy, nothing snaps; Reduce Motion → scheduler off).
 *
 * The repertoire (an ethogram):
 *   neutral — lookAround · headTilt (wondering) · lookUp · sniffGround · walk ·
 *             turnAround · shakeOff · pant · playBow · sit · wagBurst · barkOnce
 *   sad     — sigh · lookAway · lieGlum
 *   nap     — napCycle (yawn → lie down → sleep w/ dream-twitch → wake + stretch)
 * Happy/party/love/proud stay scripted in the component (hop + wag + tongue).
 */

/** Where the pup can be, this frame. Absolute values; the frame loop damps toward them. */
export interface PupTarget {
  yaw: number; // heading (radians), ADDED on top of the user's drag orbit
  pitch: number; // nose up (+) / down (−)
  roll: number; // head-tilt
  x: number; // stage position (world units), damped
  z: number;
  sink: number; // 0 standing → 1 fully lying down
  mouth: number; // 0 closed → 1 tongue out / open
}

/** Oscillator amplitudes; the frame loop supplies the phase from its clock. */
export interface PupOsc {
  wagAmp: number; // tail wag amplitude
  wagSpeed: number; // tail wag speed
  droop: number; // tail tucked-down (sadness) 0..1
  bob: number; // vertical step-bob amplitude (walking / turning / sniffing)
  sway: number; // side-to-side weight roll while moving
  breath: number; // breathing depth multiplier (1 = normal)
  breathRate: number; // breathing speed multiplier
  wobble: number; // shake-off jitter amplitude
  twitch: number; // sleeping dream-twitch amplitude
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
/** 0→1→0 hump: ramps in by `inEnd`, holds the plateau, ramps out after `outStart`. */
function hump(k: number, inEnd = 0.22, outStart = 0.72): number {
  if (k < inEnd) return smooth(k / inEnd);
  if (k > outStart) return smooth((1 - k) / (1 - outStart));
  return 1;
}
const D2R = Math.PI / 180;

export function neutralTarget(): PupTarget {
  return { yaw: 0, pitch: 0, roll: 0, x: 0, z: 0, sink: 0, mouth: 0 };
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
    twitch: 0,
  };
}
/** Reset in place (frame loop reuses one object per frame — no per-frame allocation). */
export function resetTarget(T: PupTarget): void {
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
  O.twitch = 0;
}

/** The little patch of floor the pup wanders within (world units; camera fixed). */
export const STAGE = { x: 0.75, z: 0.32 };
export function clampToStage(x: number, z: number): { x: number; z: number } {
  return { x: clamp(x, -STAGE.x, STAGE.x), z: clamp(z, -STAGE.z, STAGE.z) };
}

export interface BehaviorDef {
  pool: Pool;
  weight: number; // relative pick weight within its pool
  durMin: number; // seconds
  durMax: number;
  /** Per-run randomized params, chosen once when the behavior starts. */
  init?: (rand: Rand) => Record<string, number>;
  /** Write absolute targets / amplitudes for normalized progress k ∈ [0,1]. */
  run: (k: number, p: Record<string, number>, T: PupTarget, O: PupOsc) => void;
}

export const BEHAVIORS: Record<string, BehaviorDef> = {
  // ============================ NEUTRAL ============================
  /** Scan the room: look one way, then the other, then settle — a little alert. */
  lookAround: {
    pool: 'neutral',
    weight: 18,
    durMin: 2.4,
    durMax: 3.6,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1, a: (28 + r() * 22) * D2R }),
    run: (k, p, T) => {
      const s = p.dir;
      if (k < 0.45) T.yaw = s * p.a * smooth(k / 0.45);
      else if (k < 0.9) T.yaw = lerp(s * p.a, -s * p.a * 0.8, smooth((k - 0.45) / 0.45));
      else T.yaw = lerp(-s * p.a * 0.8, 0, smooth((k - 0.9) / 0.1));
      T.pitch = hump(k) * 3 * D2R;
    },
  },
  /** The classic curious "bork?" head-tilt, with a slow single wag. */
  headTilt: {
    pool: 'neutral',
    weight: 13,
    durMin: 1.6,
    durMax: 2.6,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1, a: (12 + r() * 8) * D2R }),
    run: (k, p, T, O) => {
      T.roll = p.dir * p.a * hump(k, 0.25, 0.7);
      T.pitch = hump(k) * 5 * D2R;
      O.wagAmp = 0.12 * hump(k);
      O.wagSpeed = 6;
    },
  },
  /** Gaze up — watching a bird, or nothing at all. */
  lookUp: {
    pool: 'neutral',
    weight: 8,
    durMin: 1.8,
    durMax: 2.8,
    run: (k, _p, T) => {
      T.pitch = hump(k, 0.3, 0.65) * 14 * D2R;
    },
  },
  /** Nose to the floor, sniff-sniff, shuffle forward a touch. */
  sniffGround: {
    pool: 'neutral',
    weight: 13,
    durMin: 2.6,
    durMax: 4.0,
    init: (r) => ({ creep: (r() * 0.12 + 0.04) * (r() < 0.5 ? -1 : 1) }),
    run: (k, p, T, O) => {
      const on = hump(k, 0.25, 0.75);
      T.pitch = -on * 20 * D2R;
      T.x = p.creep * smooth(k);
      O.bob = 0.02 * on * (0.5 + 0.5 * Math.sin(k * 40));
    },
  },
  /** Trot to a new spot on the stage with a waddle (bob + weight-shift sway). */
  walk: {
    pool: 'neutral',
    weight: 16,
    durMin: 2.6,
    durMax: 4.2,
    init: (r) => {
      const dst = clampToStage((r() * 2 - 1) * STAGE.x, (r() * 2 - 1) * STAGE.z);
      return { x: dst.x, z: dst.z, face: Math.atan2(dst.x, 0.6) };
    },
    run: (k, p, T, O) => {
      T.x = p.x;
      T.z = p.z;
      T.yaw = p.face * 0.6;
      const moving = hump(k, 0.12, 0.82);
      O.bob = 0.03 * moving;
      O.sway = 0.08 * moving;
      O.wagAmp = 0.14 * moving;
      O.wagSpeed = 9;
    },
  },
  /** Reorient — turn most of the way around in place, stepping as he goes. */
  turnAround: {
    pool: 'neutral',
    weight: 9,
    durMin: 2.0,
    durMax: 3.0,
    init: (r) => ({ a: (90 + r() * 90) * D2R * (r() < 0.5 ? -1 : 1) }),
    run: (k, p, T, O) => {
      T.yaw = p.a * smooth(k);
      O.bob = 0.018 * hump(k, 0.15, 0.85);
      O.sway = 0.05 * hump(k, 0.15, 0.85);
    },
  },
  /** The whole-body shake-off dogs do constantly. */
  shakeOff: {
    pool: 'neutral',
    weight: 7,
    durMin: 0.9,
    durMax: 1.3,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.15, 0.6);
      O.wobble = 0.16 * on;
      T.pitch = -on * 3 * D2R;
    },
  },
  /** Relaxed pant — tongue lolling, quick shallow breaths. Peak content dog. */
  pant: {
    pool: 'neutral',
    weight: 11,
    durMin: 2.8,
    durMax: 4.4,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.15, 0.8);
      T.mouth = on;
      O.breathRate = 1 + 1.4 * on;
      O.breath = 1 + 0.25 * on;
      O.bob = 0.008 * on * (0.5 + 0.5 * Math.sin(k * 60));
      O.wagAmp = 0.1 * on;
      O.wagSpeed = 7;
    },
  },
  /** Play-bow — front down, rump up, tail high. An invitation. */
  playBow: {
    pool: 'neutral',
    weight: 6,
    durMin: 1.6,
    durMax: 2.4,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.25, 0.55);
      T.pitch = on * 22 * D2R;
      T.sink = on * 0.18;
      O.wagAmp = 0.3 * on;
      O.wagSpeed = 12;
    },
  },
  /** Sit — rock back onto the haunches, chest up, hold a while. */
  sit: {
    pool: 'neutral',
    weight: 7,
    durMin: 2.6,
    durMax: 4.4,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.18, 0.82);
      T.sink = on * 0.22;
      T.pitch = -on * 8 * D2R;
      O.wagAmp = 0.06 * on;
      O.wagSpeed = 5;
    },
  },
  /** A spontaneous burst of happy tail for no reason at all. */
  wagBurst: {
    pool: 'neutral',
    weight: 9,
    durMin: 1.4,
    durMax: 2.2,
    run: (k, _p, _T, O) => {
      const on = hump(k, 0.15, 0.7);
      O.wagAmp = 0.42 * on;
      O.wagSpeed = 20;
    },
  },
  /** A little bark or two — windup, lunge with the mouth. (No haptic: ambient.) */
  barkOnce: {
    pool: 'neutral',
    weight: 4,
    durMin: 0.7,
    durMax: 1.0,
    init: (r) => ({ n: r() < 0.5 ? 1 : 2 }),
    run: (k, p, T, O) => {
      const lunge = Math.sin(clamp((k * p.n) % 1, 0, 1) * Math.PI);
      T.pitch = lerp(6 * D2R, -10 * D2R, lunge);
      T.mouth = lunge;
      O.bob = 0.02 * lunge;
    },
  },

  // ============================== SAD ==============================
  /** A big slow sigh — chest deflates, body sinks a touch. */
  sigh: {
    pool: 'sad',
    weight: 12,
    durMin: 2.6,
    durMax: 3.6,
    run: (k, _p, T, O) => {
      const on = hump(k, 0.3, 0.5);
      O.breath = 1 + 0.5 * on;
      O.breathRate = 0.7;
      T.pitch = -on * 8 * D2R;
      T.sink = on * 0.06;
      O.droop = 0.8;
    },
  },
  /** Turn away, slowly, tail tucked. */
  lookAway: {
    pool: 'sad',
    weight: 10,
    durMin: 3.0,
    durMax: 4.5,
    init: (r) => ({ dir: r() < 0.5 ? -1 : 1 }),
    run: (k, p, T, O) => {
      T.yaw = p.dir * 40 * D2R * smooth(Math.min(k * 1.4, 1));
      T.pitch = -6 * D2R;
      O.droop = 0.85;
      O.breathRate = 0.75;
    },
  },
  /** Sink down glumly and stay a while. */
  lieGlum: {
    pool: 'sad',
    weight: 8,
    durMin: 4.0,
    durMax: 6.0,
    run: (k, _p, T, O) => {
      const on = smooth(Math.min(k * 2, 1));
      T.sink = on * 0.5;
      T.pitch = -on * 6 * D2R;
      O.droop = 1;
      O.breath = 1 + 0.3 * on;
      O.breathRate = 0.65;
    },
  },

  // ============================== NAP ==============================
  /** yawn → lie down → sleep (deep slow breath + rare dream-twitch) → wake + stretch. */
  napCycle: {
    pool: 'nap',
    weight: 1,
    durMin: 9,
    durMax: 13,
    run: (k, _p, T, O) => {
      if (k < 0.12) {
        const y = Math.sin((k / 0.12) * Math.PI); // yawn
        T.mouth = y;
        T.pitch = y * 8 * D2R;
        O.breath = 1 + 0.4 * y;
      } else if (k < 0.28) {
        const dn = smooth((k - 0.12) / 0.16); // lie down
        T.sink = dn * 0.55;
        T.pitch = -dn * 4 * D2R;
      } else if (k < 0.82) {
        T.sink = 0.55; // sleep
        O.breath = 1.5;
        O.breathRate = 0.5;
        O.twitch = Math.random() < 0.01 ? 0.03 : 0; // rare dream-twitch
      } else if (k < 0.92) {
        const up = smooth((k - 0.82) / 0.1); // wake + rise
        T.sink = 0.55 * (1 - up);
        O.wobble = 0.12 * Math.sin(up * Math.PI);
      } else {
        const st = Math.sin(((k - 0.92) / 0.08) * Math.PI); // stretch
        T.pitch = st * 18 * D2R;
        T.sink = st * 0.15;
        O.wagAmp = 0.2 * st;
        O.wagSpeed = 10;
      }
    },
  },
};

/** Weighted pick from a pool. `rand` is injectable for deterministic tests. */
export function pickBehavior(pool: Pool, rand: Rand): string {
  const names = Object.keys(BEHAVIORS).filter((n) => BEHAVIORS[n].pool === pool);
  const total = names.reduce((sum, n) => sum + BEHAVIORS[n].weight, 0);
  let r = rand() * total;
  for (const n of names) {
    r -= BEHAVIORS[n].weight;
    if (r <= 0) return n;
  }
  return names[names.length - 1];
}

/** A random duration inside the behavior's declared range. */
export function behaviorDuration(name: string, rand: Rand): number {
  const def = BEHAVIORS[name];
  return def.durMin + rand() * (def.durMax - def.durMin);
}

/** How long to relax at neutral before the next ambient action (seconds). */
export function nextGap(pool: Pool, rand: Rand): number {
  return pool === 'sad' ? 1.5 + rand() * 2 : 0.5 + rand() * 2.2;
}
