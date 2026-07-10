# TimelineGoal — Design Spec

**Date:** 2026-07-10
**Status:** Approved by user (brainstorming complete)
**Original prompt:** see `docs/prompt_v1.md`

## What This Is

A mobile app for exactly two people — a couple — to track goals together across three horizons (weekly, quarterly, yearly), with a shared reactive bulldog mascot as the emotional heart, and shared topic spaces ("Corners") for discussing, deciding, and remembering.

**Product values (every feature is judged against these):** cuteness, fun, simplicity, interactivity. The test: "is this enjoyable for a couple to use together?"

**Core decisions:**

| Decision | Choice |
|---|---|
| Heart of the app | Goal tracking; Corners support bigger discussions |
| Fun flavor | Reactive companion bulldog — cheerleader, not a chore (no hunger/care pressure) |
| Check-in mechanic | Zero-friction: tap progress on a goal card anytime |
| Goal structure | Linked ladder: yearly → quarterly → weekly; child check-ins nudge parent bars |
| Topic spaces | "Corners": chat + pinnable scrapbook cards + polls; decisions convert to goals |
| Bulldog tech | Rive state machine (60fps, reactive, code-driven inputs) |

## Tech Stack

- **Expo (managed) + TypeScript + Expo Router** (file-based navigation)
- **Firebase**: Auth (Apple/Google/email), Firestore (real-time sync + offline persistence), Storage (photos)
- **Motion**: Reanimated 4 (+ react-native-worklets, New Arch) + Gesture Handler, Rive React Native runtime, Expo Haptics, lightweight Reanimated-based confetti particles (no heavy lib)
  - *Note: build uses Expo SDK 57 (RN 0.86, React 19.2, TS 6). Reanimated 4 keeps the `withSpring`/`useSharedValue`/`useAnimatedStyle` API used throughout this spec; worklets moved to their own package.*
- **State**: React Query wrapping Firestore listeners + Zustand for UI/animation state
- **Fonts**: Fredoka (headings) / Nunito (body) via expo-font
- **Testing**: Jest + React Native Testing Library; Firestore security-rules tests via emulator
- **No servers for v1.** Push notifications via Expo Notifications; if client-driven push gets fiddly, add one small Cloud Function (Blaze plan, $0 at this scale)

## Design System

Generated via ui-ux-pro-max (`--design-system`, "couple relationship goal tracking playful cute fun interactive mobile app"):

- **Style**: Soft UI Evolution — soft depth, improved shadows, WCAG AA+ contrast, full light + dark mode
- **Palette (romance rose)**: primary `#BE185D`, on-primary `#FFFFFF`, secondary `#EC4899`, accent/destructive `#DC2626`, background `#FDF2F8`, foreground `#0F172A`, muted `#FBF1F5`, border `#F7E3EB`
- **Partner colors**: partner A rose; partner B accent chosen during onboarding; shared goals use a gradient of both
- **Rules**: semantic color tokens only (no raw hex in components), no emoji as structural icons (Lucide SVG set), 44pt+ touch targets, 4/8pt spacing scale, dynamic type + reduced-motion support

## Screens & Navigation

Bottom tab bar, 4 tabs: **🏠 Home · 📅 Goals · 💬 Corners · 👤 Us**

### Home — "The Den" (daily landing)
- Bulldog front and center, live Rive state machine
- **Today strip**: the 2–4 weekly goals needing attention now; check in directly from here
- **Partner ticker**: "Linh checked in *Run 3x* 10 min ago" → tap to send a reaction (heart / high-five / proud)
- **Weekly pulse ring** around the bulldog: fills with both partners' check-ins in their colors, meeting in the middle
- Streak doodles decorate the den wall (see Gameplay)

### Goals — "The Timeline"
- Segmented control: **Week · Quarter · Year**
- Week: card stack — own goals (rose), partner's (their color), shared (gradient). Tap to check in, long-press to edit
- Quarter/Year: the ladder — each big goal shows child goals as paw prints climbing toward the milestone; weekly check-ins animate a nudge up the parent bar
- Shared goal creation ends with the **seal moment** (see Gameplay)

### Corners
- Grid of topic cards with custom cover photo + emoji-charm decorations
- Inside a Corner: scrapbook pin area (photos, notes, links) on top, chat below, `+` for polls
- Decided polls/messages get a ⭐ stamp; **"Make it a goal →"** converts a decision into a Timeline goal

### Us
- Couple profile: anniversary, days-together counter
- Bulldog customization: name, bandana colors and den decorations (unlocked by milestones)
- Notification preferences, pairing management

### Onboarding
Sign in → create couple **or** enter partner's 6-char invite code → pairing celebration (two heart halves snap together; bulldog is "adopted") → name the bulldog together → first-goal wizard.

Modals for goal creation and polls; shared-element transitions where cards expand.

## Motion & Gameplay Spec

This section becomes a standing `docs/motion-spec.md` plus a project skill; every future screen must follow it.

### Motion principles
1. **Everything is springy, nothing linear** — Reanimated `withSpring` (damping ~15, stiffness ~150) for all movement
2. **Touch answers within 100ms** — press scales card to 0.96 + soft haptic; release springs back; no dead taps
3. **Motion carries meaning** — no decoration-only animation; max 1–2 animated focal points per screen (bulldog counts as one)
4. **Cute timing** — enter 250ms ease-out, exit ~170ms ease-in, list stagger 40ms/item; Reduce Motion swaps springs for fades and disables confetti
5. **Partner presence is ambient** — Firestore listeners drive live moments: partner avatar pulses when they're in-app; their check-ins toast in their color

### Bulldog state machine (Rive)

| State | Trigger | Behavior |
|---|---|---|
| `idle` | default | Breathing, ear flicks, blinks; eyes follow finger on touch |
| `happy` | any check-in | Wiggle + tail blur + jump |
| `party` | goal completed / seal moment | Zoomies + confetti (app layer) + strong haptic |
| `proud` | quarterly/yearly milestone | Sits tall, sparkle eyes, medal |
| `sleepy` | no check-ins today, evening | Curled up, sleep bubble; tap to boop awake (squish + snort) |
| `pout` | 3+ quiet days (both) | Droopy jowls, puppy eyes — never text-guilt |
| `love` | partner sends a reaction | Catches a floating heart, rolls over |

Free-play boops (belly poke = squish; drag = leans in) attach to no mechanics — pure joy.

### Gameplay mechanics (v1)
- **Paw-print progress**: a goal with N units shows N paw slots; each check-in stamps one with an ink-splat spring + haptic tick
- **Seal-the-deal**: creating a shared goal arms a 10s window; both partners tap → wax-stamp slam, screen-edge glow in both colors, `party`
- **Weekly pulse ring**: both partners' contributions fill an arc from opposite ends, closing the loop together
- **Ladder nudge**: a weekly check-in floats a paw print up to bump the quarterly bar
- **Streak doodles**: consecutive completed weeks draw hand-drawn doodles (hearts, bones, stars) on the den wall — history becomes decor
- **Reactions**: flick a heart at a partner's check-in; it arcs with physics; bulldog tries to catch it

### Reward economy
Cosmetics only — bandanas, den decorations, doodle styles unlocked at milestones. No points, levels, currencies, or partner-vs-partner comparison. Notifications are warm ("Mochi says hi 🐾"), optional, and never streak-shaming.

## Data Model (Firestore)

Everything for a couple lives under one `couples/{coupleId}` tree; membership-based security rules (`request.auth.uid in resource.data.members`) gate the whole tree.

```
users/{uid}                    ← profile, fcmToken, coupleId
invites/{code}                 ← 6-char pairing codes, short TTL

couples/{coupleId}
  ├─ members: [uidA, uidB], partnerColors, anniversary
  ├─ bulldog: { name, mood inputs, unlockedCosmetics, equipped }
  ├─ goals/{goalId}
  │    ├─ title, charm, horizon: week|quarter|year
  │    ├─ owner: uidA | uidB | 'shared'
  │    ├─ parentGoalId              ← the ladder
  │    ├─ targetUnits, period       ← e.g. 2026-W28, 2026-Q3, 2026
  │    ├─ sealed: { byA, byB, sealedAt }
  │    └─ checkins/{id}: { uid, at, note? }     ← append-only
  ├─ corners/{cornerId}
  │    ├─ title, coverPhoto, charms
  │    ├─ pins/{id}: { type: photo|note|link|poll, position, decided, linkedGoalId? }
  │    └─ messages/{id}: { uid, text, reactions, decided }
  └─ reactions/{id}: { from, to, type, targetCheckinId }
```

**Key decisions:**
- **Check-ins are append-only events**, not counters — progress is a count per period. Free history (future yearly recap), safe offline merges, no lost simultaneous taps
- **`period` on weekly goals** (ISO week) means "this week" is a query and archiving is automatic — no cron
- **Ladder math is client-side** (quarterly progress = children's completion)
- **Real-time via `onSnapshot`** on goals + ticker; Firestore offline persistence for subway-proofing
- **Pairing**: creating a couple mints an invite code; partner's entry runs a transaction adding member two and deleting the code
- **Storage**: photos under `couples/{coupleId}/…`, same membership rule, client-side compression before upload
- **Cost**: two users fit comfortably in the free Spark tier; photo compression keeps Storage tame

## Error Handling & Edge Cases

- **Offline**: Firestore persistence makes check-ins work offline and merge on reconnect (append-only events can't conflict)
- **Un-pairing / breakup**: out of scope for v1 beyond "leave couple" in settings (data retained; rejoin by re-invite). No data-split tooling
- **Seal timeout**: if partner doesn't tap within the window, goal saves unsealed; partner gets a "seal pending" nudge and can seal from their next app open
- **Notification failures**: pushes are best-effort; the app never depends on them for correctness

## Build Roadmap

Each milestone is shippable to the couple's own phones.

- **M0 — Foundations**: Expo + TS scaffold, Router tabs, design tokens, Firebase project + emulators, security-rules skeleton, motion-spec doc + project skill
- **M1 — A couple exists**: auth, create couple, invite pairing, pairing celebration, name-the-bulldog. *Exit test: two phones, one shared den*
- **M2 — The daily ritual** (make-or-break): weekly goals CRUD, paw check-ins with springs + haptics, Rive bulldog (`idle/happy/sleepy/boop`), Den + Today strip, partner ticker + reactions. *Exit test: checking in feels so good you do it for fake goals*
- **M3 — The Timeline**: quarterly/yearly goals, ladder + nudge, Week/Quarter/Year views, seal-the-deal, pulse ring, remaining bulldog states, streak doodles
- **M4 — Corners**: grid + covers/charms, chat, pins, polls, ⭐ stamps, decision→goal pipeline, Storage + compression
- **M5 — Polish & ship**: notifications, cosmetics/unlocks, empty states (bulldog holds a "dream big?" sign), reduced-motion pass, dark mode pass, onboarding wizard, EAS builds via TestFlight / internal track

**Testing**: Jest + RNTL for logic (period math, ladder rollups), emulator-based security-rules tests; delight is tested on real phones.
