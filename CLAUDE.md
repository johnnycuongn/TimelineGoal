# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Greenfield — no code scaffolded yet. The project is in the brainstorming/design phase. Design specs live in `docs/superpowers/specs/` once written; check there before implementing anything.

## What This Is

**TimelineGoal** — a mobile app for a couple (exactly two users) to track goals together:

- **Goal horizons**: weekly, quarterly, and yearly goals
- **Goal ownership**: shared couple goals + each partner's personal goals; both partners can always see each other's goals
- **Check-ins**: lightweight, enjoyable progress check-ins are a core interaction — defining goals and checking in must feel fun, not like a chore
- **Topic spaces** (working name — "gallery"/"dashboard"/"thread" undecided): multiple shared spaces, one per topic the couple is discussing/planning/deciding. Each space is customizable together, may include playful/game-like interactions, and has a chat to record decisions and discussion.

**Product values (non-negotiable)**: cuteness, fun, simplicity, interactivity. Every feature should be judged against "is this enjoyable for a couple to use together?"

## Tech Stack

- **React Native + Expo** (managed workflow) — mobile app
- **Firebase** — auth, Firestore database, storage, real-time sync between the two partners
- A **Motion/Gameplay UI spec** is planned for React Native interactions (animations, playful feedback) — treat motion as a first-class part of the product, not polish

## Project Skills (mandatory)

Three project skills in `.claude/skills/` encode the approved design — invoke the relevant one BEFORE the work, not after:

- **`motion-spec`** — before any screen/component/animation/gesture/haptic work (spring physics laws, bulldog state machine, gameplay mechanics)
- **`cuteness`** — before any visual/copy/icon/empty-state work (visual language, bulldog voice, copy rules)
- **`couple-growth`** — before any goals/check-ins/rewards/notifications/partner-interaction design (never-compare-partners principles, mechanic design tests)

The full approved design lives in `docs/superpowers/specs/2026-07-10-timelinegoal-design.md`; the original vision is preserved verbatim in `docs/prompt_v1.md`.

## Design System

Always use the `ui-ux-pro-max` skill for any UI/UX work (screens, components, colors, typography, motion, review). Generated baseline for this product:

- **Style**: Soft UI Evolution — soft depth, improved shadows, WCAG AA+ contrast, full light/dark support
- **Palette**: romance rose — primary `#BE185D`, secondary `#EC4899`, background `#FDF2F8`, foreground `#0F172A`, accent/destructive `#DC2626`
- **Typography**: Fredoka (headings) / Nunito (body) — playful, friendly, rounded
- **Rules**: no emoji as icons (use SVG icon sets, e.g. Lucide), 44pt+ touch targets, 150–300ms micro-interactions with spring easing, respect reduced-motion, semantic color tokens (no raw hex in components)

## Commands

No build/test tooling exists yet. Once Expo is scaffolded, this section should be updated with the actual commands (`npx expo start`, test runner, lint).
