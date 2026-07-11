# Mochi the Marshmallow — Bulldog Character Design

**Date:** 2026-07-11 · **Status:** Approved by user
**Visual reference (source of truth for shapes/colors):** `docs/design/bulldog-concepts.html` → Concept A
**Parent spec:** `2026-07-10-timelinegoal-design.md` (bulldog state machine, motion laws)

## Decision

The bulldog is **code-drawn layered SVG** (react-native-svg + Reanimated springs), not Rive-first:
works in Expo Go today, theme/partner-color aware, no external editor. Rive stays a possible M5
swap behind the same `BulldogView` interface. Concept chosen: **A · Mochi the Marshmallow**
(over B "Sir Wrinkles" grumpy-cute and C "Bean" minimal kawaii).

## Character sheet

- **Chibi proportions**: head ≈ 70% of the figure; tiny blob body, stubby legs, curl-nub tail
- **Face**: huge glossy near-black eyes (`#2E2436`) set low/wide with double white highlights;
  lighter muzzle; two squishy jowls with 3 whisker dots each; rounded nose; w-mouth + tongue-peek;
  rose blush; two forehead wrinkle strokes; cocoa folded ears (`#B08776`) with pink inners
- **Palette** (character-owned constants, deliberate exception to the semantic-token rule —
  Mochi's cream `#FFF3E9` pops on both light and dark backgrounds, verified in the mockup):
  cream `#FFF3E9` · light `#FFFDFB` · jowl `#FBE9DC` · wrinkle `#E8CDB9` · ear `#B08776` ·
  ear-inner `#F4B8C9` · eye `#2E2436` · nose `#4A3B41` · blush `#F9C6D0` · tongue `#F2789F`
- **Bandana**: band + knotted triangle, filled with a **gradient of both partner colors**
  (from `couple.partnerColors`; falls back to rose/pink pre-pairing)

## Rig

Puppet of stacked full-viewBox SVG layers (absolute-positioned in a square container),
each wrapped in its own Animated.View so springs run on whole layers:

| Layer | Contents | Animations |
|---|---|---|
| back | ears + tail | lagged wiggle behind head moves |
| body | body, legs, chest | breathing scale loop |
| head group | head, wrinkles, muzzle, blush, nose + nested layers below | wiggle ±8°, hop, squish |
| jowls (nested) | two cheeks + whisker dots | jiggle one spring-beat behind head |
| eyes (nested) | pupils + highlights | blink (scaleY, randomized 3–6s), pupil drift, boop squeeze |
| lids / arcs (nested) | sleepy lids · happy ^^ arcs | crossfade overlays (timing = fades only) |
| mouth (nested) | w-mouth, tongue | open-mouth overlay on happy |
| bandana (nested) | partner-color scarf | moves with head |
| zzz | two “z” glyphs | drift + fade loop on sleepy |

**Mood choreography** (drives from the existing zustand store; no screen changes):
idle = breath + blink + ear flick + pupil drift · happy = wiggle+hop, jowl/ear lag, arcs ·
sleepy = lids + slow breath + zzz, boop = snort awake · love = lean + arcs + heart pop ·
boop = squish 0.88 + eye squeeze + tick haptic ·
M3 hooks: party (zoomies), proud (chest up + sparkle), pout (brows in, jowls sag, ears droop).

**Reduce Motion**: loops off, blink off; static pose per mood (lids for sleepy, arcs for happy).

## Placement

`src/features/bulldog/mochi/` — `parts.tsx` (pure SVG layers) + rig logic folded into
`BulldogView.tsx` (same export/props: `{ size }`). Den and future screens upgrade automatically.
