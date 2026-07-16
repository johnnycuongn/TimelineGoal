/**
 * RiggedPupStage — the realistic bulldog with REAL skeletal dog animations.
 *
 * Model: assets/models/bulldog-rigged.glb — the CC-BY doinspire bulldog-puppy
 * photoscan, rigged locally in Blender by transferring the CC0 Quaternius shiba
 * skeleton + clips onto it (see docs/design/frenchie-3d-design.md and
 * tools/rig_bulldog.py; provenance in MODEL-LICENSE.md). Twelve authored clips:
 * Idle, Idle_2, Idle_2_HeadLow, Walk, Gallop, Gallop_Jump, Jump_ToIdle, Eating,
 * Attack, Death, Idle_HitReact_Left/Right.
 *
 * This replaces the procedural mesh-bending of RealisticPupStage (kept as a
 * fallback) — the motion is now real quadruped animation:
 *   neutral — an ambient scheduler drifts between Idle / Idle_2 / Eating
 *             (reads as sniffing about) / Walk, with weighted picks and
 *             crossfades, so he genuinely potters.
 *   sad ('pout') / sleepy — Idle_2_HeadLow loop (head hung low).
 *   happy/party — Gallop_Jump (real jump); proud — chest-pop hit-react;
 *             love — the other hit-react (a head tilt/lean).
 *
 * Rendering identical to RealisticPupStage: RoomEnvironment PMREM IBL (offline),
 * warm key light + PCF contact shadow, fiber-default sRGB + ACES. Reduce Motion
 * freezes the mixer. Horizontal drag spins the turntable; tap plays the jump.
 */
/* eslint-disable react/no-unknown-property -- react-three-fiber JSX sets three.js object properties */

import { useAnimations, useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Device from 'expo-device';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { Box3, LoopOnce, LoopRepeat, MathUtils, PCFShadowMap, PMREMGenerator, Vector3 } from 'three';
import type { AnimationAction, Group, Mesh } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { Text } from '@/components/text';
import { haptics, spacing } from '@/theme';
import { useBulldogStore } from '../store';

// fiber 9.6.1 still constructs THREE.Clock, which three 0.185 deprecated —
// library noise we can't fix from app code; keep dev LogBox useful.
LogBox.ignoreLogs(['THREE.Clock: This module has been deprecated.']);

const FLOOR_Y = -1.05;
const HERO_ANGLE = -0.35;
const FADE = 0.35; // crossfade seconds between clips

/** Ambient repertoire while idle: [clip, weight, min..max seconds to stay on it]. */
const IDLE_POOL: [string, number, number, number][] = [
  ['Idle', 8, 6, 12],
  ['Idle_2', 4, 5, 9],
  ['Eating', 3, 4, 8], // head-down forage — reads as sniffing about
  ['Walk', 3, 3, 6], // in-place trot — pottering
];

function pickIdleClip(): [string, number] {
  const total = IDLE_POOL.reduce((s, e) => s + e[1], 0);
  let r = Math.random() * total;
  for (const [name, w, lo, hi] of IDLE_POOL) {
    r -= w;
    if (r <= 0) return [name, (lo + Math.random() * (hi - lo)) * 1000];
  }
  const last = IDLE_POOL[IDLE_POOL.length - 1];
  return [last[0], last[2] * 1000];
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

function PuppyModel({ spin }: { spin: MutableRefObject<number> }) {
  const reduceMotion = useReducedMotion();
  const outer = useRef<Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gltf = useGLTF(require('../../../../assets/models/bulldog-rigged.glb'), false, false) as unknown as {
    scene: Group;
    animations: import('three').AnimationClip[];
  };
  const { actions, mixer } = useAnimations(gltf.animations, outer);
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  const fit = useRef({ ready: false });
  const active = useRef<AnimationAction | null>(null);

  // AUTO-FRAME once, against a clean identity transform (remounts can recycle
  // the group with stale scale — measuring through it compounds; see the
  // RealisticPupStage gotcha). Static framing: animations move bones, not the group.
  useEffect(() => {
    const g = outer.current;
    if (!g) return;
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    gltf.scene.position.set(0, 0, 0);
    g.updateWorldMatrix(true, true);
    gltf.scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) (obj as Mesh).castShadow = true;
    });
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim <= 0) return;
    const s = 2.0 / maxDim;
    gltf.scene.position.set(-center.x, -center.y, -center.z);
    g.scale.setScalar(s);
    g.position.y = FLOOR_Y + (center.y - box.min.y) * s;
    g.rotation.y = spin.current;
    fit.current.ready = true;
  }, [gltf.scene, spin]);

  // ONE state machine: mood decides the clip; idle runs the ambient scheduler.
  // playClip lives inside the effect (not render) — crossfades the previous
  // clip out while the next eases in.
  useEffect(() => {
    const playClip = (name: string, once = false): number => {
      const next = actions[name];
      if (!next) return 0;
      if (active.current === next && !once) return 0;
      next.reset();
      if (once) {
        next.setLoop(LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(LoopRepeat, Infinity);
      }
      if (active.current && active.current !== next) {
        active.current.crossFadeTo(next.play(), FADE, false);
      } else {
        next.fadeIn(FADE).play();
      }
      active.current = next;
      return next.getClip().duration * 1000;
    };

    mixer.timeScale = reduceMotion ? 0 : 1;
    if (reduceMotion) {
      playClip('Idle');
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (mood === 'happy' || mood === 'party') {
      const ms = playClip('Gallop_Jump', true);
      timer = setTimeout(setIdle, Math.max(ms - 100, 400));
    } else if (mood === 'proud') {
      const ms = playClip('Idle_HitReact_Left', true);
      timer = setTimeout(setIdle, Math.max(ms - 100, 400));
    } else if (mood === 'love') {
      const ms = playClip('Idle_HitReact_Right', true);
      timer = setTimeout(setIdle, Math.max(ms - 100, 400));
    } else if (mood === 'sleepy' || mood === 'pout') {
      playClip('Idle_2_HeadLow');
    } else {
      // idle — ambient life: drift between clips with weighted picks.
      const step = (first: boolean) => {
        const [name, holdMs] = first ? (['Idle', 4000] as [string, number]) : pickIdleClip();
        playClip(name);
        timer = setTimeout(() => step(false), holdMs);
      };
      step(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mood, nonce, reduceMotion, mixer, actions, setIdle]);

  useFrame((_, dt) => {
    const g = outer.current;
    if (!g || !fit.current.ready) return;
    g.rotation.y = MathUtils.damp(g.rotation.y, spin.current, 6, Math.min(dt, 0.05));
  });

  return (
    <group ref={outer}>
      <primitive object={gltf.scene} />
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

export default function RiggedPupStage({
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
          <PuppyModel spin={spin} />
        </Suspense>
      </Canvas>
      <GestureDetector gesture={gestures}>
        <View
          accessibilityRole="button"
          accessibilityLabel="Spin the pup around, or tap him for zoomies"
          style={StyleSheet.absoluteFill}
        />
      </GestureDetector>
      {showHint ? (
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          real dog moves — drag to spin · tap for zoomies 🐾
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
