/**
 * Pup3DStage — EXPERIMENTAL true-3D pup (prototype behind a Den toggle).
 *
 * three.js + @react-three/fiber(native) + expo-gl — the one 3D combo that runs in
 * Expo Go on SDK 57. Model: CC0 Quaternius Shiba (assets/models/shiba.glb, see
 * MODEL-LICENSE.md) — real eye meshes, ~1.9k tris, no textures — coat tinted to
 * Mochi's latte brown.
 *
 * Mood → clip: idle=Idle loop · happy/check-in/tap=Gallop_Jump (crossfade, once) ·
 * love=head-tilt react · sleepy=Idle_2_HeadLow loop. Reduce Motion → frozen pose.
 *
 * Rendering notes:
 *  - Touches: the GL canvas swallows gestures, so the tap target is a transparent
 *    overlay ABOVE the canvas, not a wrapper around it.
 *  - Auto-frames the model from its measured Box3 (FBX-converted GLBs carry wild
 *    node scales — never trust hardcoded sizes).
 */

import { Canvas, useFrame } from '@react-three/fiber/native';
import { useAnimations, useGLTF } from '@react-three/drei/native';
import * as Device from 'expo-device';
import { Suspense, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Box3, Color, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { AnimationClip, Group, Object3D } from 'three';

import { Text } from '@/components/text';
import { haptics, spacing } from '@/theme';
import { useBulldogStore } from '../store';

const CLIP = {
  idle: 'Idle',
  sleepyIdle: 'Idle_2_HeadLow', // doubles as the pout slump
  jump: 'Gallop_Jump', // happy AND party (the shiba's best move)
  love: 'Idle_HitReact_Right',
  proud: 'Idle_HitReact_Left',
} as const;

/** Latte tints for the coat (eye materials left untouched). */
const COAT = new Color('#D9B48A');
const COAT_LIGHT = new Color('#F0DFC0');

function PupModel() {
  const reduceMotion = useReducedMotion();
  const group = useRef<Group>(null);
  // Metro bundles .glb via metro.config.js assetExts. Single model in → single GLTF out.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gltf = useGLTF(require('../../../../assets/models/shiba.glb')) as unknown as {
    scene: Group;
    animations: AnimationClip[];
  };
  const { actions, mixer } = useAnimations(gltf.animations, group);
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  // Latte the coat (matched by material NAME; eyes/black stay factory).
  useEffect(() => {
    gltf.scene.traverse((obj: Object3D) => {
      if ((obj as Mesh).isMesh) {
        const m = obj as Mesh;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!mat) continue;
          if (mat.name === 'Main') (mat as MeshStandardMaterial).color?.copy(COAT);
          if (mat.name === 'Main_Light') (mat as MeshStandardMaterial).color?.copy(COAT_LIGHT);
        }
      }
    });
  }, [gltf.scene]);

  // AUTO-FRAME: measure the real bounding box, normalize size, feet on floor, centered.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim <= 0) return;
    const s = 2.0 / maxDim; // fill the stage, with headroom for the big hop
    g.scale.setScalar(s);
    g.position.set(-center.x * s, -box.min.y * s - 1.05, -center.z * s);
    // Angle him slightly toward the camera for depth.
    g.rotation.y = -0.35;
  }, [gltf.scene]);

  // Base loop follows mood (sleepy AND pout get the head-low idle).
  const baseClip = mood === 'sleepy' || mood === 'pout' ? CLIP.sleepyIdle : CLIP.idle;
  useEffect(() => {
    const base = actions[baseClip];
    if (!base) return;
    base.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.25).play();
    mixer.timeScale = reduceMotion ? 0 : 1;
    return () => {
      base.fadeOut(0.2);
    };
  }, [actions, mixer, baseClip, reduceMotion]);

  // Transient clips on mood triggers: jump on happy/party, head-tilts on love/proud.
  useEffect(() => {
    if (reduceMotion) return;
    if (mood !== 'happy' && mood !== 'party' && mood !== 'love' && mood !== 'proud') return;
    const base = actions[baseClip];
    const move =
      mood === 'happy' || mood === 'party'
        ? actions[CLIP.jump]
        : mood === 'proud'
          ? (actions[CLIP.proud] ?? actions[CLIP.love]) // fall back if the GLB lacks Left
          : actions[CLIP.love];
    if (!base || !move) return;

    move.reset().setLoop(LoopOnce, 1);
    move.clampWhenFinished = true;
    base.crossFadeTo(move.play(), 0.15, false);

    // Deterministic return-to-idle: mixer 'finished' events proved unreliable here
    // (and firing state updates from inside the render loop trips React warnings).
    // A timer keyed to the clip's real duration is simple, and re-taps interrupt
    // cleanly because this effect re-runs on nonce (clearing the pending timer).
    const clipMs = Math.max(300, move.getClip().duration * 1000 - 120);
    const timer = setTimeout(() => {
      base.reset().setLoop(LoopRepeat, Infinity);
      move.crossFadeTo(base.play(), 0.2, false);
      // Reset the shared mood so the NEXT tap/check-in retriggers (the SVG
      // BulldogView isn't mounted to do this while 3D is showing).
      setIdle();
    }, clipMs);
    return () => clearTimeout(timer);
  }, [mood, nonce, actions, mixer, baseClip, reduceMotion, setIdle]);

  return (
    <group ref={group}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={gltf.scene} />
    </group>
  );
}

/**
 * Visible Suspense fallback: a slowly tumbling latte cube. If this never becomes
 * the pup, the GLB failed to load (a loading problem, not a framing problem).
 */
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

export default function Pup3DStage({ height = 240 }: { height?: number }) {
  const trigger = useBulldogStore((s) => s.trigger);

  // The iOS SIMULATOR's GL initializes but never presents a frame (verified
  // 2026-07-12: even a bare colored canvas stays invisible). Real iPhones and
  // Android are fine — say so instead of showing a silent void.
  if (Platform.OS === 'ios' && !Device.isDevice) {
    return (
      <View style={[styles.wrap, styles.simNote, { height }]}>
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
    <View style={[styles.wrap, { height }]}>
      <Canvas
        style={styles.flex}
        camera={{ position: [0, 1.0, 3.8], fov: 42 }}
        gl={{ antialias: true }}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <ambientLight intensity={1.15} />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <directionalLight position={[2.5, 4, 3]} intensity={1.7} />
        <Suspense fallback={<LoadingCube />}>
          <PupModel />
        </Suspense>
      </Canvas>
      {/* Transparent tap layer ABOVE the canvas — the GL view eats touches otherwise. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Make the 3D pup jump"
        style={StyleSheet.absoluteFill}
        onPress={() => {
          haptics.tick();
          trigger('happy');
        }}
      />
      <Text variant="caption" color="textSecondary" style={styles.hint}>
        3D pup (beta) — tap him to jump 🐾
      </Text>
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
