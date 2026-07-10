# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Progress Tracking

Greenfield — design phase complete, implementation not started. **Before any implementation work, read `docs/MILESTONES.md`** — it is the persistent progress tracker across sessions: work the next unchecked item, check off completed+verified items with the date, update the Current Status line, and append to its session log before finishing. The approved design lives in `docs/superpowers/specs/2026-07-10-timelinegoal-design.md`.

## What This Is

**TimelineGoal** — a mobile app for a couple (exactly two users) to track goals together:

- **Goal horizons**: weekly, quarterly, and yearly goals
- **Goal ownership**: shared couple goals + each partner's personal goals; both partners can always see each other's goals
- **Check-ins**: lightweight, enjoyable progress check-ins are a core interaction — defining goals and checking in must feel fun, not like a chore
- **Topic spaces** (working name — "gallery"/"dashboard"/"thread" undecided): multiple shared spaces, one per topic the couple is discussing/planning/deciding. Each space is customizable together, may include playful/game-like interactions, and has a chat to record decisions and discussion.

**Product values (non-negotiable)**: cuteness, fun, simplicity, interactivity. Every feature should be judged against "is this enjoyable for a couple to use together?"

## ⚠️ Expo SDK 57 — read versioned docs first

This project runs **Expo SDK 57** (React Native 0.86, React 19.2, Reanimated **4.5** + react-native-worklets, TypeScript 6, New Architecture). SDK 57 post-dates most training data — **before writing Expo/Reanimated/Router code, read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/** (this is also the standing order in `AGENTS.md`). Notably: Reanimated is **v4** (worklets live in `react-native-worklets`, not the reanimated package; requires New Arch), and app code lives under **`src/app/`** (Expo Router, typed routes + React Compiler enabled in `app.json`).

## Tech Stack

- **Expo SDK 57 (managed) + React Native 0.86 + TypeScript 6** — app code under `src/app/` (Expo Router, file-based, typed routes on)
- **Firebase** — auth, Firestore database, storage, real-time sync between the two partners
- **Motion**: Reanimated 4.5 + react-native-worklets + react-native-gesture-handler; Rive RN runtime for the bulldog; Expo Haptics. Treat motion as first-class product, not polish.

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

- `npm start` — Expo dev server (`expo start`); `npm run ios` / `npm run android` / `npm run web` to target a platform
- `npm run lint` — `expo lint`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Jest (jest-expo preset); `npm run test:watch` for watch mode
- Run a single test: `npx jest path/to/file.test.ts` or `npx jest -t "test name substring"`
- Smoke-test the bundle without a simulator: `npx expo export --platform ios --output-dir /tmp/tg-export`

**Node**: project is pinned to **24.15.0** via `.nvmrc` (LTS, latest, verified to bundle clean with SDK 57). Run `nvm use` in the project dir before Expo commands. SDK 57 requires `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0` — the machine's default 20.11.0 is *below* range and triggers EBADENGINE warnings, so always `nvm use` first. (Firebase emulator work is separate — see the MILESTONES env-gotchas note.)
