---
name: motion-spec
description: Use when building or reviewing ANY screen, component, animation, gesture, transition, or haptic in TimelineGoal — before writing UI code. Also use when adding bulldog states, springs, confetti, or check-in feedback.
---

# TimelineGoal Motion & Gameplay Spec

The physics laws of the app. Every screen obeys these — motion is product, not polish.
Source of truth approved in `docs/superpowers/specs/2026-07-10-timelinegoal-design.md`.

## The Five Laws

1. **Everything is springy, nothing linear.** All movement = Reanimated `withSpring` (damping ~15, stiffness ~150). Soft rubber, never sliding glass. No `withTiming` for spatial movement (fades only).
2. **Touch answers within 100ms.** Press → scale 0.96 + `Haptics.selectionAsync()`. Release → spring back. A dead tap is a bug.
3. **Motion carries meaning.** No decoration-only animation. Max 1–2 animated focal points per screen; the bulldog counts as one.
4. **Cute timing tokens:** enter 250ms ease-out · exit ~170ms ease-in · list stagger 40ms/item. `Reduce Motion` on → springs become fades, confetti off, bulldog stays in `idle`.
5. **Partner presence is ambient.** Firestore `onSnapshot` drives live moments: partner avatar pulses when in-app; their check-ins toast in their color.

## Haptic Tiers

| Tier | API | When |
|---|---|---|
| tick | `selectionAsync` | press, paw stamp |
| success | `notificationAsync(Success)` | goal unit done, seal armed |
| celebration | `impactAsync(Heavy)` ×2 | goal complete, seal slam, milestone |

## Bulldog State Machine (Rive inputs)

| State | Trigger |
|---|---|
| `idle` | default — breathing, blinks, eyes follow finger |
| `happy` | any check-in |
| `party` | goal completed / seal moment (+app-layer confetti) |
| `proud` | quarterly/yearly milestone |
| `sleepy` | no check-ins today, evening — boop to wake |
| `pout` | 3+ quiet days (both partners) — never text-guilt |
| `love` | partner sends a reaction |

Boops (poke = squish, drag = lean in) attach to NO mechanics. Pure joy.

## Gameplay Mechanics

- **Paw-print progress**: N units = N paw slots; check-in stamps one (ink-splat spring + tick haptic)
- **Seal-the-deal**: shared goal arms a 10s window; both tap → wax-stamp slam + both-color edge glow + `party`
- **Weekly pulse ring**: both partners fill the arc from opposite ends, meeting in the middle
- **Ladder nudge**: weekly check-in floats a paw up to bump the quarterly bar
- **Streak doodles**: completed weeks draw doodles on the den wall — history becomes decor
- **Flick reactions**: heart arcs with physics; bulldog tries to catch it

## Tech Mapping

Reanimated 4 (+ react-native-worklets) + Gesture Handler (springs/gestures) · Rive RN runtime (bulldog) · Expo Haptics · confetti = lightweight Reanimated particles (no heavy lib). Build = Expo SDK 57. `withSpring`/`useSharedValue`/`useAnimatedStyle` API unchanged from v3.

## Red Flags

- `withTiming` on position/scale for interaction feedback
- Animation >400ms, or blocking input while animating
- Adding a third animated focal point to a screen
- New celebratory moment with no haptic
- Any motion that shames or pressures (guilt is a design bug)
