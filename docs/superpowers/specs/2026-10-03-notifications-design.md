# Notifications — design

Date: 2026-10-03

## Problem

CoupleGoal is a two-person app, but nothing tells you what the other person did
until you open it. Realtime keeps an open den fresh; a closed one is silent. The
installed PWA on iPhone (iOS 16.4+) can receive Web Push, and nothing uses it.

## What we are building

Push notifications to the **partner** of whoever acts — never to the actor — for
every event in the den, plus a daily reminder. Each kind can be muted on its own
from the Us page; all are on by default.

| Kind | Fires when | Recipient | Delay | Example copy |
|---|---|---|---|---|
| `paw_shared` | partner paws a shared goal (`owner_id` null) | partner | 30 s | "Mia pawed 🏃 Morning run for you both" |
| `paw_own` | partner paws a goal they own | partner | 30 s | "Mia pawed 📚 Read 20 pages" |
| `milestone_done` | a paw brings a milestone's count in its period to exactly `target_units` | partner of the actor | 30 s | "You two finished 💰 Save $500! 🎉" / "Mia finished 💰 Save $500! 🎉" |
| `heart` | `reactions` insert | owner of the paw (`checkins.user_id`), if not the actor | 0 | "Mia ❤️ your Morning run paw" |
| `seal` | `goal_seals` insert | the goal's `created_by`, if not the actor | 0 | "Mia sealed 🌍 Japan trip" |
| `goal_added` | `goals` insert | partner | 0 | "Mia added 🎸 Learn a song" |
| `goal_archived` | `goals.archived_at` null → set | partner | 0 | "Mia tucked away Morning run" |
| `partner_joined` | `members` insert | the member already in the den | 0 | "Mia joined your den 🐶" |
| `reminder` | daily, at the member's chosen local time, only if they have open goals | the member | — | "Today's paws are waiting — 2 left" |

Copy never genders anyone ("her", "his"): the app is for any two people.

Not notified: goal edits (title, charm, target), pup name and anniversary
changes. They are frequent and low-value.

A partner cannot paw a goal owned by the other (`checkins_validate`: "Only the
owner stamps this one"), so every paw is either on a shared goal or on the
actor's own.

**Success:** on an installed iPhone, a partner's paw arrives on the lock screen
30–60 s later and tapping it opens the den; a paw undone within 30 s never
buzzes; the reminder arrives once a day at the chosen time and stays silent if
everything is already pawed.

## Architecture

```
action (insert/update/delete)
   │  after-row trigger
   ▼
notification_outbox  ──(un-paw within 30 s: cancelled_at)
   │  pg_cron every 30 s: if anything is due → pg_net POST
   ▼
Edge Function send-push  ──▶  Web Push (Apple / Google)  ──▶  service worker  ──▶  lock screen
```

Everything server-side lives in Supabase. Alternatives considered and rejected:
per-event Database Webhooks with the function sleeping out the undo window (no
batching, no retries, reminder still needs cron), and a Vercel sender (spreads
the elevated Supabase key to a second platform).

## Database

Four migrations: `0011_notifications.sql` (types, tables, RLS,
`save_push_subscription`), `0012_notification_triggers.sql` (the other functions and
the triggers), `0013_notification_fixes.sql` (review fixes to the reminder window and
tuck-away undo), `0014_notification_cron.sql` (dispatch and cron, applied after the
Vault entries exist).

### Types and tables

`notification_kind` enum: `paw_shared`, `paw_own`, `milestone_done`, `heart`,
`seal`, `goal_added`, `goal_archived`, `partner_joined`, `reminder`.

**`push_subscriptions`** — one row per installed device.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid → `auth.users` on delete cascade | |
| `endpoint` | text unique | |
| `p256dh`, `auth` | text | subscription keys |
| `user_agent` | text null | for debugging only |
| `created_at` | timestamptz | |
| `last_ok_at` | timestamptz null | last 201 from the push service |

RLS: select and delete own rows. No insert/update grants; writes go through
`save_push_subscription(p_endpoint, p_p256dh, p_auth, p_user_agent, p_timezone)`, a
`security definer` RPC that upserts on `endpoint` and sets `user_id =
auth.uid()`. Reassigning matters: when one partner signs out and the other signs
in on the same phone, the device must stop receiving the first partner's
notifications. The RPC also creates the caller's `notification_prefs` row if
missing, or updates its time zone (an unknown zone becomes `UTC`).

**`notification_prefs`** — one row per member, private.

| column | type | notes |
|---|---|---|
| `user_id` | uuid pk → `auth.users` on delete cascade | |
| `timezone` | text not null | IANA zone, checked against `pg_timezone_names` |
| `remind_at` | time not null default `'20:00'` | |
| `muted` | `notification_kind[]` not null default `'{}'` | |
| `last_reminded_on` | date null | server-only |

RLS: select and update own row. Column grants allow updating `timezone`,
`remind_at` and `muted` only.

**`notification_outbox`** — the queue.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `couple_id` | uuid | |
| `recipient_id` | uuid | |
| `actor_id` | uuid null | null for `reminder` |
| `kind` | `notification_kind` | |
| `goal_id` | uuid null | |
| `checkin_id` | uuid null | **no foreign key**: a deleted check-in cancels its rows instead of erasing them |
| `send_after` | timestamptz | |
| `claimed_at` | timestamptz null | |
| `sent_at` | timestamptz null | |
| `cancelled_at` | timestamptz null | |
| `attempts` | int default 0 | |
| `last_error` | text null | `'muted'`, `'no devices'`, `'nothing open'`, or the push error |
| `created_at` | timestamptz | |

Partial index on `(send_after) where sent_at is null and cancelled_at is null`.
RLS enabled with no policies and no grants to `anon`/`authenticated`.

None of the three tables joins the `supabase_realtime` publication.

### Functions

- `enqueue_notification(p_couple, p_actor, p_kind, p_goal, p_checkin, p_delay
  interval)` — finds the other member of the couple; returns without inserting
  if there is none. Mute is **not** checked here, so muting also silences rows
  already queued.
- `open_goals_for(p_user uuid, p_day date) returns int` — `day`-horizon goals in
  the user's couple that are not archived, are the user's own or shared, are a
  habit (`period is null`) or a one-off for `p_day` (`period = p_day::text`), and
  have no check-in by `p_user` on `p_day`. Milestones never count.
- `claim_due_notifications(p_limit int default 100)` — `update … set claimed_at =
  now(), attempts = attempts + 1` on rows where `send_after <= now()`, not sent,
  not cancelled, and `claimed_at` is null or older than 2 minutes, using `for
  update skip locked`; returns the claimed rows. Executable only by
  `service_role`.
- `enqueue_reminders(p_now timestamptz default now())` — `p_now` lets the scenario
  tests stand at any local time. For each `notification_prefs` row whose user has at
  least one subscription, `reminder` not in `muted`: the due day is the local date
  if local time `(now() at time zone timezone)` has reached today's `remind_at`,
  else the day before. If local time is within `[due day + remind_at, + 2 h)` and
  `last_reminded_on` is before the due day: if `open_goals_for(user, due day) > 0`,
  insert a `reminder` row due now; set `last_reminded_on` to the due day either
  way. The window may cross midnight (a 23:50 reminder fires on the 00:00 tick);
  its two hours stop a reminder firing at 1 am for someone who subscribed late.
- `dispatch_notifications()` — if any outbox row is due, `net.http_post` to the
  `send-push` URL with header `x-dispatch-secret`, both read from Vault
  (`send_push_url`, `dispatch_secret`). Otherwise does nothing.

All `security definer`, `set search_path = ''`, `execute` revoked from `public,
anon, authenticated` except `save_push_subscription` (granted to
`authenticated`).

### Triggers (all `after … for each row`)

| Table | Event | Behaviour |
|---|---|---|
| `checkins` | insert | `paw_own` if the goal's `owner_id = new.user_id`, else `paw_shared`; delay 30 s. If the goal is a milestone and the count of check-ins on it inside `period_range(goal.period)` now equals `target_units`, also enqueue `milestone_done` with the same `checkin_id`. |
| `checkins` | delete | `cancelled_at = now()` on unsent rows with `checkin_id = old.id`. |
| `reactions` | insert | `heart` to the paw's `user_id` if it differs from `new.user_id`; delay 0. |
| `goal_seals` | insert | `seal` to the goal's `created_by` if it differs from `new.user_id`; delay 0. Skips `goals_autoseal`'s seal for the creator. |
| `goals` | insert | `goal_added`, actor `new.created_by`; delay 0. |
| `goals` | update of `archived_at` | when `old.archived_at is null and new.archived_at is not null`: `goal_archived`, actor `auth.uid()`; delay 0. |
| `members` | insert | `partner_joined`, actor `new.user_id`; delay 0. |

The milestone count matches `checkins_validate`: both partners' paws count. The
check-in that reaches the target triggers the celebration, so undoing it in time
cancels the celebration too.

### Cron — `supabase/migrations/0014_notification_cron.sql`

A separate migration, applied after the Vault entries exist (see Order of work).

| Job | Schedule | Runs |
|---|---|---|
| `dispatch-notifications` | `30 seconds` | `select public.dispatch_notifications()` |
| `enqueue-reminders` | `*/15 * * * *` | `select public.enqueue_reminders()` |
| `prune-notifications` | `0 4 * * *` | delete outbox rows older than 30 days; delete subscriptions whose `coalesce(last_ok_at, created_at)` is older than 60 days |

Requires the `pg_cron` and `pg_net` extensions (both on the free tier).

## Edge Function — `supabase/functions/send-push/`

- `verify_jwt = false`; rejects with 401 unless header `x-dispatch-secret`
  matches the `DISPATCH_SECRET` secret (constant-time comparison).
- Uses `supabase-js` with the service key the platform injects into the
  function's environment. Nothing is committed; no `sb_secret_` key appears in
  the repo or client (Rule 0). The owner accepted this as the one place with
  elevated access.
- Per run:
  1. `claim_due_notifications(100)`.
  2. Rows whose kind is in the recipient's `muted` → `cancelled_at`, `last_error
     = 'muted'`.
  3. `reminder` rows → re-check `open_goals_for` at the recipient's local date;
     if 0 → cancelled, `'nothing open'`.
  4. Group a recipient's `paw_shared` and `paw_own` rows into one notification.
  5. Build copy with `supabase/functions/_shared/notification-copy.ts` — a pure
     module (no Deno or Supabase imports) taking the kind(s), actor display
     name, goal title/charm/owner and counts, returning `{ title, body, url,
     tag }`.
  6. Send to each of the recipient's subscriptions; TTL 12 h (`reminder`: 2 h).
- Results:

| Push service | Action |
|---|---|
| 201 | `sent_at = now()`; subscription `last_ok_at = now()` |
| 404 / 410 | delete that subscription |
| 429 / 5xx / network | leave unsent, record `last_error`; next run retries; after 5 attempts `cancelled_at`, keep the error |
| recipient has no subscriptions | `sent_at = now()`, `last_error = 'no devices'` |

A row with several devices counts as sent if any device returned 201.

- Copy rules: title is always "CoupleGoal". Merged paws: one → "Mia pawed 🏃
  Morning run"; several → "Mia pawed 3 goals: Morning run, Read 20 pages and 1
  more". A missing charm drops the emoji. Titles over 40 characters are
  truncated with "…".
- Links: `paw_*`, `heart`, `reminder`, `partner_joined` → `/den`; `seal`,
  `goal_added`, `goal_archived`, `milestone_done` → `/goals`.
- Tag: `${kind-group}-${local date}` (paws share one group; the date is in the
  recipient's `timezone`), so a newer notification replaces the older one on
  the lock screen.
- Library: `npm:web-push` under Deno first; if its crypto fails there, a
  Deno-native Web Push library. Settled in the first plan task.

### Secrets (set by the owner)

`supabase secrets set`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` (a `mailto:` address of the owner's choosing — it is sent to the
push services), `DISPATCH_SECRET`. Vault: `dispatch_secret` (same value),
`send_push_url`. The plan gives the owner the exact commands; the private key
is never printed into the session.

## Client

### Service worker

`vite-plugin-pwa` moves to `strategies: "injectManifest"`, `srcDir: "src"`,
`filename: "sw.ts"`. `src/sw.ts` reproduces today's `generateSW` behaviour —
precache `self.__WB_MANIFEST`, `cleanupOutdatedCaches`, navigation fallback to
`/index.html` with `/api/` denied, CacheFirst for `/models/*.glb` (2 entries, 1
year), StaleWhileRevalidate for Google Fonts (20 entries, 1 year),
`skipWaiting` + `clientsClaim` for `autoUpdate` — and adds:

- `push`: `showNotification(title, { body, tag, icon: "/pwa-192x192.png", data:
  { url } })`.
- `notificationclick`: close it, focus an existing window client and
  `navigate(url)`, else `clients.openWindow(url)`.

`workbox-precaching`, `workbox-routing`, `workbox-strategies`,
`workbox-expiration` become explicit devDependencies.

### Data and glue

- `src/data/notification-mutations.ts` — `savePushSubscription(sub)`,
  `removePushSubscription(endpoint)`, `updateNotificationPrefs({ muted?,
  remindAt? })`, `syncTimezone(tz)`.
- `src/data/use-notification-prefs.ts` — SWR hook for the caller's own prefs
  row; not part of `fetchCoupleData`, which is shared den data.
- `src/lib/push.ts` — no Supabase imports. `pushSupport()` → `"unsupported" |
  "needs-install" | "default" | "granted" | "denied"` (uses `isIos` and the
  standalone check from `src/hooks/use-is-standalone`); `subscribe(vapidKey)`;
  `currentSubscription()`; `urlBase64ToUint8Array`.
- Sign-out (`src/auth/auth-provider.tsx`): before `signOut`, remove this
  device's subscription row and `unsubscribe()`; failures are ignored so
  sign-out always completes.
- Timezone: on den load, if a prefs row exists and
  `Intl.DateTimeFormat().resolvedOptions().timeZone` differs, `syncTimezone`.
- `VITE_VAPID_PUBLIC_KEY` — new env var; the owner adds it to `.env.local` and
  to Vercel (preview and production).

### UI — "Notifications" card on the Us page

| `pushSupport()` | Card shows |
|---|---|
| `needs-install` | "Add CoupleGoal to your Home Screen to get notifications" with the Share → Add to Home Screen steps, styled like `install-hint.tsx` |
| `unsupported` | "This browser can't show notifications." |
| `default` | **Turn on notifications** — `Notification.requestPermission()` runs inside the click handler (iOS requires a user gesture), then subscribe → `savePushSubscription` → `syncTimezone` |
| `denied` | "Notifications are off for CoupleGoal. Turn them on in Settings → Notifications → CoupleGoal." |
| `granted` | Toggles grouped **Paws** (shared, hers, milestone done), **Den** (hearts, seals, new goals, archived goals, partner joined), **Reminder** (on/off and a time input for `remind_at`) |

If permission is `granted` but this device has no subscription row (e.g. after
another account signed out), the card resubscribes silently on mount.

New primitive `src/components/ui/switch.tsx`: a hand-written wrapper over
`@radix-ui/react-switch`, tokens from `src/styles.css`. Verified at 320, 375,
768 and 1280 px (Rule 1).

## Testing

- **vitest**: `notification-copy` (every kind, merged paws of 1/2/many, own vs
  shared milestone, missing charm, long titles); `urlBase64ToUint8Array`;
  `pushSupport()` across standalone/permission/API-present combinations.
- **SQL scenarios** — `supabase/tests/notifications.sql`, run inside `begin …
  rollback` against the project with `request.jwt.claims` set per actor: paw on
  shared and own goals → right kind and recipient; un-paw → cancelled; paw
  reaching `target_units` → `milestone_done`; creator's autoseal → no row;
  partner's seal → `seal`; heart on own paw → no row; archive → `goal_archived`;
  `open_goals_for` with habits, today's one-off, tomorrow's one-off, pawed and
  unpawed; `enqueue_reminders` inside and outside the window and on a second
  run the same day; `claim_due_notifications` never returns a row twice.
- **RLS probe** (`scripts/rls-probe.mjs`): partner cannot read your
  subscriptions or prefs; clients cannot select or insert outbox rows or call
  `claim_due_notifications`/`enqueue_notification`; `last_reminded_on` is not
  updatable; `save_push_subscription` moves an endpoint to the caller.
- **End to end** (owner, two accounts, real iPhone): against a preview deploy
  (`vercel deploy --target=preview`) — paw, undo within 30 s, heart, milestone,
  reminder at a time a few minutes ahead, mute a kind, sign out.

## Order of work

1. Migrations `0011` and `0012` + SQL scenarios + RLS probe; regenerate
   `src/lib/database.types.ts`.
2. Owner generates VAPID keys and sets secrets and Vault entries.
3. `notification-copy` + `send-push`; deploy the function; settle the Web Push
   library.
4. `0014_notification_cron.sql` (needs the Vault entries; `0013` is the review fixes).
5. Service worker switch, data layer, Us-page card, switch primitive.
6. Preview deploy and end-to-end test. Production and `v*` tags remain the
   owner's call.

## Out of scope

App-icon badge counts, quiet hours (iOS Focus covers it), per-goal muting,
notifications for edits, email or SMS fallback, Android-specific tuning.
