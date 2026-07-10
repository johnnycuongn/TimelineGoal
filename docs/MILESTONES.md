# TimelineGoal — Milestone Tracker

> **Purpose**: persistent progress state across sessions. Any session doing implementation work MUST read this first, work the next unchecked item, and check items off (with date) as they're completed and verified. Update the **Current Status** line whenever it changes.

**Current Status**: ✅ **M0 complete** (dev-local). App foundation + Firebase emulator dev environment built & verified. One interactive sub-task deferred to M1 start: enabling the **cloud** Auth/Firestore/Storage services in the Firebase console (all M0 dev runs on emulators, so not a blocker). Next up: **M1 — A couple exists**. Stack is **Expo SDK 57**.

**Environment gotchas for future sessions** (learned this session):
- Firebase emulators need **Java 21** for the newer `firebase` (nvm node22 → v15) but only Java ≤16 is installed. Use the **homebrew `firebase` 12.4.4** (default node/PATH) + `JAVA_HOME=.../jdk-16...` for emulator work — that combo is verified working. Installing JDK 21 would let the newer CLI run.
- Firebase cloud CLI ops (projects/apps) were run under **nvm node 22.12** (`export PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"`); the app itself builds on node 20.11.
- Node 20.11 is below SDK 57's preferred 20.19.4 (warnings only so far). Project is pinned to **24.15.0** via `.nvmrc` — run `nvm use` first.
- **Expo Go "UnexpectedServerData: No returned query result" (500 on manifest)** = a **stale Expo CLI login** (a `duccuong0810` session with an expired token) made the dev server's authenticated API calls fail. Fix: `npx expo logout` (local Expo Go dev needs no Expo login). Diagnose by `curl -H "Expo-Platform: ios" -H "Accept: multipart/mixed,application/expo+json,application/json" http://localhost:8081/` — 500 vs 200. Only log back in (fresh creds) when doing EAS builds/updates.

**Design spec**: `docs/superpowers/specs/2026-07-10-timelinegoal-design.md` · **Original vision**: `docs/prompt_v1.md`

---

## M0 — Foundations

- [x] Expo scaffold: SDK 57 (RN 0.86, React 19.2, TS 6), Expo Router, `src/app/` layout *(2026-07-10)*
- [x] Tab shell: Den / Timeline / Corners / Us, classic `Tabs` + Lucide icons, rose theme *(2026-07-10)*
- [x] Design tokens module: `src/theme/` — colors (light+dark), spacing/radius/elevation, typography, motion, haptics *(2026-07-10)*
- [x] Fonts: Fredoka + Nunito via `@expo-google-fonts`, loaded in root layout *(2026-07-10)*
- [x] Core deps installed: Reanimated 4 (+worklets), Gesture Handler, Rive RN, Expo Haptics, React Query, Zustand, Lucide, svg *(2026-07-10)*
- [x] Firebase project `timelinegoal` created (Spark) + web app registered + `.firebaserc` *(2026-07-10)*
- [ ] **Enable cloud Auth + Firestore + Storage in console** — interactive, deferred to M1 start (dev uses emulators). URLs: `console.firebase.google.com/project/timelinegoal/{authentication,firestore,storage}`
- [x] Firebase emulator suite configured (`firebase.json`); app connects in dev (`src/lib/firebase.ts`) *(2026-07-10)*
- [x] Security rules skeleton: membership-gated `couples/{coupleId}` (`firestore.rules` + `storage.rules`) + rules-test scaffold, 8 passing *(2026-07-10)*
- [x] `docs/motion-spec.md` standing doc (pointer to the enforced skill + code tokens) *(2026-07-10)*
- [x] Update CLAUDE.md Commands section with real commands (start, test, lint, typecheck, export) *(2026-07-10)*
- [x] Jest test runner (jest-expo) wired + first passing suite (`src/theme/colors.test.ts`) *(2026-07-10)*

**Verification done**: `npm run typecheck` ✓ · `npm test` ✓ (4/4) · `npm run test:rules` ✓ (8/8 vs emulator) · `npx expo export --platform ios` ✓ (bundles clean). Not yet run on a physical device/simulator.
**Exit test**: app boots on device with tab shell, tokens/fonts applied, emulator connection verified. *(bundle + emulator verified; live device boot pending — do at M1 start with `npm start`.)*

## M1 — A couple exists 💑

- [x] Auth: **email/password** (`src/features/auth`) — Apple/Google deferred to the native dev build (M2+); architected for it *(2026-07-10)*
- [x] `users/{uid}` profile creation on first sign-in (`ensureUserProfile`) *(2026-07-10)*
- [x] Create couple → mints 6-char invite code + `pendingInviteCode` on the couple *(2026-07-10)*
- [x] Join flow: enter code → transaction adds member two, consumes invite *(2026-07-10)*
- [x] Pairing celebration: partner-colored halves snap + bulldog "adopted" (reduced-motion aware, celebration haptic) *(2026-07-10)*
- [x] Name-the-bulldog screen (writes `bulldog.name`) *(2026-07-10)*
- [x] Partner color selection during onboarding (`ColorPicker`, curated accents) *(2026-07-10)*
- [x] Security rules hardened: join requires an outstanding invite; membership enforced; **13/13 emulator tests** *(2026-07-10)*

**Verification done**: `npm run typecheck` ✓ · `npm test` ✓ (9) · `npm run test:emulator` ✓ (13) · `npx expo export --platform ios` ✓ (3553 modules incl. Firebase). Full emulator suite (auth+firestore+storage) boots under firebase 12.4.4 + Java 16. **Not yet driven on a simulator/device** (auth UI flow needs manual run with emulators up).
**Exit test**: two phones, one couple, both see the same den + bulldog name in real time. *(pending live run)*

### ▶ How to test M1 live (do this next)
Two terminals from the project root:
1. **Emulators** (default shell / node 20.11 so PATH `firebase` = homebrew 12.4.4; Java 16 is default): `npm run emulators` — starts auth+firestore+storage (+ UI at :4000).
2. **App**: `nvm use` (→ 24.15) then `npm start`, press `i` (iOS Simulator — `localhost` reaches the emulators).
   - **Physical device**: set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=<your Mac LAN IP>` before `npm start` (device can't see `localhost`). Or, once cloud services are enabled, set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false` to hit real Firebase.
- Two-user test: sign up in the simulator (create world → note code), sign up a second account in Expo Go / a second sim, join with the code → both see the paired den. Emulator data resets on restart.
- **Still deferred from M0**: enabling cloud Auth/Firestore/Storage in the console — only needed to test off-emulator or ship.

## M2 — The daily ritual 🐾 (make-or-break)

- [x] Weekly goals CRUD (title, charm, owner, target units, ISO-week period + tested period math) *(2026-07-10)*
- [x] Goal cards: own/partner colors, shared = both-dot badge (true gradient when we add expo-linear-gradient); press feedback per motion-spec *(2026-07-10)*
- [x] Paw-print check-ins: append-only `checkins` events, ink-splat stamp synced to data + tick haptic, success haptic on completion *(2026-07-10)*
- [x] Bulldog `idle`/`happy`/`sleepy`/`love` + boop — **placeholder edition** (Reanimated glyph on the same mood store; Rive artboard swaps in at the dev build since Expo Go can't load it) *(2026-07-10)*
- [x] Home "Den": bulldog + Today strip (check in directly) + evening sleepy *(2026-07-10)*
- [x] Real-time partner ticker (`onSnapshot` on denormalized `activity` collection) *(2026-07-10)*
- [x] Reactions: tap-a-heart on ticker items → partner's bulldog `love` + haptic — *flick-physics arc deferred to M3 polish* *(2026-07-10)*
- [ ] Offline check-ins verified (airplane mode → sync on reconnect) — needs a live device run
- [ ] **Rive bulldog artboard** (real art) — needs dev build; deferred

**Verification done**: typecheck ✓ · unit 16/16 ✓ · emulator 16/16 ✓ (goals/check-ins/reactions/stranger-lockout) · iOS bundle ✓. **Not yet run live on simulator/device.**
**Exit test**: checking in feels so good you do it for fake goals. Both partners' check-ins appear live on the other phone. *(pending live run — same recipe as M1: `npm run emulators` + `npm start`)*

## M3 — The Timeline 📅

- [ ] Quarterly + yearly goals; `parentGoalId` ladder linking (offered at creation)
- [ ] Week / Quarter / Year segmented views
- [ ] Ladder rollup math (client-side) + unit tests for period/rollup logic
- [ ] Ladder nudge animation (paw floats up to parent bar)
- [ ] Seal-the-deal: 10s both-tap window, wax-stamp slam, unsealed fallback + "seal pending" nudge
- [ ] Weekly pulse ring around bulldog (both colors meeting in middle)
- [ ] Bulldog states: `party` (+confetti particles), `proud`, `pout`
- [ ] Streak doodles on den wall

**Exit test**: a weekly check-in visibly nudges quarter + year; seal moment lands with both phones.

## M4 — Corners 💬

- [ ] Corner grid: create, cover photo, emoji charms
- [ ] Chat per corner (real-time, reactions)
- [ ] Pins: photo / note / link, scrapbook positioning
- [ ] Polls + ⭐ decided stamps (polls and messages)
- [ ] "Make it a goal →" decision→Timeline pipeline
- [ ] Firebase Storage: uploads under `couples/{id}/`, client-side compression, rules

**Exit test**: discuss → poll → decide ⭐ → converted goal appears on the Timeline.

## M5 — Polish & ship ✨

- [ ] Push notifications (Expo Notifications): partner check-in, seal pending, gentle weekly nudge — warm tone, all optional
- [ ] Bulldog cosmetics: bandanas/den decorations unlocked at milestones, equip UI in Us tab
- [ ] Empty states with character (bulldog holding signs)
- [ ] Reduced-motion pass (springs→fades, confetti off)
- [ ] Dark mode pass (desaturated rose, contrast re-checked)
- [ ] Onboarding wizard polish + first-goal wizard
- [ ] Us tab: anniversary, days-together counter, pairing management
- [ ] EAS builds → TestFlight / Play internal track on both phones

**Exit test**: both partners live in the app for a full week without hitting a rough edge.

---

## Session log

| Date | Session did | State left at |
|---|---|---|
| 2026-07-10 | Brainstorm → approved design spec, project skills (motion-spec, cuteness, couple-growth), this tracker | Design complete; M0 not started |
| 2026-07-10 | M0 build: SDK 57 scaffold, 4-tab shell, `src/theme/` design system, fonts, core deps, Jest + first test, motion-spec doc. Verified via typecheck/bundle/tests. | M0 ~70%; next = Firebase project + emulators + rules (interactive `firebase login`) |
| 2026-07-10 | M0 Firebase: project `timelinegoal` + web app, SDK client w/ emulator wiring, security rules skeleton + 8 passing rules tests. All gates green. | **M0 complete (dev-local)**; next = M1 (auth + pairing). Deferred: enable cloud services in console; boot on real device |
| 2026-07-10 | Fixed Expo Go manifest 500 (stale `expo logout`). Pinned Node 24.15 (`.nvmrc`). | Dev server healthy |
| 2026-07-10 | **M1 complete**: email/password auth, providers + routing guards, create/join pairing (transactions), celebration + name-bulldog, hardened rules. CSPRNG invite codes (security-review fix). typecheck+unit(10)+emulator(13)+bundle green. | **M1 done (not yet run live)**; next = boot on simulator w/ emulators, then M2 (daily ritual). Google/Apple + cloud-services enablement pending a dev build |
| 2026-07-10 | Fixed web crash (feature-detect RN auth persistence). **M2 complete**: period math, goals+check-ins data layer, GoalCard w/ paw stamps, new-goal modal, Timeline week view, Den (bulldog placeholder + Today strip + sleepy), ticker + heart reactions. typecheck+unit(16)+emulator(16)+bundle green. | **M2 done (code)**; pending live run + offline check. Next = live two-user test, then M3 (Timeline ladder + seal + pulse ring) or dev build for Rive |
