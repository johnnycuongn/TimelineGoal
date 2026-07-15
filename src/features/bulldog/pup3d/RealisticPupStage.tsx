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
 * a STATIC photoscan-grade mesh (no rig, no morphs), so emotions are procedural,
 * self-calibrated from the mesh at mount (nothing hand-tuned to this GLB):
 *
 *   happy (trigger 'happy'/'party')  — double/triple hop with squash-and-stretch
 *     landings, a little body shimmy, FAST tail wag (vertex-shader bend around
 *     the auto-detected tail tip) and a pink tongue blep sliding out of the
 *     auto-detected muzzle. Happy EYES need morph targets a scan doesn't have —
 *     that lands with the rigged-model upgrade path (see design doc).
 *   sad   (trigger 'pout'/'sleepy')  — tail droops, nose dips, breathing slows.
 *   neutral (idle)                   — soft breathing + a lazy occasional sway.
 *
 * Horizontal drag spins the turntable (user-driven, so fine under Reduce Motion).
 * The GL canvas eats touches — gestures live on a transparent overlay ABOVE it.
 */
/* eslint-disable react/no-unknown-property -- react-three-fiber JSX sets three.js object properties */

import { useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Device from 'expo-device';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import {
  Box3,
  MathUtils,
  Matrix4,
  PCFShadowMap,
  PMREMGenerator,
  Quaternion,
  Vector3,
} from 'three';
import type { Group, IUniform, Mesh, MeshStandardMaterial } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { Text } from '@/components/text';
import { haptics, spacing } from '@/theme';
import { useBulldogStore } from '../store';

// fiber 9.6.1 still constructs THREE.Clock, which three 0.185 deprecated —
// library noise we can't fix from app code; keep dev LogBox useful.
LogBox.ignoreLogs(['THREE.Clock: This module has been deprecated.']);

const FLOOR_Y = -1.05;
const HOP_VELOCITY = 3.2; // world u/s → apex ≈ 0.43u, a cute ~30%-of-body hop
const GRAVITY = 12;
const HERO_ANGLE = -0.35; // initial turntable angle, slightly toward the camera
const TONGUE_PINK = '#D96A7E'; // art constant — puppy tongue

/** Per-mesh uniforms driving the tail-bend shader (updated every frame). */
interface WagSet {
  uWag: IUniform<number>;
  uDroop: IUniform<number>;
}

/**
 * Offline image-based lighting: bake three's built-in RoomEnvironment (a lit
 * studio box — zero assets, zero network) into a PMREM env map. This is what
 * makes PBR materials read as "real" instead of flat-lit.
 */
function StudioLighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.9; // key light adds the warmth on top
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/**
 * Inject a localized bend into a standard material's vertex shader: vertices
 * within radius uR of the tail tip rotate around the tail root — yaw = wag,
 * pitch = droop — with smooth falloff. All in the MESH's object space; the
 * caller passes pre-transformed axes so this stays model-agnostic.
 */
function patchTailWag(
  mat: MeshStandardMaterial,
  local: { tip: Vector3; rear: Vector3; up: Vector3; side: Vector3; r: number },
): WagSet {
  const set: WagSet = { uWag: { value: 0 }, uDroop: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWag = set.uWag;
    shader.uniforms.uDroop = set.uDroop;
    shader.uniforms.uTip = { value: local.tip };
    shader.uniforms.uRear = { value: local.rear };
    shader.uniforms.uUp = { value: local.up };
    shader.uniforms.uSide = { value: local.side };
    shader.uniforms.uR = { value: local.r };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        [
          'uniform float uWag; uniform float uDroop; uniform float uR;',
          'uniform vec3 uTip; uniform vec3 uRear; uniform vec3 uUp; uniform vec3 uSide;',
          '#include <common>',
        ].join('\n'),
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '{',
          '  float w = 1.0 - smoothstep(0.0, uR, distance(transformed, uTip));',
          '  if (w > 0.001) {',
          '    vec3 root = uTip - uRear * uR;',
          '    vec3 p = transformed - root;',
          '    float a = uWag * w;',
          '    p = p * cos(a) + cross(uUp, p) * sin(a) + uUp * dot(uUp, p) * (1.0 - cos(a));',
          '    float b = uDroop * w;',
          '    p = p * cos(b) + cross(uSide, p) * sin(b) + uSide * dot(uSide, p) * (1.0 - cos(b));',
          '    transformed = root + p;',
          '  }',
          '}',
        ].join('\n'),
      );
  };
  mat.needsUpdate = true;
  return set;
}

function PuppyModel({ spin }: { spin: MutableRefObject<number> }) {
  const reduceMotion = useReducedMotion();
  const outer = useRef<Group>(null);
  const tongue = useRef<Mesh>(null);
  // No Draco / no meshopt (no Workers/WASM in RN) — plain GLB only, and skipping
  // the decoders keeps drei from wiring its CDN-pathed loaders at all.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gltf = useGLTF(require('../../../../assets/models/bulldog-puppy.glb'), false, false) as unknown as {
    scene: Group;
  };
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  // Framing + motion state live in refs — the render loop mutates them directly.
  const fit = useRef({ s: 1, halfToFeet: 0, ready: false });
  const hop = useRef({ y: 0, vy: 0, queued: 0 });
  const squash = useRef(0);
  const wobble = useRef(0);
  const excite = useRef(0); // 0..1 happiness envelope (wag speed, blep, shimmy)
  const droop = useRef(0); // 0..1 sadness envelope (tail down, nose dip)
  const blep = useRef(0);
  const wagSets = useRef<WagSet[]>([]);
  const moodRef = useRef(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  // Mouth anchor + face direction for the tongue, found during calibration.
  // A ref, not state: the R3F root mounts asynchronously and a setState from
  // this effect trips React's "update on a component that hasn't mounted yet"
  // — the frame loop applies these imperatively instead.
  const snout = useRef<{ mouth: Vector3; face: Vector3; quat: Quaternion } | null>(null);

  // AUTO-FRAME + EMOTION CALIBRATION, all from the measured mesh (scan node
  // scales are never trustworthy, and nothing here is hand-tuned to this GLB):
  // frame from the Box3; face direction = eyes-center minus body-center; tail
  // tip = rear-most high vertex; muzzle = front-most mid-height vertex.
  useEffect(() => {
    const g = outer.current;
    if (!g) return;
    // Measure against a clean identity transform: on remounts (fast refresh,
    // Den toggle) R3F can recycle the group with the previous scale/position
    // still applied, and Box3/matrixWorld work in WORLD space — measuring
    // through a stale ~0.04 scale would compound into a gigantic pup.
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

    // Sort meshes: eyes tell us which end is the face.
    const bodies: Mesh[] = [];
    let eyes: Mesh | null = null;
    gltf.scene.traverse((obj) => {
      if (!(obj as Mesh).isMesh) return;
      const m = obj as Mesh;
      m.castShadow = true;
      const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name;
      if (name === 'Eyes') eyes = m;
      else bodies.push(m);
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

    // Hunt world-space extremes on the body meshes: the tail tip is the
    // rear-most vertex in the top half; the nose the front-most mid-height one.
    const v = new Vector3();
    const tailTip = new Vector3();
    const nose = new Vector3();
    let bestTail = -Infinity;
    let bestNose = -Infinity;
    const yLo = box.min.y;
    const h = size.y;
    for (const m of bodies) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const yFrac = (v.y - yLo) / h;
        const alongRear = v.dot(rear);
        const alongFace = v.dot(face);
        if (yFrac > 0.55 && alongRear > bestTail) {
          bestTail = alongRear;
          tailTip.copy(v);
        }
        if (yFrac > 0.3 && yFrac < 0.62 && alongFace > bestNose) {
          bestNose = alongFace;
          nose.copy(v);
        }
      }
    }

    // Wire the tail-bend shader into each body mesh with the tip/axes expressed
    // in THAT mesh's object space (meshes can carry different node transforms).
    const wagRadius = maxDim * 0.17;
    const inv = new Matrix4();
    wagSets.current = bodies.map((m) => {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
      const own = mat.clone(); // per-mesh clone so uniforms don't cross meshes
      m.material = own;
      inv.copy(m.matrixWorld).invert();
      const scaleComp = inv.getMaxScaleOnAxis();
      return patchTailWag(own, {
        tip: tailTip.clone().applyMatrix4(inv),
        rear: rear.clone().transformDirection(inv),
        up: up.clone().transformDirection(inv),
        side: side.clone().transformDirection(inv),
        r: wagRadius * scaleComp,
      });
    });

    // Tongue anchor: a whisker below the nose tip, tucked slightly inward; the
    // blep slides out along `face`. Coordinates are group-space, so subtract the
    // same centering offset the scene itself gets below.
    const mouth = nose
      .clone()
      .addScaledVector(up, -0.035 * h)
      .addScaledVector(face, 0.008 * maxDim)
      .sub(center);
    const tilt = face.clone().addScaledVector(up, -0.35).normalize();
    snout.current = {
      mouth,
      face,
      quat: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tilt),
    };

    gltf.scene.position.set(-center.x, -center.y, -center.z);
    g.rotation.y = spin.current; // the frame loop owns rotation from here on
    fit.current = { s, halfToFeet: (center.y - box.min.y) * s, ready: true };
  }, [gltf.scene, spin]);

  // Transient moods → procedural moves (no rig, so whole-body physics): happy
  // hops twice, party three times, proud does a chest-pop hop-lite, love
  // wiggles. Mirrors Pup3DStage's timer-based mood reset so the NEXT
  // tap/check-in retriggers.
  useEffect(() => {
    if (mood !== 'happy' && mood !== 'party' && mood !== 'love' && mood !== 'proud') return;
    if (!reduceMotion) {
      if (mood === 'happy') {
        hop.current.vy = HOP_VELOCITY;
        hop.current.queued = 1;
      } else if (mood === 'party') {
        hop.current.vy = HOP_VELOCITY * 1.15;
        hop.current.queued = 2;
      } else if (mood === 'proud') {
        hop.current.vy = HOP_VELOCITY * 0.6;
      } else {
        wobble.current = 0.4;
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
    const d = Math.min(dt, 0.05); // clamp long frames so physics never explodes
    const m = moodRef.current;

    // Emotion envelopes (smooth in AND out so nothing ever snaps).
    const happyNow = m === 'happy' || m === 'party' || m === 'love' || m === 'proud';
    const sadNow = m === 'sleepy' || m === 'pout';
    excite.current = MathUtils.damp(excite.current, happyNow && !reduceMotion ? 1 : 0, happyNow ? 8 : 2.2, d);
    droop.current = MathUtils.damp(droop.current, sadNow ? 1 : 0, 2.5, d);

    // Turntable follows the drag target; happiness adds a tiny shimmy on top.
    const shimmy = reduceMotion ? 0 : excite.current * Math.sin(t * 9) * 0.06;
    g.rotation.y = MathUtils.damp(g.rotation.y, spin.current + shimmy, 6, d);

    // Hop ballistics; landings charge the squash and chain queued hops.
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
    wobble.current = MathUtils.damp(wobble.current, 0, 4, d);

    const breath = reduceMotion ? 0 : Math.sin(t * (sadNow ? 0.9 : 1.7)) * 0.007;
    const my = 1 - squash.current + breath;

    // Squash-and-stretch around the FEET: y-scale changes are compensated in
    // position so paws stay planted on the floor instead of sinking/floating.
    g.scale.set(s * (1 + squash.current * 0.5), s * my, s * (1 + squash.current * 0.5));
    g.position.y = FLOOR_Y + halfToFeet * my + hop.current.y;
    g.rotation.z = wobble.current * Math.sin(t * 13);
    g.rotation.x = MathUtils.damp(g.rotation.x, droop.current * 0.09, 2.5, d);

    // Tail: lazy idle sway → excited blur-wag; sadness pins it down and stills it.
    const idleSway = reduceMotion ? 0 : Math.sin(t * 2.1) * 0.09 * (0.55 + 0.45 * Math.sin(t * 0.31));
    const happyWag = Math.sin(t * 21) * 0.5 * excite.current;
    const wag = (idleSway * (1 - excite.current) + happyWag) * (1 - droop.current * 0.85);
    for (const u of wagSets.current) {
      u.uWag.value = wag;
      // Negative: rotating rear-side content around `side = up × face` by a
      // POSITIVE angle lifts the tail (cross(side, rear) points up) — sadness
      // needs the opposite.
      u.uDroop.value = -droop.current * 0.55;
    }

    // Tongue blep rides the happiness envelope.
    blep.current = MathUtils.damp(blep.current, excite.current > 0.35 ? 1 : 0, 7, d);
    const tng = tongue.current;
    const sn = snout.current;
    if (tng && sn) {
      const out = blep.current;
      tng.visible = out > 0.02;
      tng.quaternion.copy(sn.quat);
      tng.position
        .copy(sn.mouth)
        .addScaledVector(sn.face, 0.05 * out * (1 + 0.12 * Math.sin(t * 12)));
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

  // Drag spins, tap bounces. runOnJS: the callbacks mutate plain refs read by
  // three's JS-thread render loop, so they must not be workletized.
  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      // Horizontal-only activation: the Den hero lives in a ScrollView and the
      // turntable must never capture vertical scroll swipes.
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

  // The iOS SIMULATOR's GL initializes but never presents a frame (verified
  // 2026-07-12). Real iPhones and Android are fine — say so, don't show a void.
  const frame = width != null ? { height, width, alignSelf: 'center' as const } : { height };

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
        // Explicit PCF: bare `shadows` means PCFSoft, which three 0.185 deprecated
        // (it falls back to PCF with a LogBox warning on every mount).
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
          <PuppyModel spin={spin} />
        </Suspense>
      </Canvas>
      {/* Transparent gesture layer ABOVE the canvas — the GL view eats touches otherwise. */}
      <GestureDetector gesture={gestures}>
        <View
          accessibilityRole="button"
          accessibilityLabel="Spin the pup around, or tap him for a bounce"
          style={StyleSheet.absoluteFill}
        />
      </GestureDetector>
      {showHint ? (
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          real pup (beta) — spin him around, tap for a bounce 🐾
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
