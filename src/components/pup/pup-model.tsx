// Loads the GLB, frames it, drives the animation mixer from the mood context,
// and handles boop (tap) and turntable (drag). Only pup-stage imports this.
import { useAnimations, useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type AnimationAction,
  type Bone,
  Box3,
  type Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from "three";
import { FIRST_HOLD_MS, pickIdle } from "./idle-scheduler";
import { usePupMood } from "./pup-mood-context";
import { PUP_URL } from "./pup-url";
import {
  breathingDepth,
  LEVEL_BONES,
  nextStir,
  REST_DAMP,
  REST_DEPTH,
  restShift,
  STIR_DEPTH,
} from "./rest-pose";

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

// The GLB has no lie-down clip, so bedtime borrows the last frame of this one and never
// plays a second of it. See rest-pose.ts for what that frame needs corrected.
const LIE_DOWN_CLIP = "Death";
const REST_SETTLED = 0.01;

const CLIP_FOR_MOOD = {
  happy: "Gallop_Jump",
  party: "Gallop_Jump",
  proud: "Idle_HitReact_Left",
  love: "Idle_HitReact_Right",
  sleepy: "Idle_2_HeadLow",
  pout: "Idle_2_HeadLow",
} as const;

type Actions = Record<string, AnimationAction | null>;

interface RestLayer {
  base: AnimationAction | null;
  down: AnimationAction | null;
  depth: number;
  target: number;
  elapsed: number;
  stirAt: number;
  stirUntil: number;
}

const worldQ = new Quaternion();
const parentQ = new Quaternion();
const scratch = new Vector3();

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
  const basePos = useRef(new Vector3());
  const rest = useRef<RestLayer>({
    base: null,
    down: null,
    depth: 0,
    target: 0,
    elapsed: 0,
    stirAt: 0,
    stirUntil: 0,
  });

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

  // The bones bedtime levels, each with the orientation it holds in the bind pose. Read
  // off the skeleton rather than the live scene: useGLTF hands out a cached scene, so at
  // mount the bones may still be standing in whatever pose the last stage left them in.
  const levelled = useMemo(() => {
    let skinned: SkinnedMesh | null = null;
    scene.traverse((o) => {
      if (!skinned && o instanceof SkinnedMesh) {
        skinned = o;
      }
    });
    const mesh = skinned as SkinnedMesh | null;
    if (!mesh) {
      return [] as { bone: Bone; bind: Quaternion }[];
    }
    const out: { bone: Bone; bind: Quaternion }[] = [];
    for (const name of LEVEL_BONES) {
      const index = mesh.skeleton.bones.findIndex((b) => b.name === name);
      const bone = mesh.skeleton.bones[index];
      const inverse = mesh.skeleton.boneInverses[index];
      if (!bone || !inverse) {
        continue;
      }
      const bind = new Quaternion();
      inverse.clone().invert().premultiply(mesh.bindMatrix).decompose(scratch, bind, new Vector3());
      out.push({ bone, bind });
    }
    return out;
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
    basePos.current.copy(g.position);
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

  /**
   * Writes the bedtime pose for a given depth: shifts the pup back into frame and
   * levels the neck and head. Runs after the mixer has written the bones, so it has the
   * last word; the mixer overwrites it again on the next frame, which is what keeps this
   * honest rather than cumulative.
   */
  const applyRestPose = useCallback(
    (depth: number) => {
      const g = group.current;
      if (!g) {
        return;
      }
      // The pose carries the pup sideways along his own axis, so the correction has to
      // turn with him — the turntable can leave him facing anywhere.
      const shift = restShift(depth, g.rotation.y);
      g.position.set(basePos.current.x + shift.x, basePos.current.y, basePos.current.z + shift.z);
      if (levelled.length === 0) {
        return;
      }
      // Bring the group's own transform up to date first: the levelling below compares
      // world orientations, and a stale group matrix would fold the turntable's yaw into
      // the correction.
      g.updateMatrixWorld(true);
      scene.getWorldQuaternion(parentQ);
      const root = parentQ.clone();
      for (const { bone, bind } of levelled) {
        bone.getWorldQuaternion(worldQ);
        worldQ.slerp(root.clone().multiply(bind), depth);
        bone.parent?.getWorldQuaternion(parentQ);
        bone.quaternion.copy(parentQ.invert().multiply(worldQ));
        // Each bone is the next one's parent, so its matrix has to land before we read it.
        bone.updateMatrixWorld(true);
      }
    },
    [levelled, scene],
  );

  /** Standing Idle underneath, the borrowed lie-down frame on top, no fades between. */
  const enterRest = useCallback(
    (depth: number, restart = false) => {
      const base = findAction(actions, "Idle");
      const down = findAction(actions, LIE_DOWN_CLIP);
      if (!base || !down) {
        return false;
      }
      const layer = rest.current;
      // Whatever was playing has to go, or it keeps its weight and drags the pup back
      // upright: coming to bed from a boop means Gallop_Jump is still on full.
      const prev = current.current;
      if (prev && prev !== base && prev !== down) {
        prev.fadeOut(FADE);
      }
      if (restart || layer.down !== down) {
        // Fading here would fight the depth easing, which IS the lie-down movement.
        base.reset().setLoop(LoopRepeat, Number.POSITIVE_INFINITY).setEffectiveWeight(1).play();
        down.reset().setLoop(LoopOnce, 1).play();
        down.clampWhenFinished = true;
        down.paused = true;
        down.time = down.getClip().duration;
        layer.base = base;
        layer.down = down;
        layer.elapsed = 0;
        const { afterMs } = nextStir();
        layer.stirAt = afterMs;
        layer.stirUntil = 0;
      }
      layer.target = depth;
      current.current = base;
      return true;
    },
    [actions],
  );

  const leaveRest = useCallback(() => {
    const layer = rest.current;
    if (!layer.down) {
      return;
    }
    // Getting up is the one transition a fade suits: the waking clip fades in over it.
    layer.down.fadeOut(FADE);
    layer.base = null;
    layer.down = null;
    layer.depth = 0;
    layer.target = 0;
    const g = group.current;
    if (g) {
      g.position.copy(basePos.current);
    }
  }, []);

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
      // Nothing will play, so close any transient mood now rather than leaving
      // it to a clip that never runs (the provider's bound is the backstop).
      settle();
      // Bake a first frame into the bones, then freeze. At bedtime that frame is the
      // lie-down: a reduced-motion pup at midnight should still be lying down.
      clearIdleTimer();
      mixer.stopAllAction();
      const bedtime = mood === "drowsy" || mood === "resting";
      if (bedtime && enterRest(REST_DEPTH[mood], true)) {
        const depth = rest.current.target;
        rest.current.depth = depth;
        rest.current.base?.setEffectiveWeight(1 - depth);
        rest.current.down?.setEffectiveWeight(depth);
        mixer.update(0);
        applyRestPose(depth);
      } else {
        const idle = findAction(actions, "Idle");
        if (idle) {
          idle.reset().setEffectiveWeight(1).play();
          mixer.update(0);
          current.current = idle;
        }
      }
      mixer.timeScale = 0;
      invalidate();
      return;
    }
    mixer.timeScale = 1;
    if (mood === "drowsy" || mood === "resting") {
      clearIdleTimer();
      enterRest(REST_DEPTH[mood]);
      return;
    }
    leaveRest();
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
    enterRest,
    leaveRest,
    applyRestPose,
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

    const layer = rest.current;
    if (!layer.down || !layer.base) {
      return;
    }
    layer.elapsed += dt;
    if (layer.target >= REST_DEPTH.resting) {
      // Flat out, the pup stirs now and then: head and chest up for a few seconds, then
      // back down. The third pose, and the only thing that happens all night.
      const nowMs = layer.elapsed * MS;
      if (layer.stirUntil > 0 && nowMs >= layer.stirUntil) {
        layer.stirUntil = 0;
        layer.stirAt = nowMs + nextStir().afterMs;
      } else if (layer.stirUntil === 0 && nowMs >= layer.stirAt) {
        layer.stirUntil = nowMs + nextStir().holdMs;
      }
    }
    const wanted = layer.stirUntil > 0 ? STIR_DEPTH : layer.target;
    layer.depth = MathUtils.damp(layer.depth, wanted, REST_DAMP, dt);
    if (layer.depth < REST_SETTLED && wanted < REST_SETTLED) {
      return;
    }
    const depth = breathingDepth(layer.depth, layer.elapsed);
    layer.base.setEffectiveWeight(1 - depth);
    layer.down.setEffectiveWeight(depth);
    applyRestPose(depth);
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
