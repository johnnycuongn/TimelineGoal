---
name: cuteness
description: Use when choosing colors, typography, icons, illustrations, copy/microcopy, empty states, or component styling in TimelineGoal — and when reviewing any UI for whether it feels cute, warm, and couple-y enough.
---

# TimelineGoal Cuteness Spec

Cuteness is a core product value, not a coat of paint. The test for every screen: *would a couple smile using this together?*
Pairs with the ui-ux-pro-max skill (always run it for UI work); this file is the TimelineGoal-specific layer.

## Visual Language

- **Style**: Soft UI Evolution — soft depth, gentle shadows, WCAG AA+ contrast, full light + dark
- **Shapes**: rounded everything (cards 20–24px radius, buttons pill-shaped); no sharp corners, no harsh dividers — separate with space and soft surfaces
- **Palette (semantic tokens only, never raw hex in components)**:
  - primary `#BE185D` · secondary `#EC4899` · accent/destructive `#DC2626`
  - background `#FDF2F8` · foreground `#0F172A` · muted `#FBF1F5` · border `#F7E3EB`
  - Partner A = rose, Partner B = their onboarding-chosen accent, shared = gradient of both
- **Type**: Fredoka (headings — chunky, friendly) / Nunito (body — soft, readable). Base 16px, line-height 1.5+
- **Icons**: Lucide SVG only. Emoji are allowed as user-chosen *charms* (goal/corner decorations) — never as structural UI icons
- **Illustration**: the bulldog is the only character. Doodle-style accents (hearts, bones, stars, paw prints) as the decorative motif

## The Bulldog's Personality (voice anchor)

Chunky, wrinkly, endlessly loyal, a little sleepy, always on your side. He notices, he never nags. All app copy sounds like it comes from his world.

## Copy Rules

- Warm, first-person-plural where possible: "our goals", "we did it"
- Celebrate loudly, nudge softly: ✅ "Mochi missed you two 🐾" · ❌ "You lost your streak!"
- **Never guilt, never shame, never compare partners.** No red warning tones for missed goals — missing a week is a quiet fact, not a failure state
- Empty states have character: bulldog holds a sign ("No goals yet — dream big?"), never a bare "No data"
- Short sentences. No corporate words (utilize, manage, configure) — say "set up", "pick", "change"
- In-world vocabulary: the **Den** (home), the **Timeline** (goals), **Corners** (topic spaces), **paw prints** (progress units), **charms** (emoji decorations), **seal** (shared-goal commitment)

## Cuteness Checklist (per screen)

- [ ] Something rounded, something soft-shadowed, nothing sharp
- [ ] At most one focal cute moment (don't compete with the bulldog)
- [ ] Copy passes the "would this make my partner smile?" read-aloud test
- [ ] Empty/error states have warmth and a next step
- [ ] Dark mode keeps the cozy feel (desaturated rose, not inverted)
- [ ] Contrast still ≥4.5:1 — cute never excuses illegible
