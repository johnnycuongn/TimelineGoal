/**
 * Pug3DStage — EXPERIMENTAL true-3D pup (prototype behind a Den toggle).
 *
 * three.js + @react-three/fiber(native) + expo-gl: the one 3D combo that runs in
 * Expo Go on SDK 57. Loads the CC0 Quaternius pug (assets/models/pug.glb — see
 * PUG-LICENSE.md) with skeletal clips `Armature|Idle` and `Armature|Jump`, tinted
 * to Mochi's latte brown.
 *
 * Behavior: Idle loop; a check-in (mood happy/love) or a tap makes him JUMP
 * (crossfade to the Jump clip once, then back to Idle). Reduce Motion → frozen pose.
 *
 * Known limits (why this is a beta toggle, not the default):
 *  - iOS *simulator* GL is unreliable (can hard-crash) — test on Android emulator
 *    or a physical device.
 *  - Renders on the JS thread; we keep the scene tiny (one 644-tri mesh, 2 lights).
 *  - The SVG Mochi remains the product mascot unless this experiment wins.
 */

import { Canvas, useFrame } from '@react-three/fiber/native';
import { useAnimations, useGLTF } from '@react-three/drei/native';
import { Suspense, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Box3, Color, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { AnimationClip, Group, Object3D } from 'three';

import { Text } from '@/components/text';
import { haptics, spacing } from '@/theme';
import { useBulldogStore } from '../store';

const IDLE = 'Armature|Idle';
const JUMP = 'Armature|Jump';

/** Latte tint applied to the pug's beige coat (matches Mochi's new coat). */
const COAT_TINT = new Color('#D9B48A');

function PugModel() {
  const reduceMotion = useReducedMotion();
  const group = useRef<Group>(null);
  // Metro bundles .glb via metro.config.js assetExts. Single model in → single GLTF out.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gltf = useGLTF(require('../../../../assets/models/pug.glb')) as unknown as {
    scene: Group;
    animations: AnimationClip[];
  };
  const { actions, mixer } = useAnimations(gltf.animations, group);
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);

  // Tint the coat browner (matched by material NAME, not instanceof, so a duplicated
  // three copy can never break it).
  useEffect(() => {
    gltf.scene.traverse((obj: Object3D) => {
      if (obj instanceof Mesh || (obj as Mesh).isMesh) {
        const m = obj as Mesh;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (mat && mat.name === 'Beige') {
            (mat as MeshStandardMaterial).color?.copy(COAT_TINT);
          }
        }
      }
    });
  }, [gltf.scene]);

  // AUTO-FRAME: this FBX-converted model carries huge node scales (mesh ×100,
  // armature ×39.5), so never trust hardcoded sizes — measure the real bounding
  // box and normalize to a known stage size, feet on the floor, centered.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim <= 0) return;
    const s = 1.9 / maxDim; // normalize longest side to ~1.9 world units
    g.scale.setScalar(s);
    g.position.set(-center.x * s, -box.min.y * s - 0.95, -center.z * s);
  }, [gltf.scene]);

  // Idle loop (or frozen pose under Reduce Motion).
  useEffect(() => {
    const idle = actions[IDLE];
    if (!idle) return;
    idle.reset().setLoop(LoopRepeat, Infinity).play();
    if (reduceMotion) {
      mixer.timeScale = 0; // hold the first pose — still 3D, no motion
    } else {
      mixer.timeScale = 1;
    }
  }, [actions, mixer, reduceMotion]);

  // Jump on happy/love (check-ins, reactions) — crossfade out and back.
  useEffect(() => {
    if (reduceMotion) return;
    if (mood !== 'happy' && mood !== 'love') return;
    const idle = actions[IDLE];
    const jump = actions[JUMP];
    if (!idle || !jump) return;

    jump.reset().setLoop(LoopOnce, 1);
    jump.clampWhenFinished = true;
    idle.crossFadeTo(jump.play(), 0.15, false);

    const onFinished = () => {
      idle.reset().setLoop(LoopRepeat, Infinity);
      jump.crossFadeTo(idle.play(), 0.2, false);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mood, nonce, actions, mixer, reduceMotion]);

  return (
    <group ref={group}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={gltf.scene} />
    </group>
  );
}

/**
 * Visible Suspense fallback: a slowly tumbling latte cube. If you see this and it
 * never becomes the pug, the GLB failed to load (loading — not framing — problem).
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
      {/* eslint-disable-next-line react/no-unknown-property */}
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <meshStandardMaterial color="#D9B48A" />
    </mesh>
  );
}

export default function Pug3DStage({ height = 220 }: { height?: number }) {
  const trigger = useBulldogStore((s) => s.trigger);

  return (
    <View style={[styles.wrap, { height }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Make the 3D pup jump"
        style={styles.flex}
        onPress={() => {
          haptics.tick();
          trigger('happy');
        }}>
        <Canvas
          style={styles.flex}
          camera={{ position: [0, 0.6, 3.2], fov: 40 }}
          gl={{ antialias: true }}>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <ambientLight intensity={1.1} />
          {/* eslint-disable-next-line react/no-unknown-property */}
          <directionalLight position={[2, 4, 3]} intensity={1.6} />
          <Suspense fallback={<LoadingCube />}>
            <PugModel />
          </Suspense>
        </Canvas>
      </Pressable>
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
});
