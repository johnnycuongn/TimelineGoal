# Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push a notification to your partner's installed iPhone whenever you act in the den (paws, hearts, seals, new and archived goals, joining), plus a daily "you have paws left" reminder at a time each person picks.

**Architecture:** After-row triggers write rows into a private `notification_outbox`, due 30 s later for paws (an undo inside the window cancels them) and immediately for everything else. A `pg_cron` job checks every 30 s and, only when something is due, calls the `send-push` Edge Function through `pg_net`; the function claims rows, merges paws, writes copy, and sends Web Push with VAPID. On the phone, a custom service worker (vite-plugin-pwa `injectManifest`) shows the notification; the Us page gets a Notifications card for opt-in, per-kind toggles and the reminder time.

**Tech Stack:** Postgres (triggers, RLS, `pg_cron` 1.6, `pg_net`, Vault) on Supabase project `uosxptayqdetgbyercqt`; Supabase Edge Functions (Deno, `npm:@supabase/supabase-js@2`, `npm:web-push@3.6.7`); Vite 7 + React 19 + TypeScript; vite-plugin-pwa 1.3 / Workbox 7.4; Radix; Vitest; Biome.

**Spec:** `docs/superpowers/specs/2026-10-03-notifications-design.md`

## Global Constraints

- Node 22 (`nvm use`), npm. `npm run fix && npm run check && npm test` before every commit.
- Never read `.env.local`. Never write an `sb_secret_` key or the service-role key anywhere in the repo or client. `send-push` reads the platform-injected `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` from its environment only (owner-approved).
- The VAPID private key and `DISPATCH_SECRET` are generated and set **by the owner** in their own terminal; they never appear in this session's output.
- Publishing is the owner's call: no `vercel --prod`, no `v*` tag. Use `vercel deploy --target=preview`.
- Mobile-first: verify UI at 320 / 375 / 768 / 1280 before claiming it works.
- Every write is a function in `src/data/*mutations.ts`; error strings are user-facing copy in the app's warm voice.
- Domain types in `src/lib/domain.ts`; rows mapped once in `src/data/mappers.ts`.
- UI primitives in `src/components/ui/` are hand-written Radix wrappers; tokens only in `src/styles.css`.
- Never import `pup-stage` or `pup-model` outside `src/components/pup/`.
- Notification copy is gender-neutral: no "her"/"his". Title is always `CoupleGoal`.
- Every SQL function: `security definer`, `set search_path = ''`, fully-qualified names, `execute` revoked from `public, anon, authenticated` unless the spec grants it.
- New tables never join the `supabase_realtime` publication.
- Migrations are applied with the Supabase MCP `apply_migration` (name = file name without `.sql`, query = file contents), then `src/lib/database.types.ts` is regenerated with MCP `generate_typescript_types`.

## Review Focus

1. **Stamp, then undo within 30 s** — the partner must never be buzzed for a paw that no longer exists, including the milestone celebration that paw triggered. (Task 4 SQL scenario.)
2. **One phone, two accounts in turn** — after A signs out and B signs in on the same iPhone, A's events must reach nobody on that phone and B's partner events must reach it. (Task 3 + Task 4 scenarios on `save_push_subscription`; Task 8 sign-out.)
3. **Reminder around midnight and across time zones** — a `remind_at` of 23:00 must fire at 23:30 local and must not fire again at 00:30 the next local day; Sydney-time members are judged on Sydney's date. (Task 4 `enqueue_reminders` scenarios with `p_now`.)
4. **Malformed or hostile push payload** — a non-JSON body, missing fields, or a `url` pointing off-site must still show a sensible notification and only ever open a path inside the app. (Task 7 `push-payload` tests.)
5. **Awkward goal titles** — very long titles, no charm, the same goal pawed twice in one batch, and an actor whose member row is gone must all produce readable copy. (Task 1 and Task 2 tests.)

---

### Task 1: Notification copy

**Files:**
- Create: `supabase/functions/_shared/notification-copy.ts`
- Test: `supabase/functions/_shared/notification-copy.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type NotificationKind = "paw_shared" | "paw_own" | "milestone_done" | "heart" | "seal" | "goal_added" | "goal_archived" | "partner_joined" | "reminder"`
  - `interface GoalRef { title: string; charm: string | null; shared: boolean }`
  - `type CopyInput` (union below)
  - `interface PushMessage { title: string; body: string; url: string; tag: string }`
  - `notificationCopy(input: CopyInput, localDay: string): PushMessage`
  - `goalName(goal: GoalRef): string`

- [ ] **Step 1: Let vitest see function tests**

`vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    },
  }),
);
```

- [ ] **Step 2: Write the failing tests**

`supabase/functions/_shared/notification-copy.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { type GoalRef, goalName, notificationCopy } from "./notification-copy.ts";

const DAY = "2026-10-03";
const run: GoalRef = { title: "Morning run", charm: "🏃", shared: true };
const read: GoalRef = { title: "Read 20 pages", charm: "📚", shared: false };
const save: GoalRef = { title: "Save $500", charm: null, shared: true };

describe("goalName", () => {
  test("puts the charm in front of the title", () => {
    expect(goalName(run)).toBe("🏃 Morning run");
  });

  test("drops a missing charm", () => {
    expect(goalName(save)).toBe("Save $500");
  });

  test("cuts a long title at 40 characters with an ellipsis", () => {
    const long = { title: "a".repeat(60), charm: null, shared: true };
    expect(goalName(long)).toBe(`${"a".repeat(39)}…`);
  });
});

describe("notificationCopy", () => {
  test("every message is titled CoupleGoal", () => {
    expect(notificationCopy({ kind: "partner_joined", actor: "Mia" }, DAY).title).toBe(
      "CoupleGoal",
    );
  });

  test("one shared paw", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [run] }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: `paws-${DAY}`,
    });
  });

  test("one own paw has no pronoun", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [read] }, DAY).body).toBe(
      "Mia pawed 📚 Read 20 pages",
    );
  });

  test("two paws name both", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read] }, DAY).body).toBe(
      "Mia pawed 2 goals: Morning run and Read 20 pages",
    );
  });

  test("three paws name all three", () => {
    expect(
      notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read, save] }, DAY).body,
    ).toBe("Mia pawed 3 goals: Morning run, Read 20 pages and Save $500");
  });

  test("more than three paws name two and count the rest", () => {
    const extra = { title: "Stretch", charm: null, shared: true };
    const more = { title: "Water", charm: null, shared: true };
    expect(
      notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read, extra, more] }, DAY).body,
    ).toBe("Mia pawed 4 goals: Morning run, Read 20 pages and 2 more");
  });

  test("a shared milestone celebrates both of you", () => {
    expect(notificationCopy({ kind: "milestone_done", actor: "Mia", goal: save }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "You two finished Save $500! 🎉",
      url: "/goals",
      tag: `milestone_done-${DAY}`,
    });
  });

  test("an own milestone names the actor", () => {
    const own = { ...save, shared: false };
    expect(notificationCopy({ kind: "milestone_done", actor: "Mia", goal: own }, DAY).body).toBe(
      "Mia finished Save $500! 🎉",
    );
  });

  test("heart", () => {
    expect(notificationCopy({ kind: "heart", actor: "Mia", goal: run }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia ❤️ your 🏃 Morning run paw",
      url: "/den",
      tag: `heart-${DAY}`,
    });
  });

  test("seal", () => {
    expect(notificationCopy({ kind: "seal", actor: "Mia", goal: run }, DAY).body).toBe(
      "Mia sealed 🏃 Morning run",
    );
  });

  test("goal added, shared and own", () => {
    expect(notificationCopy({ kind: "goal_added", actor: "Mia", goal: run }, DAY).body).toBe(
      "Mia added 🏃 Morning run for you both",
    );
    expect(notificationCopy({ kind: "goal_added", actor: "Mia", goal: read }, DAY).body).toBe(
      "Mia added 📚 Read 20 pages",
    );
  });

  test("goal archived uses the app's own words", () => {
    expect(notificationCopy({ kind: "goal_archived", actor: "Mia", goal: run }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia tucked away 🏃 Morning run",
      url: "/goals",
      tag: `goal_archived-${DAY}`,
    });
  });

  test("partner joined", () => {
    expect(notificationCopy({ kind: "partner_joined", actor: "Mia" }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia joined your den 🐶",
      url: "/den",
      tag: `partner_joined-${DAY}`,
    });
  });

  test("reminder, one and many", () => {
    expect(notificationCopy({ kind: "reminder", open: 1 }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Today's paw is waiting — 1 left",
      url: "/den",
      tag: `reminder-${DAY}`,
    });
    expect(notificationCopy({ kind: "reminder", open: 3 }, DAY).body).toBe(
      "Today's paws are waiting — 3 left",
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/notification-copy.test.ts`
Expected: FAIL — cannot resolve `./notification-copy.ts`.

- [ ] **Step 4: Write the implementation**

`supabase/functions/_shared/notification-copy.ts`:

```ts
// The words on the lock screen. Pure: no Deno, no Supabase, so vitest covers every line.
// Copy never genders anyone — the app is for any two people.

export type NotificationKind =
  | "paw_shared"
  | "paw_own"
  | "milestone_done"
  | "heart"
  | "seal"
  | "goal_added"
  | "goal_archived"
  | "partner_joined"
  | "reminder";

export interface GoalRef {
  title: string;
  charm: string | null;
  shared: boolean;
}

export type CopyInput =
  | { kind: "paws"; actor: string; goals: GoalRef[] }
  | { kind: "milestone_done"; actor: string; goal: GoalRef }
  | { kind: "heart"; actor: string; goal: GoalRef }
  | { kind: "seal"; actor: string; goal: GoalRef }
  | { kind: "goal_added"; actor: string; goal: GoalRef }
  | { kind: "goal_archived"; actor: string; goal: GoalRef }
  | { kind: "partner_joined"; actor: string }
  | { kind: "reminder"; open: number };

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const TITLE = "CoupleGoal";
const MAX_TITLE = 40;

function clip(title: string): string {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;
}

export function goalName(goal: GoalRef): string {
  return goal.charm ? `${goal.charm} ${clip(goal.title)}` : clip(goal.title);
}

function forBoth(goal: GoalRef): string {
  return goal.shared ? " for you both" : "";
}

function pawsBody(actor: string, goals: GoalRef[]): string {
  const [first, second, third] = goals;
  if (!first) {
    return `${actor} pawed a goal`;
  }
  if (!second) {
    return `${actor} pawed ${goalName(first)}${forBoth(first)}`;
  }
  const titles = goals.map((g) => clip(g.title));
  if (goals.length === 2) {
    return `${actor} pawed 2 goals: ${titles[0]} and ${titles[1]}`;
  }
  if (goals.length === 3 && third) {
    return `${actor} pawed 3 goals: ${titles[0]}, ${titles[1]} and ${titles[2]}`;
  }
  return `${actor} pawed ${goals.length} goals: ${titles[0]}, ${titles[1]} and ${goals.length - 2} more`;
}

export function notificationCopy(input: CopyInput, localDay: string): PushMessage {
  const message = (body: string, url: string, group: string): PushMessage => ({
    title: TITLE,
    body,
    url,
    tag: `${group}-${localDay}`,
  });
  switch (input.kind) {
    case "paws":
      return message(pawsBody(input.actor, input.goals), "/den", "paws");
    case "milestone_done":
      return message(
        input.goal.shared
          ? `You two finished ${goalName(input.goal)}! 🎉`
          : `${input.actor} finished ${goalName(input.goal)}! 🎉`,
        "/goals",
        input.kind,
      );
    case "heart":
      return message(`${input.actor} ❤️ your ${goalName(input.goal)} paw`, "/den", input.kind);
    case "seal":
      return message(`${input.actor} sealed ${goalName(input.goal)}`, "/goals", input.kind);
    case "goal_added":
      return message(
        `${input.actor} added ${goalName(input.goal)}${forBoth(input.goal)}`,
        "/goals",
        input.kind,
      );
    case "goal_archived":
      return message(`${input.actor} tucked away ${goalName(input.goal)}`, "/goals", input.kind);
    case "partner_joined":
      return message(`${input.actor} joined your den 🐶`, "/den", input.kind);
    case "reminder":
      return message(
        input.open === 1
          ? "Today's paw is waiting — 1 left"
          : `Today's paws are waiting — ${input.open} left`,
        "/den",
        input.kind,
      );
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/notification-copy.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add vitest.config.ts supabase/functions/_shared/
git commit -m "Write the words a partner's paw puts on the lock screen"
```

---

### Task 2: Delivery planner

**Files:**
- Create: `supabase/functions/send-push/plan.ts`
- Test: `supabase/functions/send-push/plan.test.ts`

**Interfaces:**
- Consumes: `notificationCopy`, `NotificationKind`, `GoalRef`, `PushMessage` from `../_shared/notification-copy.ts` (Task 1).
- Produces:
  - `interface OutboxRow { id: string; recipient_id: string; actor_id: string | null; kind: NotificationKind; goal_id: string | null; attempts: number }`
  - `interface PlanContext { names: Map<string, string>; goals: Map<string, { title: string; charm: string | null; owner_id: string | null }>; prefs: Map<string, { timezone: string; muted: NotificationKind[] }>; openGoals: Map<string, number>; now: Date }`
  - `interface Delivery { recipientId: string; rowIds: string[]; message: PushMessage; ttlSeconds: number }`
  - `interface Skip { id: string; reason: "muted" | "nothing open" | "missing goal" }`
  - `planDeliveries(rows: OutboxRow[], ctx: PlanContext): { deliveries: Delivery[]; skips: Skip[] }`
  - `localDay(timezone: string, now: Date): string` — `YYYY-MM-DD` in that zone, UTC if the zone is unknown.
  - `type Settlement = "sent" | "no-devices" | "retry" | "give-up"`
  - `settle(statuses: number[], attempts: number): Settlement` — `statuses` are the push service's HTTP codes per device (`0` for a network error).
  - `isGone(status: number): boolean` — 404 or 410.
  - `const MAX_ATTEMPTS = 5`, `const TTL_SECONDS = 43_200`, `const REMINDER_TTL_SECONDS = 7_200`

- [ ] **Step 1: Write the failing tests**

`supabase/functions/send-push/plan.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  isGone,
  localDay,
  type OutboxRow,
  type PlanContext,
  planDeliveries,
  settle,
} from "./plan.ts";

const ARI = "a0000000-0000-4000-8000-00000000000a";
const MIA = "b0000000-0000-4000-8000-00000000000b";
const RUN = "c1000000-0000-4000-8000-000000000001";
const READ = "c1000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-03T09:00:00Z");

function row(over: Partial<OutboxRow>): OutboxRow {
  return {
    id: crypto.randomUUID(),
    recipient_id: ARI,
    actor_id: MIA,
    kind: "paw_shared",
    goal_id: RUN,
    attempts: 1,
    ...over,
  };
}

function ctx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    names: new Map([
      [ARI, "Ari"],
      [MIA, "Mia"],
    ]),
    goals: new Map([
      [RUN, { title: "Morning run", charm: "🏃", owner_id: null }],
      [READ, { title: "Read 20 pages", charm: "📚", owner_id: MIA }],
    ]),
    prefs: new Map([[ARI, { timezone: "Australia/Sydney", muted: [] }]]),
    openGoals: new Map(),
    now: NOW,
    ...over,
  };
}

describe("localDay", () => {
  test("uses the member's own calendar", () => {
    expect(localDay("Australia/Sydney", new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-04");
    expect(localDay("America/Los_Angeles", new Date("2026-10-03T05:00:00Z"))).toBe("2026-10-02");
  });

  test("falls back to UTC for a zone it does not know", () => {
    expect(localDay("Mars/Olympus", new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-03");
  });
});

describe("planDeliveries", () => {
  test("merges a recipient's shared and own paws into one delivery", () => {
    const a = row({ kind: "paw_shared", goal_id: RUN });
    const b = row({ kind: "paw_own", goal_id: READ });
    const { deliveries, skips } = planDeliveries([a, b], ctx());
    expect(skips).toEqual([]);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.rowIds.sort()).toEqual([a.id, b.id].sort());
    expect(deliveries[0]?.message.body).toBe(
      "Mia pawed 2 goals: Morning run and Read 20 pages",
    );
    expect(deliveries[0]?.message.tag).toBe("paws-2026-10-03");
    expect(deliveries[0]?.ttlSeconds).toBe(43_200);
  });

  test("the same goal pawed twice in a batch is named once", () => {
    const a = row({ goal_id: RUN });
    const b = row({ goal_id: RUN });
    const { deliveries } = planDeliveries([a, b], ctx());
    expect(deliveries[0]?.message.body).toBe("Mia pawed 🏃 Morning run for you both");
    expect(deliveries[0]?.rowIds).toHaveLength(2);
  });

  test("a muted kind is skipped, an unmuted one in the same batch still goes", () => {
    const a = row({ kind: "paw_own", goal_id: READ });
    const b = row({ kind: "paw_shared", goal_id: RUN });
    const prefs = new Map([[ARI, { timezone: "UTC", muted: ["paw_own" as const] }]]);
    const { deliveries, skips } = planDeliveries([a, b], ctx({ prefs }));
    expect(skips).toEqual([{ id: a.id, reason: "muted" }]);
    expect(deliveries[0]?.rowIds).toEqual([b.id]);
  });

  test("each non-paw row is its own delivery", () => {
    const heart = row({ kind: "heart", goal_id: RUN });
    const seal = row({ kind: "seal", goal_id: RUN });
    const { deliveries } = planDeliveries([heart, seal], ctx());
    expect(deliveries.map((d) => d.message.body)).toEqual([
      "Mia ❤️ your 🏃 Morning run paw",
      "Mia sealed 🏃 Morning run",
    ]);
  });

  test("a milestone on an own goal names the actor", () => {
    const done = row({ kind: "milestone_done", goal_id: READ });
    expect(planDeliveries([done], ctx()).deliveries[0]?.message.body).toBe(
      "Mia finished 📚 Read 20 pages! 🎉",
    );
  });

  test("an actor with no member row is 'Your partner'", () => {
    const joined = row({ kind: "partner_joined", goal_id: null, actor_id: "gone" });
    expect(planDeliveries([joined], ctx()).deliveries[0]?.message.body).toBe(
      "Your partner joined your den 🐶",
    );
  });

  test("a goal that vanished is skipped, not sent blank", () => {
    const lost = row({ kind: "seal", goal_id: "missing" });
    expect(planDeliveries([lost], ctx()).skips).toEqual([{ id: lost.id, reason: "missing goal" }]);
  });

  test("a reminder with paws left goes with a short TTL", () => {
    const r = row({ kind: "reminder", actor_id: null, goal_id: null });
    const { deliveries } = planDeliveries([r], ctx({ openGoals: new Map([[ARI, 2]]) }));
    expect(deliveries[0]?.message.body).toBe("Today's paws are waiting — 2 left");
    expect(deliveries[0]?.ttlSeconds).toBe(7_200);
  });

  test("a reminder with nothing open any more is skipped", () => {
    const r = row({ kind: "reminder", actor_id: null, goal_id: null });
    expect(planDeliveries([r], ctx({ openGoals: new Map([[ARI, 0]]) })).skips).toEqual([
      { id: r.id, reason: "nothing open" },
    ]);
  });

  test("a recipient with no prefs row is treated as UTC with nothing muted", () => {
    const r = row({ recipient_id: MIA, actor_id: ARI, kind: "heart", goal_id: RUN });
    const { deliveries } = planDeliveries([r], ctx());
    expect(deliveries[0]?.message.body).toBe("Ari ❤️ your 🏃 Morning run paw");
    expect(deliveries[0]?.message.tag).toBe("heart-2026-10-03");
  });
});

describe("settle", () => {
  test("any 2xx device means sent", () => {
    expect(settle([410, 201], 1)).toBe("sent");
  });

  test("every device gone means no devices", () => {
    expect(settle([404, 410], 1)).toBe("no-devices");
    expect(settle([], 1)).toBe("no-devices");
  });

  test("a transient failure retries until the fifth attempt", () => {
    expect(settle([503], 4)).toBe("retry");
    expect(settle([0, 410], 4)).toBe("retry");
    expect(settle([429], 5)).toBe("give-up");
  });

  test("isGone", () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    expect(isGone(500)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/send-push/plan.test.ts`
Expected: FAIL — cannot resolve `./plan.ts`.

- [ ] **Step 3: Write the implementation**

`supabase/functions/send-push/plan.ts`:

```ts
// Turns claimed outbox rows into deliveries. Pure, so vitest covers grouping, muting and
// retry rules without a database or a push service.
import {
  type CopyInput,
  type GoalRef,
  type NotificationKind,
  notificationCopy,
  type PushMessage,
} from "../_shared/notification-copy.ts";

export const MAX_ATTEMPTS = 5;
export const TTL_SECONDS = 43_200;
export const REMINDER_TTL_SECONDS = 7_200;

export interface OutboxRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  goal_id: string | null;
  attempts: number;
}

export interface PlanContext {
  names: Map<string, string>;
  goals: Map<string, { title: string; charm: string | null; owner_id: string | null }>;
  prefs: Map<string, { timezone: string; muted: NotificationKind[] }>;
  openGoals: Map<string, number>;
  now: Date;
}

export interface Delivery {
  recipientId: string;
  rowIds: string[];
  message: PushMessage;
  ttlSeconds: number;
}

export interface Skip {
  id: string;
  reason: "muted" | "nothing open" | "missing goal";
}

export type Settlement = "sent" | "no-devices" | "retry" | "give-up";

const PAWS: NotificationKind[] = ["paw_shared", "paw_own"];

export function localDay(timezone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

export function settle(statuses: number[], attempts: number): Settlement {
  if (statuses.some((s) => s >= 200 && s < 300)) {
    return "sent";
  }
  if (statuses.every(isGone)) {
    return "no-devices";
  }
  return attempts >= MAX_ATTEMPTS ? "give-up" : "retry";
}

export function planDeliveries(
  rows: OutboxRow[],
  ctx: PlanContext,
): { deliveries: Delivery[]; skips: Skip[] } {
  const deliveries: Delivery[] = [];
  const skips: Skip[] = [];
  const paws = new Map<string, OutboxRow[]>();

  const goalRef = (id: string | null): GoalRef | null => {
    const goal = id ? ctx.goals.get(id) : undefined;
    return goal ? { title: goal.title, charm: goal.charm, shared: goal.owner_id === null } : null;
  };
  const actorName = (id: string | null) => (id && ctx.names.get(id)) || "Your partner";
  const dayFor = (recipient: string) =>
    localDay(ctx.prefs.get(recipient)?.timezone ?? "UTC", ctx.now);

  for (const r of rows) {
    if (ctx.prefs.get(r.recipient_id)?.muted.includes(r.kind)) {
      skips.push({ id: r.id, reason: "muted" });
      continue;
    }
    if (PAWS.includes(r.kind)) {
      const list = paws.get(r.recipient_id) ?? [];
      list.push(r);
      paws.set(r.recipient_id, list);
      continue;
    }
    const day = dayFor(r.recipient_id);
    let input: CopyInput;
    if (r.kind === "reminder") {
      const open = ctx.openGoals.get(r.recipient_id) ?? 0;
      if (open === 0) {
        skips.push({ id: r.id, reason: "nothing open" });
        continue;
      }
      input = { kind: "reminder", open };
    } else if (r.kind === "partner_joined") {
      input = { kind: "partner_joined", actor: actorName(r.actor_id) };
    } else {
      const goal = goalRef(r.goal_id);
      if (!goal) {
        skips.push({ id: r.id, reason: "missing goal" });
        continue;
      }
      input = { kind: r.kind, actor: actorName(r.actor_id), goal };
    }
    deliveries.push({
      recipientId: r.recipient_id,
      rowIds: [r.id],
      message: notificationCopy(input, day),
      ttlSeconds: r.kind === "reminder" ? REMINDER_TTL_SECONDS : TTL_SECONDS,
    });
  }

  for (const [recipient, list] of paws) {
    const seen = new Set<string>();
    const goals: GoalRef[] = [];
    for (const r of list) {
      const goal = goalRef(r.goal_id);
      if (goal && r.goal_id && !seen.has(r.goal_id)) {
        seen.add(r.goal_id);
        goals.push(goal);
      }
    }
    if (goals.length === 0) {
      for (const r of list) {
        skips.push({ id: r.id, reason: "missing goal" });
      }
      continue;
    }
    const first = list[0];
    deliveries.push({
      recipientId: recipient,
      rowIds: list.map((r) => r.id),
      message: notificationCopy(
        { kind: "paws", actor: actorName(first?.actor_id ?? null), goals },
        dayFor(recipient),
      ),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return { deliveries, skips };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/send-push/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add supabase/functions/send-push/plan.ts supabase/functions/send-push/plan.test.ts
git commit -m "Group a batch of paws into one buzz, and know when to give up"
```

---

### Task 3: Subscriptions, preferences and the outbox (migration 0011)

**Files:**
- Create: `supabase/migrations/0011_notifications.sql`
- Modify: `scripts/rls-probe.mjs`
- Modify: `src/lib/database.types.ts` (regenerated, never hand-edited)

**Interfaces:**
- Consumes: `auth.users`, `public.members`.
- Produces:
  - enum `public.notification_kind`
  - tables `public.push_subscriptions`, `public.notification_prefs`, `public.notification_outbox` (columns exactly as below)
  - RPC `public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_timezone text) returns void` — executable by `authenticated`
  - Generated types: `Tables<"notification_prefs">`, `Enums<"notification_kind">`, `Database["public"]["Functions"]["save_push_subscription"]`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0011_notifications.sql`:

```sql
-- Push notifications, part 1: which devices to reach, what each person wants, and the
-- queue the triggers in 0012 fill. Clients never touch the queue.

create type public.notification_kind as enum (
  'paw_shared', 'paw_own', 'milestone_done', 'heart', 'seal',
  'goal_added', 'goal_archived', 'partner_joined', 'reminder'
);

-- One row per installed device. An endpoint belongs to whoever saved it last: a phone
-- that changes hands between partners must stop buzzing for the first one.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  remind_at time not null default '20:00',
  muted public.notification_kind[] not null default '{}',
  last_reminded_on date
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind public.notification_kind not null,
  goal_id uuid references public.goals (id) on delete set null,
  -- No foreign key: deleting a check-in cancels its rows (0012) instead of erasing them.
  checkin_id uuid,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index notification_outbox_due_idx on public.notification_outbox (send_after)
  where sent_at is null and cancelled_at is null;
create index notification_outbox_checkin_idx on public.notification_outbox (checkin_id)
  where checkin_id is not null;

-- A time zone the database cannot name would make every reminder query throw.
create or replace function public.notification_prefs_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'We don''t know that time zone.';
  end if;
  return new;
end
$$;
revoke execute on function public.notification_prefs_validate() from public, anon, authenticated;
create trigger notification_prefs_validate before insert or update of timezone
  on public.notification_prefs
  for each row execute function public.notification_prefs_validate();

alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_outbox enable row level security;

-- Devices: see and forget your own. Saving goes through save_push_subscription.
create policy "own devices read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own devices forget" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

-- Prefs: private to their owner. last_reminded_on is the server's alone.
create policy "own prefs read" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs update" on public.notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_prefs from anon;
revoke insert, update, delete on public.notification_prefs from authenticated;
grant update (timezone, remind_at, muted) on public.notification_prefs to authenticated;

-- The queue: no policies, no grants. Triggers, cron and send-push only.
revoke all on public.notification_outbox from anon, authenticated;

-- Upserts on endpoint and hands the device to the caller. Also makes sure the caller has
-- a prefs row, falling back to UTC for a zone the database doesn't know.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_timezone text
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  zone text;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' then
    raise exception 'This phone didn''t give us anywhere to send notifications. Try again?';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        last_ok_at = null;
  select name into zone from pg_catalog.pg_timezone_names where name = p_timezone;
  insert into public.notification_prefs (user_id, timezone)
  values (uid, coalesce(zone, 'UTC'))
  on conflict (user_id) do update set timezone = excluded.timezone;
end
$$;
revoke execute on function public.save_push_subscription(text, text, text, text, text)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text)
  to authenticated;
```

- [ ] **Step 2: Extend the RLS probe (it fails until the migration is applied)**

Replace `scripts/rls-probe.mjs` with:

```js
// Signed out, the publishable key must see nothing in any couple table and
// exactly one keepalive row. Rows back from a couple table means RLS is off.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!(url && key)) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/rls-probe.mjs");
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["couples", "members", "goals", "goal_seals", "checkins", "reactions"];
let failed = false;
for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers });
  const body = await res.json();
  const ok = res.ok && Array.isArray(body) && body.length === 0;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${table}: ${res.status} ${Array.isArray(body) ? `${body.length} rows` : JSON.stringify(body)}`,
  );
  failed ||= !ok;
}
// Notification tables grant nothing to anon: refused outright, or at worst empty.
const locked = ["push_subscriptions", "notification_prefs", "notification_outbox"];
for (const table of locked) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers });
  const body = await res.json();
  const ok = !res.ok || (Array.isArray(body) && body.length === 0);
  console.log(`${ok ? "ok  " : "FAIL"} ${table} refused signed-out: ${res.status}`);
  failed ||= !ok;
}
const ping = await fetch(`${url}/rest/v1/keepalive?select=id`, { headers });
const rows = await ping.json();
const pingOk = ping.ok && Array.isArray(rows) && rows.length === 1;
console.log(`${pingOk ? "ok  " : "FAIL"} keepalive: ${ping.status}`);
failed ||= !pingOk;
const rpcs = {
  mint_invite_code: {},
  save_push_subscription: {
    p_endpoint: "https://push.example.invalid/probe",
    p_p256dh: "x",
    p_auth: "x",
    p_user_agent: "probe",
    p_timezone: "UTC",
  },
  claim_due_notifications: {},
  enqueue_reminders: {},
};
for (const [name, args] of Object.entries(rpcs)) {
  const rpc = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const rpcOk = !rpc.ok;
  console.log(`${rpcOk ? "ok  " : "FAIL"} ${name} refused signed-out: ${rpc.status}`);
  failed ||= !rpcOk;
}
process.exit(failed ? 1 : 0);
```

(`claim_due_notifications` and `enqueue_reminders` arrive in Task 4; until then PostgREST answers 404, which also counts as refused.)

- [ ] **Step 3: Apply the migration**

Supabase MCP `apply_migration` with project `uosxptayqdetgbyercqt`, name `0011_notifications`, query = the file contents.
Expected: success.

- [ ] **Step 4: Verify with SQL**

Supabase MCP `execute_sql`:

```sql
begin;
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'ari.notify-test@example.invalid'),
  ('b0000000-0000-4000-8000-00000000000b', 'mia.notify-test@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.save_push_subscription('https://push.example.invalid/shared-phone', 'k', 'a', 'test', 'Australia/Sydney');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.save_push_subscription('https://push.example.invalid/shared-phone', 'k2', 'a2', 'test', 'Mars/Olympus');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, 'Mia sees the phone she just saved';
  perform 1 from public.notification_outbox;
  raise exception 'Mia could read the outbox';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.notification_prefs set last_reminded_on = current_date;
  raise exception 'Mia could write last_reminded_on';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$ begin
  assert (select user_id from public.push_subscriptions where endpoint = 'https://push.example.invalid/shared-phone')
    = 'b0000000-0000-4000-8000-00000000000b', 'the phone moved to Mia';
  assert (select count(*) from public.push_subscriptions where endpoint = 'https://push.example.invalid/shared-phone') = 1,
    'one row per phone';
  assert (select timezone from public.notification_prefs where user_id = 'b0000000-0000-4000-8000-00000000000b') = 'UTC',
    'an unknown zone falls back to UTC';
  assert (select timezone from public.notification_prefs where user_id = 'a0000000-0000-4000-8000-00000000000a') = 'Australia/Sydney',
    'Ari keeps Sydney';
end $$;
select 'all good' as result;
rollback;
```

Expected: one row, `all good`. Any failed `assert` aborts with its message — fix the migration, apply a corrected version, and re-run.

- [ ] **Step 5: Regenerate types**

Supabase MCP `generate_typescript_types` for `uosxptayqdetgbyercqt`; write the output verbatim to `src/lib/database.types.ts`.
Run: `grep -c "notification_prefs\|save_push_subscription\|notification_kind" src/lib/database.types.ts`
Expected: a count of at least 3.

- [ ] **Step 6: Advisors and probe**

Supabase MCP `get_advisors` (type `security`). Expected: nothing new about `push_subscriptions`, `notification_prefs`, `notification_outbox` or `save_push_subscription`. ("RLS enabled, no policy" on `notification_outbox` is **intended**: say so in the commit message.)

Ask the owner to run `! node --env-file=.env.local scripts/rls-probe.mjs` (the agent never reads `.env.local`). Expected: every line `ok`.

- [ ] **Step 7: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add supabase/migrations/0011_notifications.sql scripts/rls-probe.mjs src/lib/database.types.ts
git commit -m "Keep a private list of phones to buzz, and a queue only the server reads

The outbox has RLS on and no policies on purpose: clients never see it."
```

---

### Task 4: Triggers, reminders and claiming (migration 0012)

**Files:**
- Create: `supabase/migrations/0012_notification_triggers.sql`
- Create: `supabase/tests/notifications.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Consumes: Task 3's tables and enum; `public.period_range(text) returns daterange`; `public.members`, `public.goals`, `public.checkins`, `public.reactions`, `public.goal_seals`.
- Produces:
  - `public.enqueue_notification(p_couple uuid, p_actor uuid, p_kind public.notification_kind, p_goal uuid, p_checkin uuid, p_delay interval) returns void`
  - `public.open_goals_for(p_user uuid, p_day date) returns int` — executable by `service_role`
  - `public.claim_due_notifications(p_limit int default 100) returns setof public.notification_outbox` — executable by `service_role`
  - `public.enqueue_reminders(p_now timestamptz default now()) returns int` — number queued
  - `public.prune_notifications() returns void`
  - Triggers `notify_checkin_insert`, `notify_checkin_delete`, `notify_reaction`, `notify_seal`, `notify_goal_added`, `notify_goal_archived`, `notify_member_joined`

- [ ] **Step 1: Write the scenario script (the failing test)**

`supabase/tests/notifications.sql`:

```sql
-- Notification scenarios against the real schema. Run the whole file in one
-- execute_sql call: it ends in rollback, so nothing persists. Each assert aborts with
-- its message on failure. Ari = a…a, Mia = b…b. `now()` is fixed for a transaction,
-- so "30 seconds later" is exactly now() + 30 s.
begin;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'ari.notify-test@example.invalid'),
  ('b0000000-0000-4000-8000-00000000000b', 'mia.notify-test@example.invalid');

-- Ari makes a den, alone: nobody to tell.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select * from public.create_den('Ari', 'rose');
reset role;
select set_config('test.couple', (select couple_id::text from public.members where user_id = 'a0000000-0000-4000-8000-00000000000a'), true);
select set_config('test.code', (select invite_code from public.couples where id = current_setting('test.couple')::uuid), true);
do $$ begin
  assert (select count(*) from public.notification_outbox where couple_id = current_setting('test.couple')::uuid) = 0,
    'a den of one queues nothing';
end $$;

-- Mia joins: Ari hears about it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.join_den(current_setting('test.code'), 'Mia', 'teal');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'partner_joined' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and actor_id = 'b0000000-0000-4000-8000-00000000000b' and send_after = now()) = 1,
    'Ari hears that Mia joined, straight away';
end $$;

-- Ari adds five goals. Mia hears about each; Ari's own autoseal is not news.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.goals (id, couple_id, title, charm, horizon, owner_id, period, target_units, created_by) values
  ('c1000000-0000-4000-8000-000000000001', public.my_couple_id(), 'Morning run', '🏃', 'day', null, null, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000002', public.my_couple_id(), 'Read 20 pages', '📚', 'day', 'a0000000-0000-4000-8000-00000000000a', null, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000003', public.my_couple_id(), 'Save $500', null, 'month', null, to_char(current_date, 'YYYY-MM'), 2, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000004', public.my_couple_id(), 'Call the vet', null, 'day', null, current_date::text, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000005', public.my_couple_id(), 'Pack', null, 'day', null, (current_date + 1)::text, null, 'a0000000-0000-4000-8000-00000000000a');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'goal_added' and recipient_id = 'b0000000-0000-4000-8000-00000000000b') = 5,
    'Mia hears about five new goals';
  assert (select count(*) from public.notification_outbox
          where kind = 'seal' and couple_id = current_setting('test.couple')::uuid) = 0,
    'the creator''s automatic seal is not news';
end $$;

-- Mia seals the run: Ari hears.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.goal_seals (goal_id, user_id, couple_id)
  values ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', public.my_couple_id());

-- Mia paws the shared run, then thinks better of it.
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000001', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', current_date, 'day');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'seal' and recipient_id = 'a0000000-0000-4000-8000-00000000000a') = 1,
    'Ari hears that Mia sealed the run';
  assert (select count(*) from public.notification_outbox
          where kind = 'paw_shared' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and checkin_id = 'd1000000-0000-4000-8000-000000000001'
            and send_after = now() + interval '30 seconds') = 1,
    'a shared paw waits 30 seconds';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
delete from public.checkins where id = 'd1000000-0000-4000-8000-000000000001';
reset role;
do $$ begin
  assert (select cancelled_at from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000001') is not null,
    'undoing the paw cancels its notification';
end $$;

-- Ari paws his own book: Mia hears it as an own paw.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000002', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', current_date, 'day');
-- Milestone, target 2: Ari's paw is the first.
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000003', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', current_date, 'month');
reset role;
do $$ begin
  assert (select kind from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000002') = 'paw_own',
    'a paw on your own goal is paw_own';
  assert (select count(*) from public.notification_outbox
          where kind = 'milestone_done' and couple_id = current_setting('test.couple')::uuid) = 0,
    'one of two paws is not a finish';
end $$;

-- Mia's paw reaches the target: Ari gets a paw and a celebration on the same check-in.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000004', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b', current_date, 'month');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000004'
            and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and kind in ('paw_shared', 'milestone_done')) = 2,
    'the finishing paw queues a paw and a milestone';
end $$;

-- Ari hearts Mia's finishing paw: Mia hears.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.reactions (checkin_id, user_id, couple_id)
  values ('d1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', public.my_couple_id());
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'heart' and recipient_id = 'b0000000-0000-4000-8000-00000000000b'
            and goal_id = 'c1000000-0000-4000-8000-000000000003') = 1,
    'Mia hears about the heart';
end $$;

-- Mia undoes the finishing paw: both its paw and its celebration are cancelled.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
delete from public.checkins where id = 'd1000000-0000-4000-8000-000000000004';
-- Mia tucks tomorrow's packing away: Ari hears.
update public.goals set archived_at = now() where id = 'c1000000-0000-4000-8000-000000000005';
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000004' and cancelled_at is null
            and kind in ('paw_shared', 'milestone_done')) = 0,
    'undoing the finishing paw cancels the celebration too';
  assert (select count(*) from public.notification_outbox
          where kind = 'goal_archived' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and actor_id = 'b0000000-0000-4000-8000-00000000000b') = 1,
    'Ari hears that Mia tucked a goal away';
end $$;

-- Open goals today. Ari: run (open), book (pawed), vet (today, open) = 2.
-- Mia: run (paw undone, open), vet (open); Ari's book is not hers = 2.
-- Tomorrow for Ari: run only (vet is today's, packing is archived) = 1.
do $$ begin
  assert public.open_goals_for('a0000000-0000-4000-8000-00000000000a', current_date) = 2, 'Ari has 2 open';
  assert public.open_goals_for('b0000000-0000-4000-8000-00000000000b', current_date) = 2, 'Mia has 2 open';
  assert public.open_goals_for('a0000000-0000-4000-8000-00000000000a', current_date + 1) = 1, 'Ari has 1 open tomorrow';
end $$;

-- Claiming: every due row in this den once (paws wait 30 s, so they are not due yet).
create temporary table claimed on commit drop as
  select * from public.claim_due_notifications(1000) where couple_id = current_setting('test.couple')::uuid;
do $$ begin
  assert (select count(*) from claimed) = (
    select count(*) from public.notification_outbox
    where couple_id = current_setting('test.couple')::uuid and cancelled_at is null and send_after <= now()),
    'every due row is claimed';
  assert not exists (select 1 from claimed where kind in ('paw_shared', 'paw_own', 'milestone_done')),
    'paws are not due inside their 30 seconds';
  assert (select bool_and(attempts = 1 and claimed_at = now()) from claimed), 'claiming counts an attempt';
  assert (select count(*) from public.claim_due_notifications(1000)
          where couple_id = current_setting('test.couple')::uuid) = 0,
    'a claimed row is not claimed twice';
end $$;

-- Reminders. Ari has a phone and lives in Sydney; Mia has no phone. Counts are read
-- from this den's rows, never from enqueue_reminders' return value, so real members
-- with notifications on can't disturb the result.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('a0000000-0000-4000-8000-00000000000a', 'https://push.example.invalid/ari', 'k', 'a');
insert into public.notification_prefs (user_id, timezone, remind_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'Australia/Sydney', '20:00'),
  ('b0000000-0000-4000-8000-00000000000b', 'Australia/Sydney', '20:00');
create function pg_temp.reminders() returns bigint language sql as $f$
  select count(*) from public.notification_outbox
   where kind = 'reminder' and couple_id = current_setting('test.couple')::uuid
$f$;
do $$ begin
  perform public.enqueue_reminders('2030-01-15 19:55 Australia/Sydney');
  assert pg_temp.reminders() = 0, 'not before remind_at';
  perform public.enqueue_reminders('2030-01-15 20:05 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'reminded at 20:05';
  assert (select recipient_id from public.notification_outbox
          where kind = 'reminder' and couple_id = current_setting('test.couple')::uuid)
    = 'a0000000-0000-4000-8000-00000000000a', 'only Ari: Mia has no phone';
  assert (select last_reminded_on from public.notification_prefs
          where user_id = 'a0000000-0000-4000-8000-00000000000a') = '2030-01-15', 'Sydney''s date is recorded';
  perform public.enqueue_reminders('2030-01-15 20:20 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'once a day';
  perform public.enqueue_reminders('2030-01-16 22:30 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'not after the two-hour window';
end $$;
update public.notification_prefs set remind_at = '23:00' where user_id = 'a0000000-0000-4000-8000-00000000000a';
do $$ begin
  perform public.enqueue_reminders('2030-01-17 23:30 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'a late reminder fires at 23:30';
  perform public.enqueue_reminders('2030-01-18 00:30 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'and not again after midnight';
end $$;
update public.notification_prefs set muted = '{reminder}' where user_id = 'a0000000-0000-4000-8000-00000000000a';
do $$ begin
  perform public.enqueue_reminders('2030-01-19 23:05 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'a muted reminder never queues';
end $$;

-- Clients may not run the server's functions.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  perform public.claim_due_notifications(1);
  raise exception 'a client could claim notifications';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.enqueue_notification(public.my_couple_id(), auth.uid(), 'heart', null, null, interval '0');
  raise exception 'a client could enqueue a notification';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'all good' as result;
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Supabase MCP `execute_sql` with the whole file.
Expected: FAIL — `function public.open_goals_for(...) does not exist` or the first trigger assert (`Ari hears that Mia joined, straight away`).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0012_notification_triggers.sql`:

```sql
-- Push notifications, part 2: triggers fill the outbox; the server claims from it.
-- Every trigger is `after`, so a write that fails validation never queues anything.

-- Queues one row for the other member of the couple. A den of one has nobody to tell;
-- a null actor (no auth.uid()) matches nobody, so server-side writes stay quiet.
create or replace function public.enqueue_notification(
  p_couple uuid, p_actor uuid, p_kind public.notification_kind,
  p_goal uuid, p_checkin uuid, p_delay interval
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox
    (couple_id, recipient_id, actor_id, kind, goal_id, checkin_id, send_after)
  select p_couple, m.user_id, p_actor, p_kind, p_goal, p_checkin, now() + p_delay
    from public.members m
   where m.couple_id = p_couple and m.user_id <> p_actor;
end
$$;
revoke execute on function public.enqueue_notification(uuid, uuid, public.notification_kind, uuid, uuid, interval)
  from public, anon, authenticated;

-- A paw waits 30 s so an undo can cancel it. The paw that brings a milestone's count in
-- its period to exactly target_units also queues the celebration, on the same check-in,
-- so undoing that paw cancels both. The count matches checkins_validate: both partners.
create or replace function public.notify_checkin_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
  stamped int;
begin
  select * into g from public.goals where id = new.goal_id;
  perform public.enqueue_notification(
    new.couple_id, new.user_id,
    case when g.owner_id is null then 'paw_shared' else 'paw_own' end::public.notification_kind,
    new.goal_id, new.id, interval '30 seconds');
  if g.horizon <> 'day' then
    select count(*) into stamped
      from public.checkins
     where goal_id = g.id and public.period_range(g.period) @> day;
    if stamped = g.target_units then
      perform public.enqueue_notification(
        new.couple_id, new.user_id, 'milestone_done', new.goal_id, new.id, interval '30 seconds');
    end if;
  end if;
  return null;
end
$$;
create trigger notify_checkin_insert after insert on public.checkins
  for each row execute function public.notify_checkin_insert();

create or replace function public.notify_checkin_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
     set cancelled_at = now()
   where checkin_id = old.id and sent_at is null and cancelled_at is null;
  return null;
end
$$;
create trigger notify_checkin_delete after delete on public.checkins
  for each row execute function public.notify_checkin_delete();

-- reactions_validate already refuses a heart on your own paw; the check here is belt
-- and braces so a future rule change can't buzz someone about themselves.
create or replace function public.notify_reaction()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.checkins;
begin
  select * into c from public.checkins where id = new.checkin_id;
  if c.user_id is not null and c.user_id <> new.user_id then
    perform public.enqueue_notification(
      new.couple_id, new.user_id, 'heart', c.goal_id, new.checkin_id, interval '0');
  end if;
  return null;
end
$$;
create trigger notify_reaction after insert on public.reactions
  for each row execute function public.notify_reaction();

-- goals_autoseal seals for the creator; that is not news. Only a seal by the other
-- partner on a goal the recipient created is.
create or replace function public.notify_seal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  creator uuid;
begin
  select created_by into creator from public.goals where id = new.goal_id;
  if creator is not null and creator <> new.user_id then
    perform public.enqueue_notification(
      new.couple_id, new.user_id, 'seal', new.goal_id, null, interval '0');
  end if;
  return null;
end
$$;
create trigger notify_seal after insert on public.goal_seals
  for each row execute function public.notify_seal();

create or replace function public.notify_goal_added()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, new.created_by, 'goal_added', new.id, null, interval '0');
  return null;
end
$$;
create trigger notify_goal_added after insert on public.goals
  for each row execute function public.notify_goal_added();

create or replace function public.notify_goal_archived()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, auth.uid(), 'goal_archived', new.id, null, interval '0');
  return null;
end
$$;
create trigger notify_goal_archived after update of archived_at on public.goals
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function public.notify_goal_archived();

create or replace function public.notify_member_joined()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, new.user_id, 'partner_joined', null, null, interval '0');
  return null;
end
$$;
create trigger notify_member_joined after insert on public.members
  for each row execute function public.notify_member_joined();

revoke execute on function public.notify_checkin_insert() from public, anon, authenticated;
revoke execute on function public.notify_checkin_delete() from public, anon, authenticated;
revoke execute on function public.notify_reaction() from public, anon, authenticated;
revoke execute on function public.notify_seal() from public, anon, authenticated;
revoke execute on function public.notify_goal_added() from public, anon, authenticated;
revoke execute on function public.notify_goal_archived() from public, anon, authenticated;
revoke execute on function public.notify_member_joined() from public, anon, authenticated;

-- Day goals still waiting for p_user's paw on p_day: their own or shared, not archived,
-- a habit or a one-off for that day. Milestones never count.
create or replace function public.open_goals_for(p_user uuid, p_day date)
returns int
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int
    from public.goals g
    join public.members m on m.couple_id = g.couple_id and m.user_id = p_user
   where g.horizon = 'day'
     and g.archived_at is null
     and (g.owner_id is null or g.owner_id = p_user)
     and (g.period is null or g.period = p_day::text)
     and not exists (
       select 1 from public.checkins c
        where c.goal_id = g.id and c.user_id = p_user and c.day = p_day)
$$;
revoke execute on function public.open_goals_for(uuid, date) from public, anon, authenticated;
grant execute on function public.open_goals_for(uuid, date) to service_role;

-- Hands out due rows once. A row claimed over 2 minutes ago and still unsent (the
-- function died, or the push service asked us to retry) is due again.
create or replace function public.claim_due_notifications(p_limit int default 100)
returns setof public.notification_outbox
language sql volatile security definer
set search_path = ''
as $$
  update public.notification_outbox o
     set claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select id from public.notification_outbox
      where sent_at is null and cancelled_at is null and send_after <= now()
        and (claimed_at is null or claimed_at < now() - interval '2 minutes')
      order by send_after
      limit p_limit
      for update skip locked)
  returning o.*
$$;
revoke execute on function public.claim_due_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(int) to service_role;

-- Run every 15 minutes. A member is reminded once per local day, in the two hours after
-- their remind_at on that local day, if they have a phone, haven't muted it, and still
-- have a paw to give. The window never wraps past midnight: 00:30 is a new local day
-- whose remind_at hasn't come yet.
create or replace function public.enqueue_reminders(p_now timestamptz default now())
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  p record;
  local_now timestamp;
  local_day date;
  queued int := 0;
begin
  for p in
    select np.user_id, np.timezone, np.remind_at, np.last_reminded_on, m.couple_id
      from public.notification_prefs np
      join public.members m on m.user_id = np.user_id
     where not ('reminder' = any (np.muted))
       and exists (select 1 from public.push_subscriptions s where s.user_id = np.user_id)
  loop
    local_now := p_now at time zone p.timezone;
    local_day := local_now::date;
    continue when p.last_reminded_on is not null and p.last_reminded_on >= local_day;
    continue when local_now < local_day + p.remind_at
               or local_now >= local_day + p.remind_at + interval '2 hours';
    if public.open_goals_for(p.user_id, local_day) > 0 then
      insert into public.notification_outbox (couple_id, recipient_id, actor_id, kind, send_after)
      values (p.couple_id, p.user_id, null, 'reminder', p_now);
      queued := queued + 1;
    end if;
    update public.notification_prefs set last_reminded_on = local_day where user_id = p.user_id;
  end loop;
  return queued;
end
$$;
revoke execute on function public.enqueue_reminders(timestamptz) from public, anon, authenticated;

create or replace function public.prune_notifications()
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from public.notification_outbox where created_at < now() - interval '30 days';
  delete from public.push_subscriptions
   where coalesce(last_ok_at, created_at) < now() - interval '60 days';
$$;
revoke execute on function public.prune_notifications() from public, anon, authenticated;
```

- [ ] **Step 4: Apply and run the scenarios**

Supabase MCP `apply_migration`: name `0012_notification_triggers`, query = file contents.
Then MCP `execute_sql` with the whole of `supabase/tests/notifications.sql`.
Expected: one row, `all good`. On a failed assert, fix the migration, re-apply with `create or replace`/`drop trigger if exists` as needed (record the fix in the same file before committing), and re-run.

- [ ] **Step 5: Re-run Task 3's verification SQL**

Run the Step 4 block from Task 3 again. Expected: `all good` (save/reassign still work with the triggers present).

- [ ] **Step 6: Regenerate types, advisors**

MCP `generate_typescript_types` → `src/lib/database.types.ts`. MCP `get_advisors` (security): nothing new beyond the intended no-policy outbox.

- [ ] **Step 7: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add supabase/migrations/0012_notification_triggers.sql supabase/tests/notifications.sql src/lib/database.types.ts
git commit -m "Queue a note for the other one whenever something happens in the den"
```

---

### Task 5: The `send-push` Edge Function

**Files:**
- Create: `supabase/functions/send-push/index.ts`
- Modify: `package.json` (script `check:functions`)

**Interfaces:**
- Consumes: `planDeliveries`, `localDay`, `settle`, `isGone`, `OutboxRow`, `PlanContext`, `Delivery` (Task 2); RPCs `claim_due_notifications`, `open_goals_for` (Task 4); tables `members`, `goals`, `notification_prefs`, `push_subscriptions`, `notification_outbox`.
- Produces: HTTPS endpoint `https://uosxptayqdetgbyercqt.supabase.co/functions/v1/send-push`, `POST`, header `x-dispatch-secret`; answers `401` without the secret, `200 {"claimed":n,"sent":n,"skipped":n}` otherwise.

- [ ] **Step 1: Prove `npm:web-push` encrypts and signs under Deno**

Write it in the session's scratchpad directory (call it `$SCRATCH`), not in the repo — `$SCRATCH/webpush-spike.ts`:

```ts
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";

const vapid = webpush.generateVAPIDKeys();
const ecdh = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
  "deriveBits",
]);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", ecdh.publicKey));
const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const details = webpush.generateRequestDetails(
  {
    endpoint: "https://web.push.apple.com/QGuMCHanFake",
    keys: { p256dh: b64url(raw), auth: b64url(crypto.getRandomValues(new Uint8Array(16))) },
  },
  JSON.stringify({ title: "CoupleGoal", body: "spike" }),
  {
    vapidDetails: {
      subject: "mailto:spike@example.invalid",
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
    },
    TTL: 60,
  },
);
console.log(details.headers.Authorization.startsWith("vapid t=") ? "SIGNED" : "NOT SIGNED");
console.log(details.body.byteLength > 0 ? "ENCRYPTED" : "EMPTY");
```

Run: `deno run -A "$SCRATCH/webpush-spike.ts"`
Expected: `SIGNED` and `ENCRYPTED`. **If either fails or it throws, stop and report to the owner** — the fallback library is a design change, not an improvisation.

- [ ] **Step 2: Write the function**

`supabase/functions/send-push/index.ts`:

```ts
// Called by pg_cron (via pg_net) when the outbox has something due. Claims rows, plans
// deliveries, sends Web Push, and records what happened. The service key comes from the
// environment Supabase injects; nothing secret lives in this file.
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type Delivery,
  isGone,
  localDay,
  type OutboxRow,
  type PlanContext,
  planDeliveries,
  settle,
} from "./plan.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>).default ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const DISPATCH_SECRET = Deno.env.get("DISPATCH_SECRET") ?? "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return expected.length > 0 && diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadContext(db: SupabaseClient, rows: OutboxRow[], now: Date): Promise<PlanContext> {
  const people = [...new Set(rows.flatMap((r) => [r.recipient_id, r.actor_id ?? ""]))].filter(
    Boolean,
  );
  const goalIds = [...new Set(rows.map((r) => r.goal_id).filter((g): g is string => !!g))];
  const recipients = [...new Set(rows.map((r) => r.recipient_id))];
  const [members, goals, prefs] = await Promise.all([
    db.from("members").select("user_id, display_name").in("user_id", people),
    goalIds.length
      ? db.from("goals").select("id, title, charm, owner_id").in("id", goalIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("notification_prefs").select("user_id, timezone, muted").in("user_id", recipients),
  ]);
  for (const res of [members, goals, prefs]) {
    if (res.error) {
      throw res.error;
    }
  }
  const ctx: PlanContext = {
    names: new Map((members.data ?? []).map((m) => [m.user_id, m.display_name])),
    goals: new Map(
      (goals.data ?? []).map((g) => [g.id, { title: g.title, charm: g.charm, owner_id: g.owner_id }]),
    ),
    prefs: new Map((prefs.data ?? []).map((p) => [p.user_id, { timezone: p.timezone, muted: p.muted }])),
    openGoals: new Map(),
    now,
  };
  const reminded = [...new Set(rows.filter((r) => r.kind === "reminder").map((r) => r.recipient_id))];
  for (const user of reminded) {
    const day = localDay(ctx.prefs.get(user)?.timezone ?? "UTC", now);
    const { data, error } = await db.rpc("open_goals_for", { p_user: user, p_day: day });
    if (error) {
      throw error;
    }
    ctx.openGoals.set(user, data as number);
  }
  return ctx;
}

async function deliver(db: SupabaseClient, d: Delivery, attempts: number): Promise<boolean> {
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", d.recipientId);
  if (error) {
    throw error;
  }
  const statuses: number[] = [];
  let lastError: string | null = null;
  for (const sub of subs ?? []) {
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(d.message),
        { TTL: d.ttlSeconds, urgency: "normal" },
      );
      statuses.push(res.statusCode);
      await db.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      statuses.push(status);
      lastError = `${status} ${(err as Error).message}`.slice(0, 500);
      if (isGone(status)) {
        await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  const outcome = settle(statuses, attempts);
  const at = new Date().toISOString();
  const patch =
    outcome === "sent"
      ? { sent_at: at, last_error: null }
      : outcome === "no-devices"
        ? { sent_at: at, last_error: "no devices" }
        : outcome === "give-up"
          ? { cancelled_at: at, last_error: lastError }
          : { last_error: lastError };
  await db.from("notification_outbox").update(patch).in("id", d.rowIds);
  return outcome === "sent";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }
  if (!sameSecret(req.headers.get("x-dispatch-secret") ?? "", DISPATCH_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("claim_due_notifications", { p_limit: 100 });
  if (error) {
    return json({ error: error.message }, 500);
  }
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return json({ claimed: 0, sent: 0, skipped: 0 });
  }
  const now = new Date();
  const { deliveries, skips } = planDeliveries(rows, await loadContext(db, rows, now));
  for (const skip of skips) {
    await db
      .from("notification_outbox")
      .update({ cancelled_at: now.toISOString(), last_error: skip.reason })
      .eq("id", skip.id);
  }
  const attemptsOf = new Map(rows.map((r) => [r.id, r.attempts]));
  let sent = 0;
  for (const d of deliveries) {
    const attempts = Math.max(...d.rowIds.map((id) => attemptsOf.get(id) ?? 1));
    if (await deliver(db, d, attempts)) {
      sent++;
    }
  }
  return json({ claimed: rows.length, sent, skipped: skips.length });
});
```

- [ ] **Step 3: Type-check under Deno**

Add to `package.json` `scripts`: `"check:functions": "deno check supabase/functions/send-push/index.ts"`.
Run: `npm run check:functions`
Expected: no errors. (Fix type complaints in `index.ts` only; `plan.ts` is already covered by vitest.)

- [ ] **Step 4: Owner sets the secrets (blocking, owner only)**

Tell the owner to run these **in their own terminal** (not with `!`, so nothing private lands in the session), after `npx supabase login`:

```bash
cd /Users/johnnynguyen/Software/Projects/CoupleGoal
npx -y web-push generate-vapid-keys --json > ~/.couplegoal-vapid.json
DISPATCH_SECRET=$(openssl rand -hex 32)
npx supabase secrets set --project-ref uosxptayqdetgbyercqt \
  VAPID_PUBLIC_KEY="$(node -p 'require(process.env.HOME + "/.couplegoal-vapid.json").publicKey')" \
  VAPID_PRIVATE_KEY="$(node -p 'require(process.env.HOME + "/.couplegoal-vapid.json").privateKey')" \
  VAPID_SUBJECT="mailto:<an address you choose>" \
  DISPATCH_SECRET="$DISPATCH_SECRET"
echo "Paste into the Supabase SQL editor:"
echo "select vault.create_secret('$DISPATCH_SECRET', 'dispatch_secret');"
node -p 'require(process.env.HOME + "/.couplegoal-vapid.json").publicKey'
```

The owner then: pastes the `vault.create_secret` line into the Supabase SQL editor; adds the printed **public** key as `VITE_VAPID_PUBLIC_KEY` to `.env.local` and to Vercel (Preview and Production); and may share the public key in chat (it is public). Wait for the owner to confirm before Step 5.

- [ ] **Step 5: Deploy**

Run: `npx supabase functions deploy send-push --no-verify-jwt --project-ref uosxptayqdetgbyercqt`
Expected: `Deployed Functions on project uosxptayqdetgbyercqt: send-push`.

- [ ] **Step 6: Smoke-test the lock**

Run: `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://uosxptayqdetgbyercqt.supabase.co/functions/v1/send-push`
Expected: `401`.

- [ ] **Step 7: Full checks and commit**

```bash
npm run fix && npm run check && npm test && npm run check:functions
git add supabase/functions/send-push/index.ts package.json
git commit -m "Send the queued notes out as Web Push"
```

---

### Task 6: Cron and dispatch (migration 0013)

**Files:**
- Create: `supabase/migrations/0013_notification_cron.sql`

**Interfaces:**
- Consumes: Vault secrets `dispatch_secret` (owner, Task 5) and `send_push_url` (this task); functions from Task 4; the deployed function (Task 5).
- Produces: `public.dispatch_notifications() returns bigint`; cron jobs `dispatch-notifications` (30 s), `enqueue-reminders` (15 min), `prune-notifications` (daily 04:00 UTC).

- [ ] **Step 1: Store the function URL in Vault**

Supabase MCP `execute_sql`:

```sql
select vault.create_secret('https://uosxptayqdetgbyercqt.supabase.co/functions/v1/send-push', 'send_push_url');
select name from vault.secrets where name in ('send_push_url', 'dispatch_secret') order by name;
```

Expected: two rows, `dispatch_secret` and `send_push_url`. If `dispatch_secret` is missing, stop — the owner has not finished Task 5 Step 4.

- [ ] **Step 2: Write the migration**

`supabase/migrations/0013_notification_cron.sql`:

```sql
-- Push notifications, part 3: the clocks. Needs the Vault entries send_push_url and
-- dispatch_secret (see the plan, Tasks 5 and 6) before it does anything useful.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Calls send-push only when something is due, so a quiet den costs no invocations.
create or replace function public.dispatch_notifications()
returns bigint
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if not exists (
    select 1 from public.notification_outbox
     where sent_at is null and cancelled_at is null and send_after <= now()
       and (claimed_at is null or claimed_at < now() - interval '2 minutes')
  ) then
    return null;
  end if;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'dispatch_secret';
  if fn_url is null or secret is null then
    raise warning 'send-push is not configured in Vault';
    return null;
  end if;
  return net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;

select cron.schedule('dispatch-notifications', '30 seconds', 'select public.dispatch_notifications()');
select cron.schedule('enqueue-reminders', '*/15 * * * *', 'select public.enqueue_reminders()');
select cron.schedule('prune-notifications', '0 4 * * *', 'select public.prune_notifications()');
```

- [ ] **Step 3: Apply**

Supabase MCP `apply_migration`: name `0013_notification_cron`, query = file contents.
Then `execute_sql`: `select jobname, schedule, active from cron.job where jobname like '%notification%' or jobname = 'enqueue-reminders' order by jobname;`
Expected: three active jobs with the schedules above.

- [ ] **Step 4: End-to-end through the real function**

Supabase MCP `execute_sql` — a row for a real user with no devices must come back marked `no devices`:

```sql
insert into public.notification_outbox (couple_id, recipient_id, actor_id, kind, send_after, last_error)
select m.couple_id, m.user_id, null, 'reminder', now(), 'e2e-probe'
  from public.members m
 where not exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
 limit 1
returning id;
```

The dispatcher runs every 30 s. After about a minute, run:

```sql
select o.id, o.sent_at, o.cancelled_at, o.last_error, o.attempts
  from public.notification_outbox o where o.id = '<id from above>';
select status_code, content from net._http_response order by created desc limit 3;
```

Expected: the row has `cancelled_at` set with `last_error = 'nothing open'` **or** `sent_at` set with `last_error = 'no devices'` (either proves the round trip; which one depends on whether that member has open goals today), and the latest `net._http_response` is `200` with a body like `{"claimed":1,...}`. A `401` means `dispatch_secret` in Vault doesn't match the function's `DISPATCH_SECRET` — ask the owner to redo Task 5 Step 4. If no members exist without devices, skip the insert and just confirm three jobs exist and `select public.dispatch_notifications()` returns `null` (nothing due).

Then clean up: `delete from public.notification_outbox where id = '<id>';`

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add supabase/migrations/0013_notification_cron.sql
git commit -m "Check the queue every half minute and the clock every quarter hour"
```

---

### Task 7: Our own service worker

**Files:**
- Create: `src/sw.ts`
- Create: `src/lib/push-payload.ts`
- Test: `src/lib/push-payload.test.ts`
- Create: `tsconfig.sw.json`
- Modify: `tsconfig.app.json` (exclude `src/sw.ts`)
- Modify: `vite.config.ts`
- Modify: `package.json` (devDependencies, `check` and `build` scripts)

**Interfaces:**
- Consumes: nothing from earlier tasks (the payload shape `{ title, body, url, tag }` matches Task 1's `PushMessage`).
- Produces:
  - `interface NotificationView { title: string; body: string; url: string; tag: string | undefined }`
  - `notificationFromPush(text: string | null): NotificationView`
  - `safePath(url: unknown): string` — an in-app path starting with a single `/`, else `/den`
  - Built `dist/sw.js` with `push` and `notificationclick` handlers.

- [ ] **Step 1: Write the failing tests**

`src/lib/push-payload.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { notificationFromPush, safePath } from "./push-payload";

describe("safePath", () => {
  test("keeps an in-app path", () => {
    expect(safePath("/goals")).toBe("/goals");
  });

  test.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "javascript:alert(1)",
    "goals",
    "",
    42,
    null,
    undefined,
  ])("sends %s to the den", (bad) => {
    expect(safePath(bad)).toBe("/den");
  });
});

describe("notificationFromPush", () => {
  test("reads a well-formed payload", () => {
    const text = JSON.stringify({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: "paws-2026-10-03",
    });
    expect(notificationFromPush(text)).toEqual({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: "paws-2026-10-03",
    });
  });

  test("an empty push still says something", () => {
    expect(notificationFromPush(null)).toEqual({
      title: "CoupleGoal",
      body: "Something happened in your den.",
      url: "/den",
      tag: undefined,
    });
  });

  test("a non-JSON push is shown as plain text", () => {
    expect(notificationFromPush("Hello")).toEqual({
      title: "CoupleGoal",
      body: "Hello",
      url: "/den",
      tag: undefined,
    });
  });

  test("wrong field types fall back field by field, and an off-site url is refused", () => {
    const text = JSON.stringify({ title: 5, body: "Hi", url: "https://evil.example", tag: [] });
    expect(notificationFromPush(text)).toEqual({
      title: "CoupleGoal",
      body: "Hi",
      url: "/den",
      tag: undefined,
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/push-payload.test.ts`
Expected: FAIL — cannot resolve `./push-payload`.

- [ ] **Step 3: Write the payload module**

`src/lib/push-payload.ts`:

```ts
// What the service worker shows for a push. Pure and DOM-free so it compiles for both
// the app and the worker, and so a malformed or hostile payload is tested here.

export interface NotificationView {
  title: string;
  body: string;
  url: string;
  tag: string | undefined;
}

const TITLE = "CoupleGoal";
const FALLBACK_BODY = "Something happened in your den.";
const HOME = "/den";

/** Only ever a path inside the app: one leading slash, never `//host`. */
export function safePath(url: unknown): string {
  return typeof url === "string" && /^\/(?!\/)/.test(url) ? url : HOME;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function notificationFromPush(raw: string | null): NotificationView {
  if (!raw) {
    return { title: TITLE, body: FALLBACK_BODY, url: HOME, tag: undefined };
  }
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("not an object");
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return { title: TITLE, body: raw, url: HOME, tag: undefined };
  }
  return {
    title: text(data.title) ?? TITLE,
    body: text(data.body) ?? FALLBACK_BODY,
    url: safePath(data.url),
    tag: text(data.tag),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/push-payload.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the Workbox packages explicitly**

Run: `npm install -D workbox-core@7.4.1 workbox-precaching@7.4.1 workbox-routing@7.4.1 workbox-strategies@7.4.1 workbox-expiration@7.4.1`
Expected: installs without changing vite-plugin-pwa's version (`npm ls workbox-precaching` shows one 7.4.1).

- [ ] **Step 6: Write the service worker**

`src/sw.ts`:

```ts
/// <reference lib="webworker" />
// Replaces the generated worker so it can show pushes. Caching is exactly what
// generateSW did before: precache the build, fall back to index.html for page loads
// (not /api/), keep the pup model for a year, and refresh fonts in the background.
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { notificationFromPush, safePath } from "./lib/push-payload";

declare let self: ServiceWorkerGlobalScope;

const ONE_YEAR_SECONDS = 31_536_000;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }),
);
registerRoute(
  ({ url }) => /\/models\/.*\.glb$/.test(url.pathname),
  new CacheFirst({
    cacheName: "pup-model",
    plugins: [new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: ONE_YEAR_SECONDS })],
  }),
);
registerRoute(
  ({ url }) => /^fonts\.(googleapis|gstatic)\.com$/i.test(url.hostname),
  new StaleWhileRevalidate({
    cacheName: "fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: ONE_YEAR_SECONDS })],
  }),
);

self.addEventListener("push", (event) => {
  const view = notificationFromPush(event.data?.text() ?? null);
  event.waitUntil(
    self.registration.showNotification(view.title, {
      body: view.body,
      tag: view.tag,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      data: { url: view.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
```

- [ ] **Step 7: Type-check the worker on its own**

`tsconfig.sw.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["src/sw.ts", "src/lib/push-payload.ts"]
}
```

In `tsconfig.app.json` add after `"include"`: `"exclude": ["src/sw.ts"]`.

In `package.json` `scripts`:

```json
"build": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.sw.json --noEmit && vite build",
"check": "biome check . && tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.sw.json --noEmit",
```

- [ ] **Step 8: Point vite-plugin-pwa at it**

In `vite.config.ts`, replace the `VitePWA({...})` call with:

```ts
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      pwaAssets: { config: true },
      manifest: {
        name: "CoupleGoal",
        short_name: "CoupleGoal",
        description: "Small taps, big dreams, one pup. Goals for the two of you.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en",
        background_color: "#fdf2f8",
        theme_color: "#fdf2f8",
        categories: ["lifestyle"],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
      devOptions: { enabled: false },
    }),
```

and delete the now-unused `ONE_YEAR_SECONDS` constant at the top of `vite.config.ts` (it moved into `src/sw.ts`).

- [ ] **Step 9: Build and inspect**

Run: `npm run build && grep -c "showNotification\|notificationclick" dist/sw.js && grep -o "pup-model\|index.html" dist/sw.js | sort -u`
Expected: build succeeds; the count is ≥ 2; output lists `index.html` and `pup-model`.

- [ ] **Step 10: Offline still works**

Run `npm run preview`, open it in the Playwright browser, load `/den` (signed out is fine — it redirects), then use `browser_evaluate` with `navigator.serviceWorker.ready.then(r => r.active?.scriptURL)` → expect `…/sw.js`. Set the browser offline (`browser_run_code_unsafe`: `await page.context().setOffline(true)`), reload → the app shell still renders (no browser offline page). Restore online.

- [ ] **Step 11: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add src/sw.ts src/lib/push-payload.ts src/lib/push-payload.test.ts tsconfig.sw.json tsconfig.app.json vite.config.ts package.json package-lock.json
git commit -m "Write our own service worker so it can show a partner's paw"
```

---

### Task 8: Subscribing, preferences and sign-out

**Files:**
- Create: `src/lib/push.ts`
- Test: `src/lib/push.test.ts`
- Modify: `src/lib/domain.ts`
- Modify: `src/data/mappers.ts`
- Modify: `src/data/queries.ts`
- Create: `src/data/notification-mutations.ts`
- Test: `src/data/notification-mutations.test.ts`
- Create: `src/data/use-notification-prefs.ts`
- Modify: `src/auth/auth-provider.tsx`
- Modify: `src/routes.tsx`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `save_push_subscription` RPC and `notification_prefs` table (Task 3); generated `Tables<"notification_prefs">`; `isIos` from `src/hooks/use-is-standalone.ts`.
- Produces:
  - `src/lib/domain.ts`: `NOTIFICATION_KINDS: readonly NotificationKind[]`, `type NotificationKind`, `interface NotificationPrefs { timezone: string; remindAt: string; muted: NotificationKind[] }` (`remindAt` is `HH:MM`)
  - `src/lib/push.ts`: `type PushSupport = "unsupported" | "needs-install" | "default" | "granted" | "denied"`, `interface PushEnv`, `pushSupport(env: PushEnv): PushSupport`, `readPushEnv(standalone: boolean): PushEnv`, `urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer>`, `currentSubscription(): Promise<PushSubscription | null>`, `subscribe(vapidKey: string): Promise<PushSubscription>`, `subscriptionKeys(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string }`, `browserTimezone(): string`
  - `src/data/notification-mutations.ts`: `savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string, timezone: string): Promise<void>`, `removePushSubscription(endpoint: string): Promise<void>`, `updateNotificationPrefs(userId: string, patch: { muted?: NotificationKind[]; remindAt?: string }): Promise<void>`, `syncTimezone(userId: string, timezone: string): Promise<void>`, `forgetThisDevice(): Promise<void>`
  - `src/data/queries.ts`: `fetchNotificationPrefs(userId: string): Promise<NotificationPrefs | null>`
  - `src/data/use-notification-prefs.ts`: `useNotificationPrefs(): { prefs: NotificationPrefs | null | undefined; refresh: () => Promise<unknown> }`, `useTimezoneSync(): void`

- [ ] **Step 1: Write the failing browser-glue tests**

`src/lib/push.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { type PushEnv, pushSupport, urlBase64ToUint8Array } from "./push";

const capable: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  standalone: true,
  ios: true,
};

describe("pushSupport", () => {
  test("an iPhone tab must be installed first, whatever it reports", () => {
    expect(pushSupport({ ...capable, standalone: false, hasPushManager: false })).toBe(
      "needs-install",
    );
  });

  test("installed on iPhone, not yet asked", () => {
    expect(pushSupport(capable)).toBe("default");
  });

  test("granted and denied pass through", () => {
    expect(pushSupport({ ...capable, permission: "granted" })).toBe("granted");
    expect(pushSupport({ ...capable, permission: "denied" })).toBe("denied");
  });

  test("a desktop browser tab can subscribe without installing", () => {
    expect(pushSupport({ ...capable, ios: false, standalone: false })).toBe("default");
  });

  test("missing any API is unsupported", () => {
    expect(pushSupport({ ...capable, ios: false, hasPushManager: false })).toBe("unsupported");
    expect(pushSupport({ ...capable, hasServiceWorker: false })).toBe("unsupported");
    expect(pushSupport({ ...capable, hasNotification: false, permission: null })).toBe(
      "unsupported",
    );
  });
});

describe("urlBase64ToUint8Array", () => {
  test("decodes URL-safe base64 without padding", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });

  test("a real VAPID public key is 65 bytes starting with 0x04", () => {
    const key =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/push.test.ts`
Expected: FAIL — cannot resolve `./push`.

- [ ] **Step 3: Write the browser glue**

`src/lib/push.ts`:

```ts
import { isIos } from "@/hooks/use-is-standalone";

// Browser-side Web Push. No Supabase here: saving a subscription is a mutation.

export type PushSupport = "unsupported" | "needs-install" | "default" | "granted" | "denied";

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  standalone: boolean;
  ios: boolean;
}

/** iOS only exposes Web Push to a Home Screen app, so a Safari tab is told to install. */
export function pushSupport(env: PushEnv): PushSupport {
  if (env.ios && !env.standalone) {
    return "needs-install";
  }
  if (!(env.hasServiceWorker && env.hasPushManager && env.hasNotification) || !env.permission) {
    return "unsupported";
  }
  return env.permission;
}

export function readPushEnv(standalone: boolean): PushEnv {
  const hasNotification = typeof Notification !== "undefined";
  return {
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
    standalone,
    ios: isIos(),
  };
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribe(vapidKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}

export function subscriptionKeys(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
```

- [ ] **Step 4: Run the glue tests to verify they pass**

Run: `npx vitest run src/lib/push.test.ts`
Expected: PASS.

- [ ] **Step 5: Domain types, mapper, query**

Append to `src/lib/domain.ts`:

```ts
export const NOTIFICATION_KINDS = [
  "paw_shared",
  "paw_own",
  "milestone_done",
  "heart",
  "seal",
  "goal_added",
  "goal_archived",
  "partner_joined",
  "reminder",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The caller's own notification settings. `remindAt` is local `HH:MM`. */
export interface NotificationPrefs {
  timezone: string;
  remindAt: string;
  muted: NotificationKind[];
}
```

In `src/data/mappers.ts`, add `type NotificationPrefs` to the `@/lib/domain` import list, then add:

```ts
export type NotificationPrefsRow = Tables<"notification_prefs">;

export function notificationPrefsFromRow(row: NotificationPrefsRow): NotificationPrefs {
  // Postgres `time` comes back as HH:MM:SS; the time input wants HH:MM.
  return { timezone: row.timezone, remindAt: row.remind_at.slice(0, 5), muted: row.muted };
}
```

In `src/data/queries.ts`, add `type NotificationPrefs` to the `@/lib/domain` import, `notificationPrefsFromRow` to the `./mappers` import, and:

```ts
/** My own notification settings; null until this account first turns notifications on. */
export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs | null> {
  const { data, error } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? notificationPrefsFromRow(data) : null;
}
```

- [ ] **Step 6: Write the failing mutation tests**

`src/data/notification-mutations.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  removePushSubscription,
  savePushSubscription,
  syncTimezone,
  updateNotificationPrefs,
} from "./notification-mutations";

const client = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update, delete: del }));
  const rpc = vi.fn();
  return { eq, update, del, from, rpc };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: client.from, rpc: client.rpc } }));

const USER_ID = "22222222-2222-2222-2222-222222222222";
const SUB = { endpoint: "https://web.push.apple.com/abc", p256dh: "p", auth: "a" };

beforeEach(() => {
  vi.clearAllMocks();
  client.eq.mockResolvedValue({ error: null });
  client.rpc.mockResolvedValue({ error: null });
});

describe("savePushSubscription", () => {
  test("hands the device and time zone to the RPC", async () => {
    await savePushSubscription(SUB, "iPhone", "Australia/Sydney");
    expect(client.rpc).toHaveBeenCalledWith("save_push_subscription", {
      p_endpoint: SUB.endpoint,
      p_p256dh: "p",
      p_auth: "a",
      p_user_agent: "iPhone",
      p_timezone: "Australia/Sydney",
    });
  });

  test("refuses a subscription with no keys without calling the database", async () => {
    await expect(savePushSubscription({ ...SUB, auth: "" }, "x", "UTC")).rejects.toThrow(
      "This phone didn't give us anywhere to send notifications. Try again?",
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test("shows the RPC's own words on failure", async () => {
    client.rpc.mockResolvedValue({ error: { message: "Sign in first." } });
    await expect(savePushSubscription(SUB, "x", "UTC")).rejects.toThrow("Sign in first.");
  });
});

describe("removePushSubscription", () => {
  test("deletes by endpoint", async () => {
    await removePushSubscription(SUB.endpoint);
    expect(client.from).toHaveBeenCalledWith("push_subscriptions");
    expect(client.eq).toHaveBeenCalledWith("endpoint", SUB.endpoint);
  });
});

describe("updateNotificationPrefs", () => {
  test("writes muted and remind_at, keyed by user", async () => {
    await updateNotificationPrefs(USER_ID, { muted: ["heart"], remindAt: "21:15" });
    expect(client.update).toHaveBeenCalledWith({ muted: ["heart"], remind_at: "21:15" });
    expect(client.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  test("refuses a time that isn't HH:MM", async () => {
    await expect(updateNotificationPrefs(USER_ID, { remindAt: "9pm" })).rejects.toThrow(
      "Pick a time for your reminder.",
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("syncTimezone", () => {
  test("updates only the time zone", async () => {
    await syncTimezone(USER_ID, "Europe/London");
    expect(client.update).toHaveBeenCalledWith({ timezone: "Europe/London" });
    expect(client.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npx vitest run src/data/notification-mutations.test.ts`
Expected: FAIL — cannot resolve `./notification-mutations`.

- [ ] **Step 8: Write the mutations**

`src/data/notification-mutations.ts`:

```ts
import type { NotificationKind } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { currentSubscription } from "@/lib/push";
import { supabase } from "@/lib/supabase";

function wrap(error: unknown): Error {
  return new Error(friendlyError(error), { cause: error });
}

const NO_ADDRESS = "This phone didn't give us anywhere to send notifications. Try again?";
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function savePushSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent: string,
  timezone: string,
): Promise<void> {
  if (!(sub.endpoint && sub.p256dh && sub.auth)) {
    throw new Error(NO_ADDRESS);
  }
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_user_agent: userAgent,
    p_timezone: timezone,
  });
  if (error) {
    throw wrap(error);
  }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    throw wrap(error);
  }
}

export async function updateNotificationPrefs(
  userId: string,
  patch: { muted?: NotificationKind[]; remindAt?: string },
): Promise<void> {
  if (patch.remindAt !== undefined && !HH_MM.test(patch.remindAt)) {
    throw new Error("Pick a time for your reminder.");
  }
  const { error } = await supabase
    .from("notification_prefs")
    .update({
      ...(patch.muted === undefined ? {} : { muted: patch.muted }),
      ...(patch.remindAt === undefined ? {} : { remind_at: patch.remindAt }),
    })
    .eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}

export async function syncTimezone(userId: string, timezone: string): Promise<void> {
  const { error } = await supabase
    .from("notification_prefs")
    .update({ timezone })
    .eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}

/** On sign-out: this phone stops buzzing for this account. Never blocks signing out. */
export async function forgetThisDevice(): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (!sub) {
      return;
    }
    await removePushSubscription(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  } catch {
    // No service worker (or it is still installing): nothing to forget.
  }
}
```

- [ ] **Step 9: Run them to verify they pass**

Run: `npx vitest run src/data/notification-mutations.test.ts`
Expected: PASS.

- [ ] **Step 10: Prefs hook and time-zone sync**

`src/data/use-notification-prefs.ts`:

```ts
import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/auth/auth-provider";
import type { NotificationPrefs } from "@/lib/domain";
import { browserTimezone } from "@/lib/push";
import { syncTimezone } from "./notification-mutations";
import { fetchNotificationPrefs } from "./queries";

/** My own notification settings. `null` = never turned on; `undefined` = still loading. */
export function useNotificationPrefs() {
  const { userId } = useAuth();
  const swr = useSWR<NotificationPrefs | null>(
    userId ? ["notification-prefs", userId] : null,
    () => fetchNotificationPrefs(userId ?? ""),
  );
  return { prefs: swr.data, refresh: swr.mutate };
}

/** Keeps the reminder on local time when the phone changes zone (travel, daylight rules). */
export function useTimezoneSync(): void {
  const { userId } = useAuth();
  const { prefs, refresh } = useNotificationPrefs();
  useEffect(() => {
    const zone = browserTimezone();
    if (!(userId && prefs) || prefs.timezone === zone) {
      return;
    }
    syncTimezone(userId, zone)
      .then(() => refresh())
      .catch(() => undefined);
  }, [userId, prefs, refresh]);
}
```

In `src/routes.tsx`, import `useTimezoneSync` from `@/data/use-notification-prefs` and call it as the first line of `RequireDen()`:

```ts
function RequireDen() {
  useTimezoneSync();
  const { me, error, isLoading, refresh } = useMe();
```

- [ ] **Step 11: Sign-out forgets this phone**

In `src/auth/auth-provider.tsx`, add `import { forgetThisDevice } from "@/data/notification-mutations";` and change `signOut`:

```ts
  const signOut = useCallback(async () => {
    // Before the session ends, while RLS still lets us delete our own row.
    await forgetThisDevice();
    await supabase.auth.signOut();
  }, []);
```

- [ ] **Step 12: The public VAPID key**

`src/vite-env.d.ts` — add to `ImportMetaEnv`:

```ts
  readonly VITE_VAPID_PUBLIC_KEY: string | undefined;
```

`.env.example` — append a line: `VITE_VAPID_PUBLIC_KEY=`

- [ ] **Step 13: Full checks and commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/push.ts src/lib/push.test.ts src/lib/domain.ts src/data/mappers.ts src/data/queries.ts src/data/notification-mutations.ts src/data/notification-mutations.test.ts src/data/use-notification-prefs.ts src/auth/auth-provider.tsx src/routes.tsx src/vite-env.d.ts .env.example
git commit -m "Let a phone sign up for buzzes, and forget it on sign-out"
```

---

### Task 9: The Notifications card

**Files:**
- Create: `src/components/ui/switch.tsx`
- Create: `src/components/notifications-card.tsx`
- Modify: `src/pages/us.tsx`
- Modify: `package.json` / `package-lock.json` (`@radix-ui/react-switch`)

**Interfaces:**
- Consumes: `pushSupport`, `readPushEnv`, `subscribe`, `subscriptionKeys`, `currentSubscription`, `browserTimezone` (Task 8); `savePushSubscription`, `updateNotificationPrefs` (Task 8); `useNotificationPrefs` (Task 8); `useIsStandalone` (`src/hooks/use-is-standalone.ts`); `useDen` (`src/data/den-context`); `NotificationKind`, `NotificationPrefs` (Task 8).
- Produces: `<Switch>` (`src/components/ui/switch.tsx`); `<NotificationsCard>` default export; rendered on the Us page after "Colours".

- [ ] **Step 1: Switch primitive**

Run: `npm install @radix-ui/react-switch`

`src/components/ui/switch.tsx`:

```tsx
import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-6 rounded-full bg-card shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
```

- [ ] **Step 2: The card**

`src/components/notifications-card.tsx`:

```tsx
import { BellRing, Share } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDen } from "@/data/den-context";
import { savePushSubscription, updateNotificationPrefs } from "@/data/notification-mutations";
import { useNotificationPrefs } from "@/data/use-notification-prefs";
import { useIsStandalone } from "@/hooks/use-is-standalone";
import type { NotificationKind, NotificationPrefs } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import {
  browserTimezone,
  currentSubscription,
  type PushSupport,
  pushSupport,
  readPushEnv,
  subscribe,
  subscriptionKeys,
} from "@/lib/push";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface Toggle {
  kind: NotificationKind;
  label: (partner: string) => string;
}

const GROUPS: { title: string; toggles: Toggle[] }[] = [
  {
    title: "Paws",
    toggles: [
      { kind: "paw_shared", label: (p) => `${p} paws a shared goal` },
      { kind: "paw_own", label: (p) => `${p} paws one of their own` },
      { kind: "milestone_done", label: () => "A milestone is finished" },
    ],
  },
  {
    title: "Den",
    toggles: [
      { kind: "heart", label: (p) => `${p} hearts your paw` },
      { kind: "seal", label: (p) => `${p} seals a goal you made` },
      { kind: "goal_added", label: (p) => `${p} adds a goal` },
      { kind: "goal_archived", label: (p) => `${p} tucks a goal away` },
      { kind: "partner_joined", label: () => "Your partner joins the den" },
    ],
  },
];

async function turnOn(): Promise<void> {
  if (!VAPID_KEY) {
    throw new Error("Notifications aren't set up on this site yet.");
  }
  // iOS only shows the prompt from inside a tap; this runs in the click handler.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications stay off until you allow them.");
  }
  const sub = await subscribe(VAPID_KEY);
  await savePushSubscription(subscriptionKeys(sub), navigator.userAgent, browserTimezone());
}

function Toggles({
  prefs,
  partner,
  busy,
  onMuted,
  onRemindAt,
}: {
  prefs: NotificationPrefs;
  partner: string;
  busy: boolean;
  onMuted: (kind: NotificationKind, on: boolean) => void;
  onRemindAt: (value: string) => void;
}) {
  const [remindAt, setRemindAt] = useState(prefs.remindAt);
  const onTime = useCallback((e: ChangeEvent<HTMLInputElement>) => setRemindAt(e.target.value), []);
  const onTimeDone = useCallback(() => {
    if (remindAt !== prefs.remindAt) {
      onRemindAt(remindAt);
    }
  }, [remindAt, prefs.remindAt, onRemindAt]);
  const on = (kind: NotificationKind) => !prefs.muted.includes(kind);

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <fieldset className="space-y-3" key={group.title}>
          <legend className="mb-2 font-semibold text-muted-foreground text-sm">{group.title}</legend>
          {group.toggles.map((t) => (
            <div className="flex items-center justify-between gap-4" key={t.kind}>
              <Label className="font-normal text-base" htmlFor={`notify-${t.kind}`}>
                {t.label(partner)}
              </Label>
              <Switch
                checked={on(t.kind)}
                disabled={busy}
                id={`notify-${t.kind}`}
                onCheckedChange={(checked) => onMuted(t.kind, checked)}
              />
            </div>
          ))}
        </fieldset>
      ))}
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-muted-foreground text-sm">Reminder</legend>
        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal text-base" htmlFor="notify-reminder">
            Nudge me if I have paws left
          </Label>
          <Switch
            checked={on("reminder")}
            disabled={busy}
            id="notify-reminder"
            onCheckedChange={(checked) => onMuted("reminder", checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal text-base" htmlFor="notify-remind-at">
            At
          </Label>
          <Input
            className="w-36"
            disabled={busy || !on("reminder")}
            id="notify-remind-at"
            onBlur={onTimeDone}
            onChange={onTime}
            step={900}
            type="time"
            value={remindAt}
          />
        </div>
      </fieldset>
    </div>
  );
}

export default function NotificationsCard() {
  const { me } = useDen();
  const standalone = useIsStandalone();
  const { prefs, refresh } = useNotificationPrefs();
  const [support, setSupport] = useState<PushSupport>(() => pushSupport(readPushEnv(standalone)));
  const [busy, setBusy] = useState(false);
  const partner = me.members.find((m) => m.id !== me.userId)?.displayName ?? "Your partner";

  useEffect(() => {
    setSupport(pushSupport(readPushEnv(standalone)));
  }, [standalone]);

  // Allowed on this phone but no row for this account (e.g. the other account signed out
  // here): quietly sign the phone back up.
  useEffect(() => {
    if (support !== "granted" || !VAPID_KEY || prefs === undefined) {
      return;
    }
    let cancelled = false;
    (async () => {
      const existing = await currentSubscription();
      if (cancelled || (existing && prefs)) {
        return;
      }
      const sub = existing ?? (await subscribe(VAPID_KEY));
      await savePushSubscription(subscriptionKeys(sub), navigator.userAgent, browserTimezone());
      await refresh();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [support, prefs, refresh]);

  const onTurnOn = useCallback(async () => {
    setBusy(true);
    try {
      await turnOn();
      await refresh();
      toast("Notifications on");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSupport(pushSupport(readPushEnv(standalone)));
      setBusy(false);
    }
  }, [refresh, standalone]);

  const save = useCallback(
    async (patch: { muted?: NotificationKind[]; remindAt?: string }) => {
      setBusy(true);
      try {
        await updateNotificationPrefs(me.userId, patch);
        await refresh();
      } catch (err) {
        toast.error(friendlyError(err));
      } finally {
        setBusy(false);
      }
    },
    [me.userId, refresh],
  );
  const onMuted = useCallback(
    (kind: NotificationKind, on: boolean) => {
      if (!prefs) {
        return;
      }
      const muted = on ? prefs.muted.filter((k) => k !== kind) : [...prefs.muted, kind];
      void save({ muted });
    },
    [prefs, save],
  );
  const onRemindAt = useCallback((remindAt: string) => void save({ remindAt }), [save]);

  return (
    <Card>
      <CardHeader>
        <h2 className="display-title text-2xl">Notifications</h2>
      </CardHeader>
      <CardContent>
        {support === "needs-install" ? (
          <p className="m-0 flex items-start gap-3 text-sm">
            <Share aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              Add CoupleGoal to your Home Screen to get notifications: tap{" "}
              <strong>Share</strong>, then <strong>Add to Home Screen</strong>, and open it from
              there.
            </span>
          </p>
        ) : null}
        {support === "unsupported" ? (
          <p className="m-0 text-muted-foreground text-sm">
            This browser can't show notifications.
          </p>
        ) : null}
        {support === "denied" ? (
          <p className="m-0 text-muted-foreground text-sm">
            Notifications are off for CoupleGoal. Turn them on in Settings → Notifications →
            CoupleGoal.
          </p>
        ) : null}
        {VAPID_KEY && support === "default" ? (
          <div className="space-y-3">
            <p className="m-0 text-muted-foreground text-sm">
              Hear about {partner}'s paws, hearts and new goals, and get a nudge when you have
              paws left.
            </p>
            <Button disabled={busy} onClick={onTurnOn} type="button">
              <BellRing /> Turn on notifications
            </Button>
          </div>
        ) : null}
        {!VAPID_KEY && (support === "default" || support === "granted") ? (
          <p className="m-0 text-muted-foreground text-sm">
            Notifications aren't set up on this site yet.
          </p>
        ) : null}
        {VAPID_KEY && support === "granted" && prefs ? (
          <Toggles
            busy={busy}
            key={prefs.remindAt}
            onMuted={onMuted}
            onRemindAt={onRemindAt}
            partner={partner}
            prefs={prefs}
          />
        ) : null}
        {VAPID_KEY && support === "granted" && !prefs ? (
          <p className="m-0 text-muted-foreground text-sm">Setting up this phone…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Put it on the Us page**

In `src/pages/us.tsx`: `import NotificationsCard from "@/components/notifications-card";` and render `<NotificationsCard />` directly after the closing `</Card>` of the "Colours" card.

- [ ] **Step 4: Full checks**

Run: `npm run fix && npm run check && npm test`
Expected: all green.

- [ ] **Step 5: Verify the card at four widths (Rule 1)**

Run `npm run dev`, sign in with a test account in the Playwright browser, open `/us`. At 320, 375, 768 and 1280 px wide (`browser_resize`), screenshot the Notifications card and check: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), toggles aligned right with labels wrapping cleanly, the time input not overflowing at 320. In desktop Chromium the card shows **Turn on notifications**; click it, accept the permission (Playwright: `context.grantPermissions(["notifications"])` first), and confirm the toggles appear. Toggle "hearts your paw" off, reload, confirm it stays off. Change the time to 21:15, blur, reload, confirm.

Then in MCP `execute_sql` (owner's test account only): `select muted, remind_at, timezone from public.notification_prefs where user_id = '<test user id>';` → `{heart}`, `21:15:00`, the browser's zone.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/switch.tsx src/components/notifications-card.tsx src/pages/us.tsx package.json package-lock.json
git commit -m "Give the Us page a Notifications card"
```

---

### Task 10: Preview on a real iPhone, and the docs

**Files:**
- Modify: `README.md`
- Modify: `DEPLOY.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a preview URL the owner tests on; docs for the new env var, secrets, migrations and cron.

- [ ] **Step 1: Document it**

`README.md` — in the Supabase section, after the migrations line, add:

```markdown
- Notifications: migrations `0011`–`0013` add `push_subscriptions`, `notification_prefs`, a private `notification_outbox`, the triggers that fill it, and three `pg_cron` jobs. The `send-push` Edge Function (`supabase/functions/send-push/`, deployed with `--no-verify-jwt`) sends Web Push. Scenario tests: run `supabase/tests/notifications.sql` through the Supabase MCP `execute_sql` (it rolls back).
```

`DEPLOY.md` — add a section:

```markdown
## Notifications

- `VITE_VAPID_PUBLIC_KEY` must be set in `.env.local` and in Vercel (Preview and Production). It is public.
- Edge Function secrets (owner sets them; never in the repo): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DISPATCH_SECRET` — `npx supabase secrets set --project-ref uosxptayqdetgbyercqt …`.
- Vault entries: `dispatch_secret` (same value as `DISPATCH_SECRET`) and `send_push_url`.
- Redeploy the function after changing it: `npx supabase functions deploy send-push --no-verify-jwt --project-ref uosxptayqdetgbyercqt`.
- Rotating `DISPATCH_SECRET`: set the new secret on the function and update the Vault entry in the same sitting; until both match, `net._http_response` shows 401s and nothing sends.
```

- [ ] **Step 2: Commit**

```bash
npm run fix && npm run check && npm test
git add README.md DEPLOY.md
git commit -m "Write down how notifications are wired and what the owner keeps"
```

- [ ] **Step 3: Preview deploy (ask first)**

Ask the owner before deploying. Then: `vercel deploy --target=preview`. Expected: a preview URL. Confirm the owner has added `VITE_VAPID_PUBLIC_KEY` to Vercel's Preview environment **before** this build, or the card will say "Notifications aren't set up on this site yet."

- [ ] **Step 4: Owner's end-to-end on two phones**

Give the owner this checklist for the preview URL (two accounts in one den, at least one iPhone on iOS 16.4+):

1. In Safari, open the preview → Us: the card says to add to Home Screen. Add it, open from the icon → **Turn on notifications** → Allow.
2. On the other account, paw a shared goal. Within ~30–60 s the iPhone shows "<name> pawed … for you both". Tap it → the den opens.
3. Paw again and undo within 10 s → no notification.
4. Heart one of the iPhone owner's paws → "<name> ❤️ your … paw".
5. Finish a shared milestone → "You two finished …! 🎉".
6. Set the reminder 20 minutes ahead with an unpawed habit → one nudge, no second one.
7. Turn "hearts your paw" off → a heart no longer buzzes.
8. Sign out on the iPhone and sign in as the other account → the first account's partner events no longer arrive there.

Record what passed and failed. Anything failing goes back to the owning task. Production and `v*` tags remain the owner's call.
