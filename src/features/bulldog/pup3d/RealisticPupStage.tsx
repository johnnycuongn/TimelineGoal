/**
 * RealisticPupStage — the most realistic pup we can ship inside Expo Go.
 *
 * Same stack as Pup3DStage (three + fiber/native + drei/native + expo-gl) with a
 * realism pipeline on top: RoomEnvironment IBL baked via PMREM (offline — drei's
 * <Environment> presets fetch HDRs from a CDN, banned), one warm key light with a
 * soft contact shadow on a ShadowMaterial floor, and fiber's default sRGB + ACES
 * tone mapping. Design + sourcing notes: docs/design/frenchie-3d-design.md.
 *
 * Model: CC-BY "Bulldog Puppy" by doinspire (assets/models/MODEL-LICENSE.md) —
 * a STATIC photoscan-grade mesh (no rig, no morphs), so ALL life is procedural,
 * self-calibrated from the mesh at mount (nothing hand-tuned to this GLB).
 *
 * NATURALNESS — what keeps a rig-less mesh from reading like a shoved-around toy:
 *  1. The HEAD articulates independently of the body. A vertex shader bends the
 *     head region (found at calibration) around the neck; jowls and ears lag the
 *     nose via distance falloff. Deliberate looks/tilts/sniffs are HEAD moves; the
 *     body only turns to walk or reorient. This is the big one — dogs lead with
 *     the head.
 *  2. He is NEVER perfectly still: `idleFidget` is an always-on micro layer
 *     (head sway, weight-shift, breathing) so he breathes and shifts between
 *     actions instead of freezing at a pose.
 *  3. The head is SPRING-driven — a look snaps then settles with a hint of
 *     overshoot, never a uniform linear pan. Fast texture (head-shake, walk-nod)
 *     is layered additively so the spring doesn't smear it.
 *
 * WHAT he does is decided by pupBehaviors.ts (ethogram + weighted scheduler with
 * light chaining). Reduce Motion → scheduler + fidget off, he holds still.
 * Horizontal drag spins the turntable; tap bounces him.
 */
/* eslint-disable react/no-unknown-property -- react-three-fiber JSX sets three.js object properties */

import { useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Device from 'expo-device';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { Box3, MathUtils, Matrix4, PCFShadowMap, PMREMGenerator, Quaternion, Vector3 } from 'three';
import type { Group, IUniform, Mesh, MeshStandardMaterial } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { Text } from '@/components/text';
import { haptics, spacing } from '@/theme';
import { useBulldogStore } from '../store';
import {
  behaviorDuration,
  BEHAVIORS,
  idleFidget,
  neutralOsc,
  neutralTarget,
  nextGap,
  pickBehavior,
  resetOsc,
  resetTarget,
  TRANSITIONS,
  type Pool,
  type PupOsc,
  type PupTarget,
} from './pupBehaviors';

// fiber 9.6.1 still constructs THREE.Clock, which three 0.185 deprecated —
// library noise we can't fix from app code; keep dev LogBox useful.
LogBox.ignoreLogs(['THREE.Clock: This module has been deprecated.']);

const FLOOR_Y = -1.05;
const HOP_VELOCITY = 3.2;
const GRAVITY = 12;
const HERO_ANGLE = -0.35;
const TONGUE_PINK = '#D96A7E';

/** Per-mesh uniforms driving the head + tail + leg shader (updated every frame). */
interface DeformSet {
  uHeadYaw: IUniform<number>;
  uHeadPitch: IUniform<number>;
  uHeadRoll: IUniform<number>;
  uWag: IUniform<number>;
  uDroop: IUniform<number>;
  /** Per-leg swing (fore/aft) and ankle-lift, indexed [FL, FR, BL, BR] by (front/back, side). */
  swing: IUniform<number>[];
  lift: IUniform<number>[];
}

/** A tiny under-damped spring — snap toward target with a hint of overshoot, then settle. */
interface Spring {
  x: number;
  v: number;
}
function springTo(s: Spring, target: number, k: number, c: number, dt: number): void {
  const a = -k * (s.x - target) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

function StudioLighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.9;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface HeadParams {
  neck: Vector3;
  face: Vector3;
  up: Vector3;
  side: Vector3;
  r: number;
}
interface TailParams {
  tip: Vector3;
  rear: Vector3;
  up: Vector3;
  side: Vector3;
  r: number;
}
interface LegParams {
  bodyC: Vector3; // body center (object space) — classifies which leg a vertex is
  hipPt: Vector3; // a point at hip height — measures how far below the hip a vertex is
  legLen: number; // hip → paw
  hips: [Vector3, Vector3, Vector3, Vector3]; // per-leg pivot, [FL, FR, BL, BR]
}

/**
 * Inject head + tail + leg articulation into a standard material's vertex shader.
 *  HEAD: vertices forward-of and at/above the neck rotate around the neck pivot
 *    (yaw/pitch/roll), weighted by forward distance × height so the nose swings
 *    most and jowls/ears lag; front paws (forward but LOW) are gated out by height.
 *  TAIL: rear-tip vertices bend for wag/droop.
 *  LEGS: vertices BELOW the hip line are classified into four quadrants (front/back
 *    × side) and each swings fore/aft around its own hip pivot, more at the paw
 *    (a knee-ish bend), with an extra ankle flex near the bottom. Leg axes reuse
 *    the head's up/side/face (same mesh). All in the mesh's object space.
 */
function patchDeform(
  mat: MeshStandardMaterial,
  head: HeadParams,
  tail: TailParams,
  legs: LegParams,
): DeformSet {
  const swing = [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }];
  const lift = [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }];
  const set: DeformSet = {
    uHeadYaw: { value: 0 },
    uHeadPitch: { value: 0 },
    uHeadRoll: { value: 0 },
    uWag: { value: 0 },
    uDroop: { value: 0 },
    swing,
    lift,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uHeadYaw: set.uHeadYaw,
      uHeadPitch: set.uHeadPitch,
      uHeadRoll: set.uHeadRoll,
      uWag: set.uWag,
      uDroop: set.uDroop,
      uNeck: { value: head.neck },
      uHFace: { value: head.face },
      uHUp: { value: head.up },
      uHSide: { value: head.side },
      uHeadR: { value: head.r },
      uTip: { value: tail.tip },
      uTRear: { value: tail.rear },
      uTUp: { value: tail.up },
      uTSide: { value: tail.side },
      uTailR: { value: tail.r },
      uBodyC: { value: legs.bodyC },
      uHipPt: { value: legs.hipPt },
      uLegLen: { value: legs.legLen },
      uHip0: { value: legs.hips[0] },
      uHip1: { value: legs.hips[1] },
      uHip2: { value: legs.hips[2] },
      uHip3: { value: legs.hips[3] },
      uSwing0: swing[0],
      uSwing1: swing[1],
      uSwing2: swing[2],
      uSwing3: swing[3],
      uLift0: lift[0],
      uLift1: lift[1],
      uLift2: lift[2],
      uLift3: lift[3],
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        [
          'uniform float uHeadYaw; uniform float uHeadPitch; uniform float uHeadRoll; uniform float uHeadR;',
          'uniform vec3 uNeck; uniform vec3 uHFace; uniform vec3 uHUp; uniform vec3 uHSide;',
          'uniform float uWag; uniform float uDroop; uniform float uTailR;',
          'uniform vec3 uTip; uniform vec3 uTRear; uniform vec3 uTUp; uniform vec3 uTSide;',
          'uniform vec3 uBodyC; uniform vec3 uHipPt; uniform float uLegLen;',
          'uniform vec3 uHip0; uniform vec3 uHip1; uniform vec3 uHip2; uniform vec3 uHip3;',
          'uniform float uSwing0; uniform float uSwing1; uniform float uSwing2; uniform float uSwing3;',
          'uniform float uLift0; uniform float uLift1; uniform float uLift2; uniform float uLift3;',
          'vec3 rotAxis(vec3 p, vec3 ax, float a){ return p*cos(a) + cross(ax,p)*sin(a) + ax*dot(ax,p)*(1.0-cos(a)); }',
          '#include <common>',
        ].join('\n'),
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '{',
          '  float hf = dot(transformed - uNeck, uHFace);',
          '  float hu = dot(transformed - uNeck, uHUp);',
          '  float wH = smoothstep(0.0, uHeadR, hf) * smoothstep(-0.18*uHeadR, 0.06*uHeadR, hu);',
          '  if (wH > 0.001) {',
          '    vec3 p = transformed - uNeck;',
          '    p = rotAxis(p, uHUp, uHeadYaw*wH);',
          '    p = rotAxis(p, uHSide, uHeadPitch*wH);',
          '    p = rotAxis(p, uHFace, uHeadRoll*wH);',
          '    transformed = uNeck + p;',
          '  }',
          // legs: below the hip line only
          '  float below = dot(uHipPt - transformed, uHUp);',
          '  float low = smoothstep(0.0, uLegLen, below);',
          '  if (low > 0.001) {',
          '    float fS = dot(transformed - uBodyC, uHFace);',
          '    float sS = dot(transformed - uBodyC, uHSide);',
          '    vec3 hip; float sw; float lf;',
          '    if (fS > 0.0) { if (sS > 0.0) { hip=uHip0; sw=uSwing0; lf=uLift0; } else { hip=uHip1; sw=uSwing1; lf=uLift1; } }',
          '    else { if (sS > 0.0) { hip=uHip2; sw=uSwing2; lf=uLift2; } else { hip=uHip3; sw=uSwing3; lf=uLift3; } }',
          '    vec3 p = transformed - hip;',
          '    p = rotAxis(p, uHSide, sw * (0.35 + 0.65*low));', // swing, knee-ish
          '    p = rotAxis(p, uHSide, lf * smoothstep(0.6, 1.0, low));', // ankle/paw flex
          '    transformed = hip + p;',
          '  }',
          '  float wT = 1.0 - smoothstep(0.0, uTailR, distance(transformed, uTip));',
          '  if (wT > 0.001) {',
          '    vec3 root = uTip - uTRear * uTailR;',
          '    vec3 p = transformed - root;',
          '    p = rotAxis(p, uTUp, uWag*wT);',
          '    p = rotAxis(p, uTSide, uDroop*wT);',
          '    transformed = root + p;',
          '  }',
          '}',
        ].join('\n'),
      );
  };
  mat.needsUpdate = true;
  return set;
}

function PuppyModel({ spin, roam }: { spin: MutableRefObject<number>; roam: number }) {
  const reduceMotion = useReducedMotion();
  const outer = useRef<Group>(null);
  const tongue = useRef<Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gltf = useGLTF(require('../../../../assets/models/bulldog-puppy.glb'), false, false) as unknown as {
    scene: Group;
  };
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  const fit = useRef({ s: 1, halfToFeet: 0, ready: false });
  const hop = useRef({ y: 0, vy: 0, queued: 0 });
  const squash = useRef(0);
  const joySpin = useRef(0);
  const spinCur = useRef(HERO_ANGLE);
  const deform = useRef<DeformSet[]>([]);

  // Damped body posture + oscillators; scratch objects the behaviors write into.
  const cur = useRef<PupTarget>(neutralTarget());
  const oscCur = useRef<PupOsc>(neutralOsc());
  const tScratch = useRef<PupTarget>(neutralTarget());
  const oScratch = useRef<PupOsc>(neutralOsc());
  // The head rides springs (deliberate look = snap + settle), the body rides damps.
  const hYaw = useRef<Spring>({ x: 0, v: 0 });
  const hPitch = useRef<Spring>({ x: 0, v: 0 });
  const hRoll = useRef<Spring>({ x: 0, v: 0 });

  const behav = useRef<{ name: string; elapsed: number; dur: number; params: Record<string, number> } | null>(
    null,
  );
  const gap = useRef(0.6);
  const lastName = useRef<string>('standWatch');

  const moodRef = useRef(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  // Tongue anchor + head frame (group space), for keeping the blep on the moving muzzle.
  const snout = useRef<{
    mouth: Vector3;
    neck: Vector3;
    face: Vector3;
    up: Vector3;
    side: Vector3;
    quat: Quaternion;
  } | null>(null);

  // AUTO-FRAME + ARTICULATION CALIBRATION, all from the measured mesh.
  useEffect(() => {
    const g = outer.current;
    if (!g) return;
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    gltf.scene.position.set(0, 0, 0);
    g.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim <= 0) return;
    const s = 2.0 / maxDim;

    // Eyes tell us which end is the face.
    const meshes: Mesh[] = [];
    let eyes: Mesh | null = null;
    gltf.scene.traverse((obj) => {
      if (!(obj as Mesh).isMesh) return;
      const m = obj as Mesh;
      m.castShadow = true;
      meshes.push(m);
      const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name;
      if (name === 'Eyes') eyes = m;
    });

    const face = new Vector3(0, 0, 1);
    if (eyes) {
      const eyesCenter = new Box3().setFromObject(eyes).getCenter(new Vector3());
      face.copy(eyesCenter.sub(center)).setY(0);
      if (face.lengthSq() < 1e-6) face.set(0, 0, 1);
      face.normalize();
    }
    const rear = face.clone().negate();
    const up = new Vector3(0, 1, 0);
    const side = new Vector3().crossVectors(up, face).normalize();

    // World-space extremes: tail tip (rear-most, upper) and nose (front-most, mid);
    // and bin the lower-body vertices into the four legs (front/back × side) to
    // find each leg's hip pivot.
    const v = new Vector3();
    const tailTip = new Vector3();
    const nose = new Vector3();
    let bestTail = -Infinity;
    let bestNose = -Infinity;
    const yLo = box.min.y;
    const h = size.y;
    const hipY = yLo + 0.42 * h;
    const legSum = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const legN = [0, 0, 0, 0];
    for (const m of meshes) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const yFrac = (v.y - yLo) / h;
        if (yFrac > 0.55 && v.dot(rear) > bestTail) {
          bestTail = v.dot(rear);
          tailTip.copy(v);
        }
        if (yFrac > 0.3 && yFrac < 0.62 && v.dot(face) > bestNose) {
          bestNose = v.dot(face);
          nose.copy(v);
        }
        if (yFrac < 0.4) {
          const fS =
            (v.x - center.x) * face.x + (v.y - center.y) * face.y + (v.z - center.z) * face.z;
          const sS =
            (v.x - center.x) * side.x + (v.y - center.y) * side.y + (v.z - center.z) * side.z;
          const q = (fS > 0 ? 0 : 2) + (sS > 0 ? 0 : 1);
          legSum[q].add(v);
          legN[q]++;
        }
      }
    }

    // Neck pivot: between the body center and the nose, a touch above center.
    const noseFwd = nose.clone().sub(center).dot(face);
    const neck = center
      .clone()
      .addScaledVector(face, noseFwd * 0.38)
      .addScaledVector(up, h * 0.06);
    const headR = Math.max(noseFwd * 0.62, maxDim * 0.2);
    const tailR = maxDim * 0.17;

    // Each leg's hip pivot: the bin's horizontal centroid, raised to the hip line.
    // Fallback for an empty bin: a sensible offset from center.
    const legOff = maxDim * 0.14;
    const hipsWorld: [Vector3, Vector3, Vector3, Vector3] = [0, 1, 2, 3].map((q) => {
      const p =
        legN[q] > 0
          ? legSum[q].clone().multiplyScalar(1 / legN[q])
          : center
              .clone()
              .addScaledVector(face, (q < 2 ? 1 : -1) * legOff)
              .addScaledVector(side, (q % 2 === 0 ? 1 : -1) * legOff);
      p.y = hipY;
      return p;
    }) as [Vector3, Vector3, Vector3, Vector3];
    const legLen = hipY - yLo;
    const hipPtWorld = new Vector3(center.x, hipY, center.z);

    // Wire the shader into EVERY mesh (head bend needs the eyes too), each in that
    // mesh's own object space.
    const inv = new Matrix4();
    deform.current = meshes.map((m) => {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
      const own = mat.clone();
      m.material = own;
      inv.copy(m.matrixWorld).invert();
      const sc = inv.getMaxScaleOnAxis();
      return patchDeform(
        own,
        {
          neck: neck.clone().applyMatrix4(inv),
          face: face.clone().transformDirection(inv),
          up: up.clone().transformDirection(inv),
          side: side.clone().transformDirection(inv),
          r: headR * sc,
        },
        {
          tip: tailTip.clone().applyMatrix4(inv),
          rear: rear.clone().transformDirection(inv),
          up: up.clone().transformDirection(inv),
          side: side.clone().transformDirection(inv),
          r: tailR * sc,
        },
        {
          bodyC: center.clone().applyMatrix4(inv),
          hipPt: hipPtWorld.clone().applyMatrix4(inv),
          legLen: legLen * sc,
          hips: [
            hipsWorld[0].clone().applyMatrix4(inv),
            hipsWorld[1].clone().applyMatrix4(inv),
            hipsWorld[2].clone().applyMatrix4(inv),
            hipsWorld[3].clone().applyMatrix4(inv),
          ],
        },
      );
    });

    // Tongue lives in group space (scene is re-centered by −center below).
    const mouth = nose
      .clone()
      .addScaledVector(up, -0.035 * h)
      .addScaledVector(face, 0.008 * maxDim)
      .sub(center);
    const tilt = face.clone().addScaledVector(up, -0.35).normalize();
    snout.current = {
      mouth,
      neck: neck.clone().sub(center),
      face: face.clone(),
      up: up.clone(),
      side: side.clone(),
      quat: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tilt),
    };

    gltf.scene.position.set(-center.x, -center.y, -center.z);
    g.rotation.y = spin.current;
    fit.current = { s, halfToFeet: (center.y - box.min.y) * s, ready: true };
  }, [gltf.scene, spin]);

  // Transient moods → scripted one-shots that INTERRUPT the ambient action.
  useEffect(() => {
    if (mood !== 'happy' && mood !== 'party' && mood !== 'love' && mood !== 'proud') return;
    behav.current = null;
    if (!reduceMotion) {
      if (mood === 'happy') {
        hop.current.vy = HOP_VELOCITY;
        hop.current.queued = 1;
      } else if (mood === 'party') {
        hop.current.vy = HOP_VELOCITY * 1.15;
        hop.current.queued = 2;
        joySpin.current = Math.PI * 2;
      } else if (mood === 'proud') {
        hop.current.vy = HOP_VELOCITY * 0.6;
      }
    }
    const timer = setTimeout(setIdle, 1500);
    return () => clearTimeout(timer);
  }, [mood, nonce, reduceMotion, setIdle]);

  useFrame((state, dt) => {
    const g = outer.current;
    if (!g || !fit.current.ready) return;
    const { s, halfToFeet } = fit.current;
    const t = state.clock.elapsedTime;
    const d = Math.min(dt, 0.04);
    const m = moodRef.current;

    const T = tScratch.current;
    const O = oScratch.current;
    resetTarget(T);
    resetOsc(O);

    const happyNow = m === 'happy' || m === 'party' || m === 'love' || m === 'proud';
    if (happyNow && !reduceMotion) {
      O.wagAmp = 0.5;
      O.wagSpeed = 22;
      T.mouth = 1;
      T.headPitch = 6 * Math.PI / 180; // ears-up, excited
      if (m === 'love') T.roll = Math.sin(t * 10) * 0.12;
    } else if (!reduceMotion) {
      // Ambient scheduler with light chaining.
      const pool: Pool = m === 'pout' ? 'sad' : m === 'sleepy' ? 'nap' : 'neutral';
      let b = behav.current;
      if (b && BEHAVIORS[b.name].pool !== pool) {
        b = behav.current = null;
        gap.current = 0;
      }
      if (!b) {
        gap.current -= d;
        if (gap.current <= 0) {
          const name = pickBehavior(pool, Math.random, TRANSITIONS[lastName.current]);
          lastName.current = name;
          behav.current = {
            name,
            elapsed: 0,
            dur: behaviorDuration(name, Math.random),
            params: BEHAVIORS[name].init?.(Math.random) ?? {},
          };
        }
      } else {
        b.elapsed += d;
        const k = b.elapsed / b.dur;
        if (k >= 1) {
          behav.current = null;
          gap.current = nextGap(pool, Math.random);
        } else {
          BEHAVIORS[b.name].run(k, b.params, T, O);
        }
      }
    }

    // ---- head springs (deliberate) ----
    springTo(hYaw.current, T.headYaw, 140, 17, d);
    springTo(hPitch.current, T.headPitch, 150, 18, d);
    springTo(hRoll.current, T.headRoll, 120, 16, d);

    // ---- body damps (heavier, no overshoot) ----
    const C = cur.current;
    const OC = oscCur.current;
    C.yaw = MathUtils.damp(C.yaw, T.yaw, 4, d);
    C.pitch = MathUtils.damp(C.pitch, T.pitch, 5, d);
    C.roll = MathUtils.damp(C.roll, T.roll, 5, d);
    C.x = MathUtils.damp(C.x, T.x, 2.2, d);
    C.z = MathUtils.damp(C.z, T.z, 2.2, d);
    C.sink = MathUtils.damp(C.sink, T.sink, 3, d);
    C.mouth = MathUtils.damp(C.mouth, T.mouth, 9, d);
    OC.wagAmp = MathUtils.damp(OC.wagAmp, O.wagAmp, 7, d);
    OC.wagSpeed = MathUtils.damp(OC.wagSpeed, O.wagSpeed, 7, d);
    OC.droop = MathUtils.damp(OC.droop, O.droop, 3, d);
    OC.bob = MathUtils.damp(OC.bob, O.bob, 7, d);
    OC.sway = MathUtils.damp(OC.sway, O.sway, 7, d);
    OC.wobble = MathUtils.damp(OC.wobble, O.wobble, 10, d);
    OC.headShake = MathUtils.damp(OC.headShake, O.headShake, 12, d);
    OC.breath = MathUtils.damp(OC.breath, O.breath, 3, d);
    OC.breathRate = MathUtils.damp(OC.breathRate, O.breathRate, 3, d);
    OC.twitch = O.twitch;

    // Hop ballistics.
    if (hop.current.vy !== 0 || hop.current.y > 0) {
      hop.current.vy -= GRAVITY * d;
      hop.current.y += hop.current.vy * d;
      if (hop.current.y <= 0) {
        hop.current.y = 0;
        hop.current.vy = 0;
        squash.current = 0.14;
        if (hop.current.queued > 0 && !reduceMotion) {
          hop.current.queued -= 1;
          hop.current.vy = HOP_VELOCITY * 0.78;
        }
      }
    }
    squash.current = MathUtils.damp(squash.current, 0, 9, d);
    joySpin.current = MathUtils.damp(joySpin.current, 0, 3, d);

    // ---- always-on micro-life (the thing that stops him freezing) ----
    const fid = reduceMotion ? { yaw: 0, pitch: 0, roll: 0, sway: 0 } : idleFidget(t);
    const walkNod = reduceMotion ? 0 : Math.sin(t * 8) * OC.bob * 2.2; // head dips per step
    const shake = reduceMotion ? 0 : Math.sin(t * 42) * OC.headShake;
    const breathPhase = reduceMotion ? 0 : Math.sin(t * 1.7 * OC.breathRate);

    // ---- compose ----
    const breath = breathPhase * 0.008 * OC.breath;
    const my = 1 + breath - C.sink * 0.12 - squash.current;
    const grow = 1 + squash.current * 0.5;
    g.scale.set(s * grow, s * my, s * grow);

    const groundLift = halfToFeet * my;
    const bodyBob = reduceMotion ? 0 : Math.sin(t * 8) * OC.bob + breathPhase * 0.004;
    g.position.set(
      C.x * roam,
      FLOOR_Y + groundLift + hop.current.y + bodyBob - C.sink * groundLift * 0.55,
      C.z * roam,
    );

    const shimmy = happyNow && !reduceMotion ? Math.sin(t * 9) * 0.06 : 0;
    spinCur.current = MathUtils.damp(spinCur.current, spin.current, 6, d);
    g.rotation.y = spinCur.current + C.yaw + shimmy + joySpin.current;
    g.rotation.x = C.pitch;
    const jitter = OC.twitch ? (Math.random() - 0.5) * OC.twitch : 0;
    g.rotation.z = C.roll + fid.sway * 0.012 + Math.sin(t * 38) * OC.wobble + jitter;

    // Head shader = spring (deliberate) + fidget + walk-nod + shake (fast, additive).
    const headYaw = hYaw.current.x + fid.yaw * 0.03 + shake;
    const headPitch = hPitch.current.x + fid.pitch * 0.022 + walkNod;
    const headRoll = hRoll.current.x + fid.roll * 0.02;

    // Legs: a diagonal-pair trot while walking (bob is the walk signal), plus a
    // gentle weight-shift and ankle flex at rest so the paws are never rigid.
    // Index [FL, FR, BL, BR] = (front/back, side); diagonal pairs {FL,BR}+{FR,BL}.
    const gait = reduceMotion ? 0 : Math.min(OC.bob / 0.028, 1);
    const gp = t * 6.5;
    const swA = gait * 0.15;
    const lfA = gait * 0.13;
    const a = Math.sin(gp); // FL & BR
    const b = Math.sin(gp + Math.PI); // FR & BL
    const wsh = reduceMotion ? 0 : (1 - gait) * fid.sway * 0.02; // lean weight side to side
    const al = reduceMotion ? 0 : (1 - gait) * Math.sin(t * 1.1) * 0.008; // idle ankle life
    const swing = [a * swA + wsh, b * swA - wsh, b * swA + wsh, a * swA - wsh];
    const lift = [
      Math.max(0, a) * lfA + al,
      Math.max(0, b) * lfA + al,
      Math.max(0, b) * lfA + al,
      Math.max(0, a) * lfA + al,
    ];

    const wag = reduceMotion ? 0 : Math.sin(t * OC.wagSpeed) * OC.wagAmp;
    for (const u of deform.current) {
      u.uHeadYaw.value = headYaw;
      u.uHeadPitch.value = headPitch;
      u.uHeadRoll.value = headRoll;
      u.uWag.value = wag;
      u.uDroop.value = -OC.droop * 0.55;
      for (let i = 0; i < 4; i++) {
        u.swing[i].value = swing[i];
        u.lift[i].value = lift[i];
      }
    }

    // Tongue tracks the moving muzzle: rotate the mouth anchor by the head angles.
    const tng = tongue.current;
    const sn = snout.current;
    if (tng && sn) {
      const out = C.mouth;
      tng.visible = out > 0.02;
      const p = tng.position.copy(sn.mouth).sub(sn.neck);
      p.applyAxisAngle(sn.up, headYaw);
      p.applyAxisAngle(sn.side, headPitch);
      p.applyAxisAngle(sn.face, headRoll);
      p.add(sn.neck).addScaledVector(sn.face, 0.05 * out * (1 + 0.12 * Math.sin(t * 12)));
      tng.quaternion.copy(sn.quat);
      const w = 2.4 * out;
      tng.scale.set(0.055 * w, 0.035 * w, 0.085 * w);
    }
  });

  return (
    <group ref={outer}>
      <primitive object={gltf.scene} />
      <mesh ref={tongue} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={TONGUE_PINK} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Visible Suspense fallback — if this never becomes the pup, the GLB failed to load. */
function LoadingCube() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.9;
      ref.current.rotation.y += delta * 1.3;
    }
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial color="#D9B48A" />
    </mesh>
  );
}

export default function RealisticPupStage({
  height = 260,
  width,
  showHint = true,
}: {
  height?: number;
  /** Fixed width (e.g. sitting inside the Den's pulse ring); stretches when omitted. */
  width?: number;
  showHint?: boolean;
}) {
  const trigger = useBulldogStore((s) => s.trigger);
  const spin = useRef(HERO_ANGLE);

  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-14, 14])
      .runOnJS(true)
      // eslint-disable-next-line react-hooks/refs -- gesture-handler onChange fires on touch events, never during render (compiler lint can't see through the RNGH builder)
      .onChange((e) => {
        spin.current += e.changeX * 0.012;
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        haptics.tick();
        trigger('happy');
      });
    return Gesture.Race(pan, tap);
  }, [trigger]);

  const frame = width != null ? { height, width, alignSelf: 'center' as const } : { height };
  // Small stages (the Den's pulse ring) get a tighter wander radius.
  const roam = width != null && width < 220 ? 0.35 : 1;

  if (Platform.OS === 'ios' && !Device.isDevice) {
    return (
      <View style={[styles.wrap, styles.simNote, frame]}>
        <Text variant="bodyLarge" style={styles.center}>
          🫥 → 🐶
        </Text>
        <Text variant="caption" color="textSecondary" style={styles.center}>
          The iOS simulator can’t draw 3D.{'\n'}Try the Android emulator or your iPhone!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, frame]}>
      <Canvas
        style={styles.flex}
        shadows={{ type: PCFShadowMap }}
        camera={{ position: [0, 1.0, 3.8], fov: 42 }}
        gl={{ antialias: true }}>
        <StudioLighting />
        <directionalLight
          position={[2.2, 4, 2.8]}
          intensity={1.5}
          color="#fff1e0"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-normalBias={0.02}
        />
        <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_Y} receiveShadow>
          <planeGeometry args={[9, 9]} />
          <shadowMaterial opacity={0.22} />
        </mesh>
        <Suspense fallback={<LoadingCube />}>
          <PuppyModel spin={spin} roam={roam} />
        </Suspense>
      </Canvas>
      <GestureDetector gesture={gestures}>
        <View
          accessibilityRole="button"
          accessibilityLabel="Spin the pup around, or tap him for a bounce"
          style={StyleSheet.absoluteFill}
        />
      </GestureDetector>
      {showHint ? (
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          watch him potter about · drag to spin · tap for a bounce 🐾
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  flex: { flex: 1 },
  hint: { textAlign: 'center', paddingTop: spacing.xs },
  simNote: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
