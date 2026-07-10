# Motion & Gameplay — standing reference

The **authoritative, enforced** motion spec is the project skill: [`.claude/skills/motion-spec/SKILL.md`](../.claude/skills/motion-spec/SKILL.md). Every session doing UI work must invoke it. This doc is a stable pointer + a map to where the spec lives in code, so the rules aren't just prose — they're tokens.

## Where the spec lives in code

| Concept | Source of truth |
|---|---|
| Spring presets (`default` 15/150, `press`, `bouncy`) | `src/theme/motion.ts` → `spring` |
| Timing tokens (enter 250 / exit 170, fades only) | `src/theme/motion.ts` → `timing`, `staggerMs` |
| Press feedback (`pressScale` 0.96) | `src/theme/motion.ts` → `pressScale` |
| Haptic tiers (tick / success / celebration) | `src/theme/haptics.ts` → `haptics` |
| Reduced-motion fallback | `src/theme/motion.ts` → `reducedMotionFadeMs` |

## The five laws (summary — full text in the skill)

1. Everything springy, nothing linear (`withSpring`; timing = fades only)
2. Touch answers within 100ms (press → scale 0.96 + tick haptic)
3. Motion carries meaning (≤2 animated focal points/screen; bulldog counts as one)
4. Cute timing tokens; honor Reduce Motion
5. Partner presence is ambient (Firestore `onSnapshot`-driven micro-moments)

## Bulldog states (Rive)

`idle · happy · party · proud · sleepy · pout · love` — see the skill for triggers. Wiring lands in M2 (`idle/happy/sleepy/boop`), completed in M3.

> When code and this doc disagree, the skill + `src/theme/motion.ts` win. Update both together.
