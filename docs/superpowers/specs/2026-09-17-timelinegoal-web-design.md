# TimelineGoal (web) — Design Spec

**Date:** 2026-09-17
**Status:** Approved (brainstorming complete)
**Origin:** a web rebuild of the idea in
[johnnycuongn/TimelineGoal](https://github.com/johnnycuongn/TimelineGoal)
(an Expo app; its own specs live under `docs/superpowers/specs/` in that repo).

## What this is

A web app for exactly two people, a couple, to keep goals together across four
horizons (daily, monthly, quarterly, yearly), with a shared, realistic, animated
3D bulldog puppy as the emotional heart. Partners pair with a short share code
and sign in with Clerk.

**Product values, every feature judged against them:** cuteness, fun,
simplicity, interactivity. The test: "is this enjoyable for a couple to use
together?"

**Out of scope for this version:** Corners (topic boards with chat, pins,
polls), photo storage, push notifications, cosmetics and unlocks. Each is a
later project with its own spec.

## Core decisions

| Decision | Choice |
| --- | --- |
| Scope | Goals + 3D pup + pairing + login |
| Daily goals | Habits that repeat every day, one paw per partner per day |
| Horizons | day, month, quarter, year, with an optional parent link one level up |
| Partner liveness | Polling every 10s while the tab is visible |
| 3D | three.js via React Three Fiber (WebGL), drei helpers, rigged GLB |
| The pup | TimelineGoal's `bulldog-rigged.glb` (photoscanned English bulldog puppy on a 12-clip skeleton) |
| Auth | Clerk, already wired in the template |
| Data | MongoDB through `@repo/mongo`, one connection per request |
| Motion | `motion` (framer) springs for UI, skeletal clips for the pup |

## Couple-growth rules (carried over, non-negotiable)

1. **Two people, one world.** Exactly two members. All goals, personal and
   shared, are visible to both. No private mode.
2. **Never compare partners.** No leaderboards, no "who did more". Partner
   colours combine (gradients, arcs meeting), never compete.
3. **Cheerleader, not chore.** The pup reacts to progress and never demands
   care. Nothing decays; skipped days are quiet facts.
4. **Cosmetics-only rewards.** No points, levels or currencies. (None in this
   version at all.)
5. **Small taps feed the big dream.** The ladder stays visible; a check-in
   visibly nudges its parent.
6. **Commitment is a ritual.** Shared goals get the two-person seal.
7. **Presence over pressure.** Ambient partner signals; no nagging.

Copy is warm and first-person plural ("our goals", "we did it"), in the pup's
voice. Never guilt, never shame, never red "failed" states.

## Naming

- Product name: **TimelineGoal**. Browser title and header wordmark.
- The pup's character voice is "Mochi", but each couple names their own pup at
  pairing. Default name shown before naming: "your pup".
- In-app vocabulary: **Den** (home), **Timeline** (goals), **paw prints**
  (progress units), **charms** (emoji decorations), **seal** (shared-goal
  commitment), **share code** (pairing code).
- Cloudflare Worker and workspace name stay `build-day-template-syd`.

## Pages and navigation

Header nav: **Den · Timeline · Us**, plus the Clerk user button and the theme
toggle. Signed-out users see only the landing page and login.

### Landing (`/`)

The pup on a soft stage, one-line pitch, a "Sign in" button. A signed-in user
is redirected to `/den` (or `/pair` if they have no couple yet).

### Login (`/login`)

The template's Clerk sign-in, restyled to the new theme. Dev login link stays
(dev builds only).

### Pair (`/pair`)

Shown to signed-in users without a couple. Two cards:

- **Start our den**: creates a couple with this user as first member, mints a
  share code, and shows it big with a copy button. "Send this to your partner."
- **Join with a code**: a 6-character input. On success both are paired and
  the page celebrates (two colour halves snap together) then asks the couple
  to **name the pup** and pick partner colours, then goes to the Den.

A couple with one member is fully usable: goals and check-ins work, the Den
shows "waiting for your partner" with the code.

### Den (`/den`) — daily landing

- The **pup stage** front and centre (3D, see below).
- **Today strip**: every daily habit, with one paw button per partner
  (yours is tappable, your partner's shows their state). Tapping checks in;
  tapping again undoes it (same day only).
- **Partner ticker**: the last 10 check-ins by either partner, newest first,
  in the actor's colour: "Linh stamped *Run 20 min* 10 min ago". A heart
  button on a partner's entry sends a reaction; the pup on their side plays
  `love` when they next poll.
- **Evening**: after 20:00 local time with no check-ins today from either
  partner, the pup is `sleepy`; a boop wakes it.

### Timeline (`/goals`)

Segmented control: **Day · Month · Quarter · Year**.

- **Day**: daily habits as cards (own in your colour, partner's in theirs,
  shared as a gradient). Each card shows today's paw per partner and a 7-day
  dot strip per partner. Tap to check in. Edit and archive from a card menu.
- **Month / Quarter / Year**: milestone goals for the current period, each
  with N paw slots (1 to 20). A period picker steps back to past periods
  (read-only memories). Children appear nested under their parent with a
  small "climbs toward" chip. Progress bar shows own paws plus the ladder
  contribution.
- **New goal** dialog: title, charm (emoji picker, optional), horizon, owner
  (me / partner / shared), target paws (milestones only), and "climbs toward"
  (a parent goal one level up, optional). Creating a **shared** goal opens the
  **seal**: each partner presses their wax; sealed when both have. A goal
  saved with one seal shows "waiting for your paw" to the other partner on the
  Den and in the Timeline until they seal.

### Us (`/us`)

- Pup name (editable), partner colours (curated palette), anniversary date
  and "N days of us" counter.
- Pairing: the pending share code (if solo) with copy; "mint a new code"
  invalidates the old one.
- Credits card: "Bulldog Puppy" by doinspire, CC BY 4.0, and skeleton and
  animations by Quaternius (CC0), with links.

## Goals model

### Horizons and periods

| Horizon | Period format | Progress unit |
| --- | --- | --- |
| `day` | none (repeats every day) | one paw per partner per calendar day |
| `month` | `2026-09` | N paw slots, target 1–20 |
| `quarter` | `2026-Q3` | N paw slots, target 1–20 |
| `year` | `2026` | N paw slots, target 1–20 |

The calendar day for daily habits is the **browser's local day**, sent by the
client as `YYYY-MM-DD`. The server accepts a day within ±1 day of its own
clock, else rejects.

Milestone goals belong to the period they were created in. Past periods are
read-only memories. Nothing is deleted by time passing.

### Ownership and visibility

`owner` is a user id (personal) or `"shared"`. Both partners see every goal.
For personal goals only the owner checks in. For shared goals either partner
checks in, and each check-in records who stamped it.

### Check-ins

Append-only events: `{ goalId, uid, day, at, note? }`.

- Daily habit: at most one check-in per goal, per partner, per day (unique
  index). Undo deletes that day's event, allowed for today only.
- Milestone: each check-in stamps the next paw. Undo removes the most recent
  own check-in for that goal. Stamping past the target is refused.

### Ladder

A goal may have one `parentGoalId` exactly one horizon up (day → month, month
→ quarter, quarter → year). Cycles are impossible by construction.

Displayed progress of a milestone goal, in paws:

```
own = number of check-ins on this goal (capped at target)
ladder = sum over children of childFraction(child, thisPeriod)
progress = min(target, own + ladder)
```

where `childFraction` is:

- milestone child: `childProgress / childTarget` for the child's own period
  (a completed child = 1 paw on the parent).
- daily habit child: `daysWithACheckIn / daysInParentPeriodSoFar`, counting a
  day if any owner of the habit stamped it. A habit kept every day so far
  contributes 1 paw.

`childFraction` is recursive (a year goal sees quarters, which see months).
The maths is pure, in a browser-safe module, and unit tested.

**Completion:** `progress >= target`. Completing a month goal fires `party`;
completing a quarter or year goal fires `proud`.

### Seal (shared goals)

`seals: { [uid]: ISO date }`. Creating a shared goal records the creator's
seal. The goal is **sealed** once both partners have pressed. Unsealed shared
goals still accept check-ins; the seal is a ritual, not a gate.

## The pup

### Stage

A client-only React Three Fiber `<Canvas>` (never server-rendered, never in
the Worker bundle). One canvas mounted at a time; the stage unmounts when its
page unmounts.

- Model: `apps/web/public/models/pup.glb`, produced from TimelineGoal's
  `assets/models/bulldog-rigged.glb` by `gltf-transform optimize` with meshopt
  geometry compression and WebP textures (target ≤ 1.2 MB). The meshopt decoder
  ships in the bundle; nothing is fetched from third-party CDNs.
- Lighting for realism: `RoomEnvironment` via `PMREMGenerator` as the scene
  environment (no HDR download), one warm key directional light casting a
  PCF shadow (2048 map) onto a `ShadowMaterial` floor, soft fill light, ACES
  tone mapping, sRGB output. Device pixel ratio clamped to [1, 2].
- Framing: measure the model once at identity transform, normalise its
  longest dimension to 2 units, put its feet on the floor.
- Interaction: drag horizontally to turn (damped), click/tap to boop
  (`happy` + squish scale pulse). Neither affects any data.
- Loading: a soft skeleton placeholder in the stage; the GLB is preloaded on
  the landing and Den routes.
- Reduced motion (`prefers-reduced-motion`): the mixer freezes on `Idle`, no
  confetti.
- Tab hidden: the render loop pauses (R3F's frameloop + `visibilitychange`).

### Mood state machine

Moods are `idle | happy | party | proud | sleepy | pout | love`. Transient
moods (`happy`, `party`, `proud`, `love`) play once and return to the
persistent mood. A `nonce` lets the same mood re-trigger.

| Mood | Trigger | Clip |
| --- | --- | --- |
| `idle` | default | weighted ambient scheduler: `Idle` (8, 6–12s), `Idle_2` (4, 5–9s), `Eating` (3, 4–8s, reads as sniffing), `Walk` (3, 3–6s) |
| `happy` | any own check-in, a boop | `Gallop_Jump` once |
| `party` | a goal completed (month) or a seal completing | `Gallop_Jump` once + confetti |
| `proud` | a quarter or year goal completed | `Idle_HitReact_Left` once |
| `love` | partner reacted to my check-in (seen on poll) | `Idle_HitReact_Right` once |
| `sleepy` | no check-ins today by either partner and local hour ≥ 20 | `Idle_2_HeadLow` loop |
| `pout` | no check-ins for 3+ days by either partner | `Idle_2_HeadLow` loop |

Crossfades are 0.35s. The persistent mood is derived on the client from Den
data (`lastCheckInAt` for the couple, today's count) and local time, so the
server stays stateless about moods.

### Cuteness rules

- Style: soft surfaces, 20–24px card radius, pill buttons, no harsh dividers.
- Type: Fredoka (headings) and Nunito (body), base 16px, line-height ≥ 1.5.
- Icons: Lucide only. Emoji appear only as user-chosen charms.
- The pup is the only character; doodle accents (hearts, bones, stars, paws)
  are the motif. At most one focal animated moment per screen besides the pup.
- Dark mode is "desaturated rose, not inverted"; text contrast ≥ 4.5:1.

### Theme tokens (replace the template's terracotta theme in `styles.css`)

Light: background `#FDF2F8`, card `#FFFFFF`, muted `#FBF1F5`, border
`#F7E3EB`, foreground `#0F172A`, muted-foreground `#6B5561`, primary
`#BE185D`, primary-foreground `#FFFFFF`, secondary `#EC4899`, destructive
`#DC2626`, success `#15803D`, ring `#BE185D`.

Dark: background `#181015`, card `#241820`, muted `#2E1F28`, border `#3D2A34`,
foreground `#F6E9EF`, muted-foreground `#C8AAB8`, primary `#F472B6`,
primary-foreground `#3B0A22`, secondary `#F9A8D4`, destructive `#F87171`,
success `#4ADE80`, ring `#F472B6`.

Partner colour palette (light/dark): rose `#BE185D`/`#F472B6`, teal
`#0D9488`/`#2DD4BF`, blueberry `#4F46E5`/`#818CF8`, tangerine
`#EA580C`/`#FB923C`, grape `#7C3AED`/`#A78BFA`, lime `#4D7C0F`/`#A3E635`, sky
`#0284C7`/`#38BDF8`. Partner A defaults to rose, partner B to teal.

Clerk's appearance variables are restated from the light tokens.

### Motion tokens (UI, via `motion`)

- `spring.default` `{ damping: 15, stiffness: 150 }`, all spatial movement.
- `spring.press` `{ damping: 18, stiffness: 320, mass: 0.7 }`, press scale 0.96.
- `spring.bouncy` `{ damping: 9, stiffness: 180, mass: 0.9 }`, paw stamp, seal slam, confetti pop.
- Enter 250ms ease-out, exit 170ms ease-in, opacity only. List stagger 40ms.
- Reduced motion: springs become 120ms fades.
- Rules: no animation over 400ms that blocks input; nothing that shames.

Confetti is a small in-house canvas particle burst (no library).

## Data model (MongoDB)

All documents live in the database named in `MONGODB_URI`. `uid` is the Clerk
user id. Every query on couple-scoped collections filters by `coupleId` and the
server first verifies the caller is a member.

```
users        { _id: uid, displayName, coupleId?, createdAt }
couples      { _id, members: [uid] (1–2), partnerColors: { uid: colorKey },
               pupName?, anniversary?, inviteCode?, createdBy, createdAt }
goals        { _id, coupleId, title (1–80), charm?, horizon, owner: uid|'shared',
               period? (milestones), targetUnits? (milestones, 1–20),
               parentGoalId?, seals?: { uid: Date }, createdBy, createdAt,
               archivedAt? }
checkins     { _id, coupleId, goalId, uid, day: 'YYYY-MM-DD', at,
               reactions?: { uid: 'heart' } }
```

Indexes:

- `couples.inviteCode` unique, sparse.
- `goals { coupleId, horizon, period, archivedAt }`.
- `checkins { goalId, uid, day }` unique **partial** index, applied only to
  documents with `horizon: 'day'` (the goal's horizon is denormalised onto
  each check-in). This enforces one habit paw per partner per day. Milestone
  check-ins store `day` too but are unconstrained, since several stamps on
  one day are legal.
- `checkins { coupleId, at: -1 }` for the ticker.

**Pairing** is one atomic operation:
`findOneAndUpdate({ inviteCode, 'members.1': { $exists: false } }, { $push: { members: uid }, $unset: { inviteCode } })`
followed by setting `users.coupleId`. A user already in a couple cannot join
another. Share codes are 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(no ambiguous glyphs), regenerated on collision.

**Leaving** is out of scope; the Us page says so.

### Package layout (`packages/mongo`)

One entry per module in `exports`, no barrel:

- `./shared` (browser-safe): all JSON types, constants, colour palette,
  `periods` (ISO period strings, days-in-period, today), `ladder` (rollup
  maths), `mood` (persistent mood derivation), `share-code`.
- `./users`, `./couples`, `./goals`, `./checkins`: driver modules, each with
  `ensure…Indexes`, and returning plain JSON (ids as strings, dates as ISO).
- `scripts/ensure-indexes.ts` runs all of them. The `notes` module and its
  test are removed.

## Server functions (`apps/web/src/server`)

TanStack Start `createServerFn`, one file per feature. Each handler resolves
the Clerk user (`getAuth` from the request), loads the user's couple, and
refuses with a 401/403-style error otherwise.

- `me.ts`: `getMeFn` → user + couple (or null couple). Called by the root
  layout to drive redirects.
- `pairing.ts`: `createCoupleFn`, `joinCoupleFn(code)`, `mintCodeFn`,
  `updateCoupleFn({ pupName?, partnerColor?, anniversary? })`.
- `goals.ts`: `listGoalsFn({ horizon, period? })` → goals with computed
  progress; `createGoalFn`, `updateGoalFn`, `archiveGoalFn`, `sealGoalFn`.
- `checkins.ts`: `checkInFn({ goalId, day })`, `undoCheckInFn({ goalId, day })`,
  `reactFn({ checkinId })`.
- `den.ts`: `getDenFn({ day })` → today's habits with per-partner state, the
  ticker (last 10), `lastCheckInAt`, `unseenReactions` for the caller.

Validation happens in the `@repo/mongo` modules (lengths, ranges, horizon
ladder rule, membership); server functions only shape input.

## Client data flow

- Route loaders call server functions; pages read `Route.useLoaderData()`.
- A `usePolling(intervalMs = 10_000)` hook calls `router.invalidate()` on an
  interval while `document.visibilityState === 'visible'`, on Den and
  Timeline only.
- Mutations call the server function, then `router.invalidate()`. Check-ins
  update optimistically (paw stamps immediately, rolls back on error).
- A `PupMoodProvider` (React context + reducer: `{ mood, nonce }`) sits in the
  root; pages dispatch transient moods after mutations, and a small effect
  compares successive Den loads to detect partner check-ins (toast in their
  colour) and new reactions (`love`).

## Error handling

- Database unreachable: the existing "Could not reach MongoDB" error component
  pattern, restyled.
- Invalid or used share code: inline message "That code isn't waiting for
  anyone. Ask your partner for a fresh one."
- Check-in conflicts (double tap, already stamped): idempotent, returns
  current state, no error shown.
- 3D load failure (bad GPU, blocked WebGL): the stage shows a still
  illustration placeholder and a one-line note; the rest of the app works.
- Signed in but no couple on any app route: redirect to `/pair`.

## Testing

- `bun test` in `packages/mongo`: pure modules (`periods`, `ladder`,
  `share-code`, `mood`) and each driver module against
  `mongodb-memory-server` (pairing atomicity, unique daily paw, ladder rule,
  membership refusals, seal).
- `bun test` in `apps/web` for the pup's idle scheduler (pure) and the
  Den-diff logic that detects partner activity.
- End-to-end by hand in a real browser (Playwright, as in the setup session):
  two dev users pair, one checks in, the other sees the ticker and reacts,
  the pup reacts. The dev-login route only serves one user, so the second
  partner signs in through Clerk's UI with a test email.
- `bun run check` (Ultracite + typecheck) clean before each commit.

## Deployment notes

- The GLB is a static asset under `apps/web/public/models/`, served by the
  Worker's assets; cache headers long-lived, filename content-hashed by hand
  when the model changes.
- Run `ensure-indexes` against Atlas before the first deploy of this version.
- No new secrets. The Worker still needs `MONGODB_URI` and the Clerk keys.

## Build order

Each stage is runnable end to end and reviewed before the next.

1. **Foundation**: theme tokens and fonts, header/nav, remove notes/about,
   `@repo/mongo` shared modules with tests (periods, ladder, share code, mood).
2. **A couple exists**: users/couples modules, `me`/pairing server functions,
   `/pair`, redirects, `/us` basics.
3. **The daily ritual**: goals/checkins modules, Timeline (Day tab), Den today
   strip and ticker, polling, optimistic paws.
4. **The ladder**: Month/Quarter/Year tabs, parent linking, rollups, seal.
5. **The pup**: model pipeline, stage, moods, boop/turn, confetti, reactions
   and `love`, sleepy/pout, reduced motion, load fallback.
6. **Polish**: landing page, empty states, dark mode pass, credits, a11y pass,
   deploy.
