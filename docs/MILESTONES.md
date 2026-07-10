# TimelineGoal — Milestone Tracker

> **Purpose**: persistent progress state across sessions. Any session doing implementation work MUST read this first, work the next unchecked item, and check items off (with date) as they're completed and verified. Update the **Current Status** line whenever it changes.

**Current Status**: 🚧 M0 in progress — app foundation built & verified (typecheck + iOS bundle + tests green). Remaining: Firebase project/emulators/rules (needs interactive `firebase login`). Stack is **Expo SDK 57** (not the SDK assumed in the design spec — see spec addendum).

**Design spec**: `docs/superpowers/specs/2026-07-10-timelinegoal-design.md` · **Original vision**: `docs/prompt_v1.md`

---

## M0 — Foundations

- [x] Expo scaffold: SDK 57 (RN 0.86, React 19.2, TS 6), Expo Router, `src/app/` layout *(2026-07-10)*
- [x] Tab shell: Den / Timeline / Corners / Us, classic `Tabs` + Lucide icons, rose theme *(2026-07-10)*
- [x] Design tokens module: `src/theme/` — colors (light+dark), spacing/radius/elevation, typography, motion, haptics *(2026-07-10)*
- [x] Fonts: Fredoka + Nunito via `@expo-google-fonts`, loaded in root layout *(2026-07-10)*
- [x] Core deps installed: Reanimated 4 (+worklets), Gesture Handler, Rive RN, Expo Haptics, React Query, Zustand, Lucide, svg *(2026-07-10)*
- [ ] Firebase project created (Spark tier); Auth + Firestore + Storage enabled — **needs `firebase login` (interactive)**
- [ ] Firebase emulator suite running locally; app connects to emulators in dev
- [ ] Security rules skeleton: membership-based access under `couples/{coupleId}` + rules tests scaffold
- [x] `docs/motion-spec.md` standing doc (pointer to the enforced skill + code tokens) *(2026-07-10)*
- [x] Update CLAUDE.md Commands section with real commands (start, test, lint, typecheck, export) *(2026-07-10)*
- [x] Jest test runner (jest-expo) wired + first passing suite (`src/theme/colors.test.ts`) *(2026-07-10)*

**Verification done**: `npm run typecheck` ✓ · `npm test` ✓ (4/4) · `npx expo export --platform ios` ✓ (bundles clean). Not yet run on a physical device/simulator.
**Exit test**: app boots on device with tab shell, tokens/fonts applied, emulator connection verified.

## M1 — A couple exists 💑

- [ ] Auth: Apple / Google / email sign-in
- [ ] `users/{uid}` profile creation on first sign-in
- [ ] Create couple flow → mints 6-char invite code (`invites/{code}`, short TTL)
- [ ] Join flow: enter code → transaction adds member two, deletes code
- [ ] Pairing celebration: heart-halves snap animation + bulldog "adopted"
- [ ] Name-the-bulldog screen (writes `couples/{id}/bulldog.name`)
- [ ] Partner color selection during onboarding
- [ ] Security rules: full membership enforcement + emulator rules tests passing

**Exit test**: two phones, one couple, both see the same den + bulldog name in real time.

## M2 — The daily ritual 🐾 (make-or-break)

- [ ] Weekly goals CRUD (title, charm, owner, target units, ISO-week period)
- [ ] Goal cards: own (rose) / partner (their color) / shared (gradient); press feedback per motion-spec
- [ ] Paw-print check-ins: append-only `checkins` events, ink-splat stamp + tick haptic
- [ ] Rive bulldog integrated: `idle` / `happy` / `sleepy` states + boop interactions
- [ ] Home "Den": bulldog + Today strip (check in directly)
- [ ] Real-time partner ticker (`onSnapshot`) + toast in partner color
- [ ] Flick-a-heart reactions (physics arc; bulldog `love` state)
- [ ] Offline check-ins verified (airplane mode → sync on reconnect)

**Exit test**: checking in feels so good you do it for fake goals. Both partners' check-ins appear live on the other phone.

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
