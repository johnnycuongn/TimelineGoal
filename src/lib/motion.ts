// Motion tokens from the spec. Every spatial animation uses a spring; enter
// and exit use opacity-only timings.
export const springs = {
  default: { type: "spring", damping: 15, stiffness: 150, mass: 1 },
  press: { type: "spring", damping: 18, stiffness: 320, mass: 0.7 },
  bouncy: { type: "spring", damping: 9, stiffness: 180, mass: 0.9 },
} as const;

export const timings = {
  enterMs: 250,
  exitMs: 170,
  staggerMs: 40,
  reducedMotionFadeMs: 120,
} as const;

export const PRESS_SCALE = 0.96;
