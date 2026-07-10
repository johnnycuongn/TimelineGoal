/**
 * Motion tokens — the physics laws of the app (see .claude/skills/motion-spec).
 *
 * Law 1: everything springy, nothing linear. Use `spring.*` for spatial movement;
 *        reserve timing for opacity/fades only.
 * Law 4: cute timing — enter 250 / exit ~170 / stagger 40. Honor Reduce Motion.
 *
 * Reanimated 4 keeps withSpring/withTiming; these configs feed them directly.
 */

import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** Spring presets. `default` = the soft-rubber house feel (damping ~15, stiffness ~150). */
export const spring = {
  /** General spatial movement — cards, sheets, ladder nudges. */
  default: { damping: 15, stiffness: 150, mass: 1 } satisfies WithSpringConfig,
  /** Snappy press feedback (scale down/up on tap). */
  press: { damping: 18, stiffness: 320, mass: 0.7 } satisfies WithSpringConfig,
  /** Bouncy celebration (paw stamp, seal slam, confetti pop). */
  bouncy: { damping: 9, stiffness: 180, mass: 0.9 } satisfies WithSpringConfig,
} as const;

/** Timing tokens — FADES ONLY (opacity). Never for position/scale of interactive elements. */
export const timing = {
  enter: { duration: 250 } satisfies WithTimingConfig,
  exit: { duration: 170 } satisfies WithTimingConfig,
} as const;

/** Stagger between list/grid items on entrance. */
export const staggerMs = 40;

/** Press feedback: scale target while pressed (Law 2). */
export const pressScale = 0.96;

/** Reduce-motion fallback duration for cross-fading what would otherwise spring. */
export const reducedMotionFadeMs = 120;
