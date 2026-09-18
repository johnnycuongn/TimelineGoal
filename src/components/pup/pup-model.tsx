// Loads the GLB, frames it, drives the animation mixer from the mood context,
// and handles boop (tap) and turntable (drag). Only pup-stage imports this.
import { useAnimations, useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type AnimationAction,
  Box3,
  type Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Mesh,
  Vector3,
} from "three";
import { FIRST_HOLD_MS, pickIdle } from "./idle-scheduler";
import { usePupMood } from "./pup-mood-context";
import { PUP_URL } from "./pup-url";

const FADE = 0.35;
const FLOOR_Y = -1.0;
const TARGET_HEIGHT = 2.0;
const TURN_SPEED = 0.012;
const DRAG_THRESHOLD_PX = 2;
const DAMP = 6;
const MAX_DT = 0.05;
const SQUISH = 0.12;
const MIN_ONCE_MS = 400;
const SETTLE_EARLY_MS = 100;
const MS = 1000;

const CLIP_FOR_MOOD = {
  happy: "Gallop_Jump",
  party: "Gallop_Jump",
  proud: "Idle_HitReact_Left",
  love: "Idle_HitReact_Right",
  sleepy: "Idle_2_HeadLow",
  pout: "Idle_2_HeadLow",
} as const;

type Actions = Record<string, AnimationAction | null>;

/** Finds an action by clip name, tolerating an armature prefix like "Armature|Idle". */
function findAction(actions: Actions, name: string): AnimationAction | null {
  const exact = actions[name];
  if (exact) {
    return exact;
  }
  const key = Object.keys(actions).find((k) => k.endsWith(`|${name}`));
  return key ? (actions[key] ?? null) : null;
}

export default function PupModel({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(PUP_URL, false, true);
  const { actions, mixer } = useAnimations(animations, group);
  const invalidate = useThree((state) => state.invalidate);
  const { mood, nonce, settle, trigger } = usePupMood();
  const current = useRef<AnimationAction | null>(null);
  const yaw = useRef({ target: 0, value: 0 });
  const squish = useRef(0);
  const baseScale = useRef(1);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const idleTimer = useRef<number | null>(null);

  const meshes = useMemo(() => {
    const list: Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        // The culling sphere is computed once at bind pose; a jumping pup would vanish.
        o.frustumCulled = false;
        list.push(o);
      }
    });
    return list;
  }, [scene]);

  // Frame once at identity so a recycled group never compounds a previous scale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `meshes` keeps the traverse ahead of the framing
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) {
      return;
    }
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const s = TARGET_HEIGHT / Math.max(size.x, size.y, size.z, 1e-6);
    baseScale.current = s;
    g.scale.setScalar(s);
    g.updateMatrixWorld(true);
    const framed = new Box3().setFromObject(scene);
    const center = framed.getCenter(new Vector3());
    g.position.set(-center.x, FLOOR_Y - framed.min.y, -center.z);
    invalidate();
  }, [scene, meshes, invalidate]);

  const play = useCallback(
    (name: string, once: boolean): AnimationAction | null => {
      const next = findAction(actions, name);
      if (!next) {
        return null;
      }
      const prev = current.current;
      if (prev === next) {
        // Same clip again: restart a one-shot, leave a loop alone. Never re-fade
        // (reset() + fadeIn() on the only weighted action pops to the bind pose).
        if (once) {
          next.reset().play();
        }
        return next;
      }
      if (prev) {
        prev.fadeOut(FADE);
      }
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Number.POSITIVE_INFINITY);
      next.clampWhenFinished = once;
      next.fadeIn(FADE).play();
      current.current = next;
      return next;
    },
    [actions],
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(
    (first: boolean) => {
      clearIdleTimer();
      const { clip, holdMs } = first ? { clip: "Idle", holdMs: FIRST_HOLD_MS } : pickIdle();
      play(clip, false);
      idleTimer.current = window.setTimeout(() => scheduleIdle(false), holdMs);
    },
    [clearIdleTimer, play],
  );

  // Mood -> clip. Transient moods play once and settle back to the persistent mood.
  // `nonce` is in the deps on purpose: the same mood re-triggers.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` re-runs the effect for a repeat of the same mood
  useEffect(() => {
    if (reducedMotion) {
      // Bake Idle's first frame into the bones, then freeze.
      clearIdleTimer();
      mixer.stopAllAction();
      const idle = findAction(actions, "Idle");
      if (idle) {
        idle.reset().setEffectiveWeight(1).play();
        mixer.update(0);
        current.current = idle;
      }
      mixer.timeScale = 0;
      invalidate();
      return;
    }
    mixer.timeScale = 1;
    if (mood === "idle") {
      scheduleIdle(true);
      return clearIdleTimer;
    }
    if (mood === "sleepy" || mood === "pout") {
      clearIdleTimer();
      play(CLIP_FOR_MOOD[mood], false);
      return;
    }
    clearIdleTimer();
    const action = play(CLIP_FOR_MOOD[mood], true);
    const clipMs = action ? action.getClip().duration * MS : MIN_ONCE_MS;
    const id = window.setTimeout(settle, Math.max(clipMs - SETTLE_EARLY_MS, MIN_ONCE_MS));
    return () => window.clearTimeout(id);
  }, [
    mood,
    nonce,
    reducedMotion,
    mixer,
    actions,
    play,
    scheduleIdle,
    clearIdleTimer,
    settle,
    invalidate,
  ]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) {
      return;
    }
    const dt = Math.min(delta, MAX_DT);
    yaw.current.value = MathUtils.damp(yaw.current.value, yaw.current.target, DAMP, dt);
    g.rotation.y = yaw.current.value;
    squish.current = MathUtils.damp(squish.current, 0, DAMP, dt);
    const s = baseScale.current;
    const wide = s * (1 + SQUISH * 0.5 * squish.current);
    g.scale.set(wide, s * (1 - SQUISH * squish.current), wide);
  });

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    drag.current = { x: e.clientX, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) {
        return;
      }
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        drag.current.moved = true;
        yaw.current.target += dx * TURN_SPEED;
        drag.current.x = e.clientX;
        if (reducedMotion) {
          // Demand frameloop: no damping frames will follow, so snap.
          yaw.current.value = yaw.current.target;
        }
        invalidate();
      }
    },
    [reducedMotion, invalidate],
  );
  const onPointerUp = useCallback(() => {
    if (drag.current && !drag.current.moved && !reducedMotion) {
      squish.current = 1;
      trigger("happy");
    }
    drag.current = null;
  }, [reducedMotion, trigger]);

  return (
    <group
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={group}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(PUP_URL, false, true);
