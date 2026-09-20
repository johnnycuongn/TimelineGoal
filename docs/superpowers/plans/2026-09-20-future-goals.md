# Goals in the Future — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a couple write down a goal for a future month, quarter or year, and a one-off task for a single named future day.

**Architecture:** A `day` goal's `period` column, until now always `null`, becomes the habit/task distinction: `null` is a habit ("every day"), a day key like `2026-11-14` is a task ("that one day"). Milestones already work in any period — the block was entirely in the client (`createGoal` derived the period from today; the picker refused to walk forward), so future milestones need no migration. Tasks need four small database changes so `period_horizon`, `period_range` and the two validation triggers understand a day key.

**Tech Stack:** Vite + React 19 + TypeScript, Supabase (Postgres, RLS, triggers), SWR, Tailwind v4 with tokens in `src/styles.css`, Radix wrappers in `src/components/ui/`, Vitest (node environment, `src/**/*.test.ts` only), Biome.

**Spec:** `docs/superpowers/specs/2026-09-20-future-goals-design.md`

## Global Constraints

- Node 22 (`nvm use`), npm. `npm run fix && npm run check && npm test` before every commit.
- Pure maths (`periods`, `ladder`, `mood`, `views`, `goals`) never imports Supabase.
- Every write is a function in `src/data/mutations.ts` or `src/data/goal-mutations.ts`.
- Error strings are user-facing copy in this app's voice — warm, plain, never a stack trace.
- Mobile-first: verify at 320 / 375 / 768 / 1280 before claiming a screen works.
- Tokens live in `src/styles.css` only; UI primitives in `src/components/ui/` are hand-written Radix wrappers.
- Vitest only picks up `src/**/*.test.ts` — there is no component test harness, so `.tsx` work is verified in the browser.
- `period` on a goal is immutable after insert (column grants in `0007_fixes.sql`). Nothing in this plan widens that.
- Never read `.env.local`; never add an `sb_secret_` key anywhere.

---

### Task 1: Day keys work as periods

**Files:**
- Modify: `src/lib/periods.ts`
- Test: `src/lib/periods.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `periodRange(period)` accepting a day key; `periodContainsPeriod(outer: string, inner: string): boolean`; `periodsBetween(from: string, to: string): number`; `canPlanPeriod(period: string, today: string): boolean`; `dayLabel(day: string, today: string): string`; `periodLabel(period)` accepting a day key.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/periods.test.ts`:

```ts
describe("day keys as periods", () => {
  test("periodRange of a day key is that one day", () => {
    expect(periodRange("2026-11-14")).toEqual({ start: "2026-11-14", end: "2026-11-14" });
  });

  test("periodLabel spells a day key out", () => {
    expect(periodLabel("2026-11-14")).toBe("14 November 2026");
  });

  test("periodContainsPeriod nests a day inside its month, quarter and year", () => {
    expect(periodContainsPeriod("2026-11", "2026-11-14")).toBe(true);
    expect(periodContainsPeriod("2026-Q4", "2026-11-14")).toBe(true);
    expect(periodContainsPeriod("2026", "2026-11-14")).toBe(true);
    expect(periodContainsPeriod("2026-10", "2026-11-14")).toBe(false);
    expect(periodContainsPeriod("2026-Q4", "2026-09")).toBe(false);
    expect(periodContainsPeriod("2026", "2026-Q4")).toBe(true);
  });

  test("a period contains itself", () => {
    expect(periodContainsPeriod("2026-11", "2026-11")).toBe(true);
  });

  test("daysElapsedInPeriod treats a day key as a one-day period", () => {
    expect(daysElapsedInPeriod("2026-11-14", "2026-11-13")).toBe(0);
    expect(daysElapsedInPeriod("2026-11-14", "2026-11-14")).toBe(1);
    expect(daysElapsedInPeriod("2026-11-14", "2026-12-01")).toBe(1);
  });
});

describe("planning ahead", () => {
  test("periodsBetween counts steps of the horizon", () => {
    expect(periodsBetween("2026-09", "2026-11")).toBe(2);
    expect(periodsBetween("2026-11", "2026-09")).toBe(-2);
    expect(periodsBetween("2026-Q3", "2027-Q1")).toBe(2);
    expect(periodsBetween("2026", "2029")).toBe(3);
  });

  test("canPlanPeriod allows the past and a bounded future", () => {
    expect(canPlanPeriod("2020-01", "2026-09-20")).toBe(true);
    expect(canPlanPeriod("2028-09", "2026-09-20")).toBe(true);
    expect(canPlanPeriod("2028-10", "2026-09-20")).toBe(false);
    expect(canPlanPeriod("2028-Q3", "2026-09-20")).toBe(true);
    expect(canPlanPeriod("2029-Q1", "2026-09-20")).toBe(false);
    expect(canPlanPeriod("2031", "2026-09-20")).toBe(true);
    expect(canPlanPeriod("2032", "2026-09-20")).toBe(false);
  });
});

describe("dayLabel", () => {
  test("names the days around today", () => {
    expect(dayLabel("2026-09-20", "2026-09-20")).toBe("Today");
    expect(dayLabel("2026-09-21", "2026-09-20")).toBe("Tomorrow");
    expect(dayLabel("2026-09-19", "2026-09-20")).toBe("Yesterday");
  });

  test("gives a weekday and date further out, with the year only when it differs", () => {
    expect(dayLabel("2026-11-14", "2026-09-20")).toBe("Sat 14 Nov");
    expect(dayLabel("2027-01-04", "2026-09-20")).toBe("Mon 4 Jan 2027");
  });
});
```

Add `canPlanPeriod`, `dayLabel`, `periodContainsPeriod` and `periodsBetween` to the import list at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- periods`
Expected: FAIL — `canPlanPeriod is not a function`, and `periodRange("2026-11-14")` throws `Invalid period`.

- [ ] **Step 3: Implement**

In `src/lib/periods.ts`, add the short month names and weekday names beside `MONTH_NAMES`:

```ts
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
```

Give `periodRange` a day-key branch before it reaches `monthSpan` (which only knows milestones):

```ts
export function periodRange(period: string): { start: string; end: string } {
  // A task's period is the single day it lands on; everything below is a milestone.
  if (isValidDayKey(period)) {
    return { start: period, end: period };
  }
  const { year, first, last } = monthSpan(period);
  ...unchanged...
}
```

Extend `periodLabel` the same way, at the top of the function:

```ts
export function periodLabel(period: string): string {
  if (isValidDayKey(period)) {
    const date = toUtc(period);
    return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  const horizon = horizonOfPeriod(period);
  ...unchanged...
}
```

Then append:

```ts
/** Does `outer` cover every day of `inner`? Either may be a day key or a milestone period. */
export function periodContainsPeriod(outer: string, inner: string): boolean {
  const o = periodRange(outer);
  const i = periodRange(inner);
  return o.start <= i.start && i.end <= o.end;
}

/** Signed number of periods from `from` to `to`. Both must share a horizon. */
export function periodsBetween(from: string, to: string): number {
  const horizon = horizonOfPeriod(from);
  if (horizonOfPeriod(to) !== horizon) {
    throw new Error(`Periods of different horizons: ${from}, ${to}`);
  }
  const a = monthSpan(from);
  const b = monthSpan(to);
  if (horizon === "year") {
    return b.year - a.year;
  }
  const months = (b.year - a.year) * MONTHS_PER_YEAR + (b.first - a.first);
  return horizon === "month" ? months : months / MONTHS_PER_QUARTER;
}

/**
 * How far ahead a couple may plan. Far enough for a real dream, close enough that
 * nobody walks the picker to the year 3000 and wonders where their goals went.
 */
const LOOK_AHEAD: Record<MilestoneHorizon, number> = { month: 24, quarter: 8, year: 5 };

/** Is `period` somewhere we let a goal be written — any past period, or a bounded future? */
export function canPlanPeriod(period: string, today: string): boolean {
  const horizon = horizonOfPeriod(period);
  return periodsBetween(periodFor(horizon, today), period) <= LOOK_AHEAD[horizon];
}
```

`monthSpan` is declared above `periodRange`, so both additions can call it. Note `periodsBetween` is exported for the picker's cap and tested directly; `LOOK_AHEAD` stays private.

Add `dayLabel` at the end of the day-key section, under `daysBetween`:

```ts
/** A task's day in words, relative to today when that reads better. */
export function dayLabel(day: string, today: string): string {
  const delta = daysBetween(today, day);
  if (delta === 0) {
    return "Today";
  }
  if (delta === 1) {
    return "Tomorrow";
  }
  if (delta === -1) {
    return "Yesterday";
  }
  const date = toUtc(day);
  const stem = `${WEEKDAY_NAMES[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()].slice(0, 3)}`;
  return date.getUTCFullYear() === toUtc(today).getUTCFullYear()
    ? stem
    : `${stem} ${date.getUTCFullYear()}`;
}
```

`MilestoneHorizon` is already imported at the top of the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- periods`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/periods.ts src/lib/periods.test.ts
git commit -m "Teach the period maths what a single day is"
```

---

### Task 2: Habits and tasks tell themselves apart

**Files:**
- Modify: `src/lib/goals.ts`
- Test: Create `src/lib/goals.test.ts`

**Interfaces:**
- Consumes: `periodContainsPeriod`, `periodFor` (Task 1).
- Produces: `isHabit(goal: Goal): boolean`; `isTask(goal: Goal): boolean`; `taskDay(goal: Goal): string | null`; `stampersOf(goal: Goal, members: Member[]): Member[]`; `parentCandidates(goals: Goal[], horizon: Horizon, period: string | null, today: string): Goal[]` (signature change — `period` and `today` replace the old `today`-only argument).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/goals.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { Goal, Member } from "./domain";
import { SHARED_OWNER } from "./domain";
import { isHabit, isTask, parentCandidates, stampersOf, taskDay } from "./goals";

const A = "a";
const B = "b";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "horizon">): Goal {
  return {
    coupleId: "c1",
    title: partial.id,
    charm: null,
    owner: A,
    period: null,
    targetUnits: null,
    parentGoalId: null,
    seals: {},
    createdBy: A,
    createdAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...partial,
  };
}

const members: Member[] = [
  { id: A, displayName: "Ann", color: "rose" },
  { id: B, displayName: "Bo", color: "teal" },
];

describe("habit and task", () => {
  test("a day goal without a period is a habit", () => {
    const g = goal({ id: "h", horizon: "day" });
    expect(isHabit(g)).toBe(true);
    expect(isTask(g)).toBe(false);
    expect(taskDay(g)).toBe(null);
  });

  test("a day goal with a day key is a task", () => {
    const g = goal({ id: "t", horizon: "day", period: "2026-11-14" });
    expect(isTask(g)).toBe(true);
    expect(isHabit(g)).toBe(false);
    expect(taskDay(g)).toBe("2026-11-14");
  });

  test("a milestone is neither", () => {
    const g = goal({ id: "m", horizon: "month", period: "2026-11" });
    expect(isHabit(g)).toBe(false);
    expect(isTask(g)).toBe(false);
  });
});

describe("stampersOf", () => {
  test("a private goal is stamped by its owner alone", () => {
    expect(stampersOf(goal({ id: "g", horizon: "day", owner: B }), members)).toEqual([members[1]]);
  });

  test("a shared goal is stamped by both", () => {
    expect(stampersOf(goal({ id: "g", horizon: "day", owner: SHARED_OWNER }), members)).toEqual(
      members,
    );
  });
});

describe("parentCandidates", () => {
  const nov = goal({ id: "nov", horizon: "month", period: "2026-11" });
  const dec = goal({ id: "dec", horizon: "month", period: "2026-12" });
  const q4 = goal({ id: "q4", horizon: "quarter", period: "2026-Q4" });
  const y26 = goal({ id: "y26", horizon: "year", period: "2026" });
  const goals = [nov, dec, q4, y26];

  test("a month goal climbs toward the quarter that holds its period", () => {
    expect(parentCandidates(goals, "month", "2026-11", "2026-09-20")).toEqual([q4]);
  });

  test("a quarter goal climbs toward its year", () => {
    expect(parentCandidates(goals, "quarter", "2026-Q4", "2026-09-20")).toEqual([y26]);
  });

  test("a task climbs toward the month that holds its day", () => {
    expect(parentCandidates(goals, "day", "2026-11-14", "2026-09-20")).toEqual([nov]);
  });

  test("a habit has no period, so it climbs toward this month", () => {
    expect(parentCandidates(goals, "day", null, "2026-11-03")).toEqual([nov]);
  });

  test("a year goal has nothing above it", () => {
    expect(parentCandidates(goals, "year", "2026", "2026-09-20")).toEqual([]);
  });

  test("an archived parent is not offered", () => {
    const gone = goal({
      id: "gone",
      horizon: "quarter",
      period: "2026-Q4",
      archivedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(parentCandidates([gone], "month", "2026-11", "2026-09-20")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- goals`
Expected: FAIL — `isHabit is not a function`.

- [ ] **Step 3: Implement**

Replace `src/lib/goals.ts` entirely:

```ts
import type { Goal, Horizon, Member } from "./domain";
import { SHARED_OWNER } from "./domain";
import { parentHorizon, periodContainsPeriod, periodFor } from "./periods";

/** A daily habit: every day, for as long as it's wanted. */
export function isHabit(goal: Goal): boolean {
  return goal.horizon === "day" && goal.period === null;
}

/** A one-off task: a single thing to do on one named day. */
export function isTask(goal: Goal): boolean {
  return goal.horizon === "day" && goal.period !== null;
}

/** The day a task lands on, or null if this isn't a task. */
export function taskDay(goal: Goal): string | null {
  return isTask(goal) ? goal.period : null;
}

/** Who may put a paw on this goal: both partners if it's shared, else its owner. */
export function stampersOf(goal: Goal, members: Member[]): Member[] {
  return goal.owner === SHARED_OWNER ? members : members.filter((m) => m.id === goal.owner);
}

/**
 * Active goals one horizon up that cover `period` — the stretch of time the new goal
 * belongs to. A habit has no period of its own, so it climbs toward whatever holds
 * today, which is the same rule `goals_validate` enforces in the database.
 */
export function parentCandidates(
  goals: Goal[],
  horizon: Horizon,
  period: string | null,
  today: string,
): Goal[] {
  const up = parentHorizon(horizon);
  if (!up || up === "day") {
    return [];
  }
  const anchor = period ?? today;
  return goals.filter(
    (g) =>
      g.horizon === up &&
      g.archivedAt === null &&
      g.period !== null &&
      periodContainsPeriod(g.period, anchor),
  );
}
```

`periodFor` is no longer needed here — drop it from the import if the editor flags it unused. (Keep the import list exactly matching what the file uses; `npm run check` will fail otherwise.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- goals`
Expected: PASS.

- [ ] **Step 5: Fix the one existing caller**

`src/pages/timeline.tsx:339` calls `parentCandidates(view.goals, h, today)`. Change it to `parentCandidates(view.goals, h, null, today)` for now — Task 8 replaces this with the real period. This keeps `npm run check` green between commits.

- [ ] **Step 6: Commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/goals.ts src/lib/goals.test.ts src/pages/timeline.tsx
git commit -m "Let a goal say whether it's a habit or a one-off"
```

---

### Task 3: A task's paws, and what it's worth to its parent

**Files:**
- Modify: `src/lib/ladder.ts`
- Test: `src/lib/ladder.test.ts`

**Interfaces:**
- Consumes: `isTask`, `stampersOf` (Task 2), `periodContainsDay` (existing).
- Produces: `interface TaskState { doneBy: Record<string, boolean>; done: boolean }`; `computeTaskStates(goals: Goal[], checkins: CheckInLite[], members: Member[]): Record<string, TaskState>`. `computeHabitStates` stops returning tasks; `computeProgress` scores a task child 1 or 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/ladder.test.ts` (match the file's existing `goal()` helper — if it doesn't take `period`, extend it to spread `partial` as in `views.test.ts`):

```ts
describe("tasks", () => {
  const members: Member[] = [
    { id: "a", displayName: "Ann", color: "rose" },
    { id: "b", displayName: "Bo", color: "teal" },
  ];

  test("a private task is done when its owner stamps it", () => {
    const task = goal({ id: "t", horizon: "day", period: "2026-11-14", owner: "a" });
    const none = computeTaskStates([task], [], members);
    expect(none.t).toEqual({ doneBy: { a: false }, done: false });
    const stamped = computeTaskStates(
      [task],
      [{ goalId: "t", uid: "a", day: "2026-11-14" }],
      members,
    );
    expect(stamped.t).toEqual({ doneBy: { a: true }, done: true });
  });

  test("a shared task waits for both paws", () => {
    const task = goal({ id: "t", horizon: "day", period: "2026-11-14", owner: SHARED_OWNER });
    const half = computeTaskStates(
      [task],
      [{ goalId: "t", uid: "a", day: "2026-11-14" }],
      members,
    );
    expect(half.t).toEqual({ doneBy: { a: true, b: false }, done: false });
    const both = computeTaskStates(
      [task],
      [
        { goalId: "t", uid: "a", day: "2026-11-14" },
        { goalId: "t", uid: "b", day: "2026-11-14" },
      ],
      members,
    );
    expect(both.t.done).toBe(true);
  });

  test("a paw on another day doesn't count", () => {
    const task = goal({ id: "t", horizon: "day", period: "2026-11-14", owner: "a" });
    const state = computeTaskStates(
      [task],
      [{ goalId: "t", uid: "a", day: "2026-11-13" }],
      members,
    );
    expect(state.t.done).toBe(false);
  });

  test("computeHabitStates leaves tasks alone", () => {
    const task = goal({ id: "t", horizon: "day", period: "2026-11-14", owner: "a" });
    const habit = goal({ id: "h", horizon: "day", owner: "a" });
    const states = computeHabitStates([task, habit], [], "2026-11-14", ["a", "b"]);
    expect(states.t).toBeUndefined();
    expect(states.h).toBeDefined();
  });

  test("a finished task is worth a whole paw to its parent, not a day of it", () => {
    const month = goal({ id: "m", horizon: "month", period: "2026-11", targetUnits: 2 });
    const task = goal({
      id: "t",
      horizon: "day",
      period: "2026-11-14",
      owner: "a",
      parentGoalId: "m",
    });
    const progress = computeProgress(
      [month, task],
      [{ goalId: "t", uid: "a", day: "2026-11-14" }],
      "2026-11-20",
    );
    expect(progress.m?.ladder).toBe(1);
  });

  test("an unfinished task is worth nothing to its parent", () => {
    const month = goal({ id: "m", horizon: "month", period: "2026-11", targetUnits: 2 });
    const task = goal({
      id: "t",
      horizon: "day",
      period: "2026-11-14",
      owner: SHARED_OWNER,
      parentGoalId: "m",
    });
    const progress = computeProgress(
      [month, task],
      [{ goalId: "t", uid: "a", day: "2026-11-14" }],
      "2026-11-20",
    );
    expect(progress.m?.ladder).toBe(0);
  });
});
```

`computeProgress` has no member list, so its task branch counts a task done when **any** required stamper has stamped… no — see Step 3: `computeProgress` gains a `members` parameter so both paths agree. Update the two existing `computeProgress(` call sites in this test file to pass `members` as a fourth argument, and likewise in `views.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ladder`
Expected: FAIL — `computeTaskStates is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/ladder.ts`:

```ts
import type { Goal, Member } from "./domain";
import { isTask, stampersOf } from "./goals";
import { daysElapsedInPeriod, periodContainsDay, shiftDay } from "./periods";

export interface TaskState {
  /** Has each stamper put their paw on it? */
  doneBy: Record<string, boolean>;
  /** Every stamper has. A shared task waits for both. */
  done: boolean;
}

export function computeTaskStates(
  goals: Goal[],
  checkins: CheckInLite[],
  members: Member[],
): Record<string, TaskState> {
  const grouped = byGoal(checkins);
  const out: Record<string, TaskState> = {};
  for (const g of goals) {
    if (!isTask(g) || g.archivedAt !== null) {
      continue;
    }
    const stamps = grouped.get(g.id) ?? [];
    const doneBy: Record<string, boolean> = {};
    for (const m of stampersOf(g, members)) {
      doneBy[m.id] = stamps.some((c) => c.uid === m.id && c.day === g.period);
    }
    const flags = Object.values(doneBy);
    out[g.id] = { doneBy, done: flags.length > 0 && flags.every(Boolean) };
  }
  return out;
}
```

Guard `computeHabitStates` so a task never lands in it — change its skip line to:

```ts
    if (g.horizon !== "day" || isTask(g) || g.archivedAt !== null) {
      continue;
    }
```

Give `computeProgress` the members it needs and branch the day-child case:

```ts
export function computeProgress(
  goals: Goal[],
  checkins: CheckInLite[],
  today: string,
  members: Member[] = [],
): Record<string, GoalProgress> {
```

and inside `progressOf`:

```ts
    for (const child of children.get(goal.id) ?? []) {
      if (isTask(child)) {
        // A task is one thing done on one day: a whole paw when it's finished, not the
        // day-out-of-the-month fraction a habit earns.
        ladder += computeTaskStates([child], grouped.get(child.id) ?? [], members)[child.id]?.done
          ? 1
          : 0;
      } else if (child.horizon === "day") {
        ladder += habitFraction(child, grouped.get(child.id) ?? [], period, today);
      } else {
        const p = progressOf(child);
        ladder += Math.min(1, p.progress / p.target);
      }
    }
```

The `members = []` default keeps the signature backward-compatible for any caller not yet updated: with no members a task has no stampers and scores 0, which is the safe direction (it never invents progress). Task 5 passes the real list from every call site.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ladder`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/ladder.ts src/lib/ladder.test.ts src/lib/views.test.ts
git commit -m "Score a finished task as a whole paw"
```

---

### Task 4: The views keep habits and tasks apart

**Files:**
- Modify: `src/lib/views.ts`
- Test: `src/lib/views.test.ts`

**Interfaces:**
- Consumes: `isHabit`, `isTask` (Task 2), `computeTaskStates` (Task 3).
- Produces: `DenData` gains `todayTasks: Goal[]` and `taskStates: Record<string, TaskState>`; `TimelineData` gains `tasks: Goal[]` and `taskStates`. `DenData.habits` and `TimelineData` habit maths exclude tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/views.test.ts`:

```ts
describe("tasks in the views", () => {
  const withTasks: CoupleData = {
    ...data,
    goals: [
      ...data.goals,
      goal({ id: "today-task", horizon: "day", period: "2026-09-20", owner: A }),
      goal({ id: "later-task", horizon: "day", period: "2026-12-01", owner: A }),
    ],
  };

  test("the den's habits never include a task", () => {
    const view = denView(withTasks, A, "2026-09-20");
    expect(view.habits.some((g) => g.id === "today-task")).toBe(false);
    expect(view.habits.some((g) => g.id === "later-task")).toBe(false);
  });

  test("the den carries today's tasks and no others", () => {
    const view = denView(withTasks, A, "2026-09-20");
    expect(view.todayTasks.map((g) => g.id)).toEqual(["today-task"]);
  });

  test("the timeline carries every task, in date order", () => {
    const view = timelineView(withTasks, A, "2026-09-20");
    expect(view.tasks.map((g) => g.id)).toEqual(["today-task", "later-task"]);
  });

  test("a task gets a state, a habit does not", () => {
    const view = timelineView(withTasks, A, "2026-09-20");
    expect(view.taskStates["today-task"]).toBeDefined();
    expect(view.habits["today-task"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- views`
Expected: FAIL — `view.todayTasks` is undefined.

- [ ] **Step 3: Implement**

In `src/lib/views.ts`, import `isHabit`, `isTask` from `./goals` and `computeTaskStates`, `type TaskState` from `./ladder`. Add to `DenData`:

```ts
  /** Tasks dated today. A task for next March has no business in today's strip. */
  todayTasks: Goal[];
  taskStates: Record<string, TaskState>;
```

and to `TimelineData`:

```ts
  /** Every active one-off task, oldest day first. */
  tasks: Goal[];
  taskStates: Record<string, TaskState>;
```

In `denView`, change the habits line and add the tasks:

```ts
  const habits = goals.filter(isHabit);
  const todayTasks = goals.filter((g) => isTask(g) && g.period === today);
```

and include `todayTasks` plus `taskStates: computeTaskStates(goals, lite, data.members)` in the returned object.

In `timelineView`, add:

```ts
    tasks: goals.filter(isTask).sort((a, b) => (a.period ?? "").localeCompare(b.period ?? "")),
    taskStates: computeTaskStates(goals, lite, data.members),
```

and pass the members through to progress: `computeProgress(goals, lite, today, data.members)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- views`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/views.ts src/lib/views.test.ts
git commit -m "Keep a dated task out of today's habit strip"
```

---

### Task 5: createGoal writes the period it was given

**Files:**
- Modify: `src/lib/domain.ts`, `src/data/goal-mutations.ts`
- Test: Create `src/data/goal-mutations.test.ts`

**Interfaces:**
- Consumes: `isValidPeriod`, `isValidDayKey`, `horizonOfPeriod` (existing).
- Produces: `GoalInput` gains `period: string | null`; `createGoal({ coupleId, uid, input })` — the `today` argument is gone.

- [ ] **Step 1: Write the failing test**

Create `src/data/goal-mutations.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GoalInput } from "@/lib/domain";
import { createGoal } from "./goal-mutations";

const client = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { single, select, insert, from };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: client.from } }));

const COUPLE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

function input(partial: Partial<GoalInput>): GoalInput {
  return {
    title: "Something",
    charm: null,
    horizon: "month",
    owner: USER_ID,
    period: "2026-11",
    targetUnits: 3,
    parentGoalId: null,
    ...partial,
  };
}

beforeEach(() => {
  client.from.mockClear();
  client.insert.mockClear();
  client.single.mockResolvedValue({
    data: {
      id: "g1",
      couple_id: COUPLE_ID,
      title: "Something",
      charm: null,
      horizon: "month",
      owner_id: USER_ID,
      period: "2026-11",
      target_units: 3,
      parent_goal_id: null,
      created_by: USER_ID,
      created_at: "2026-09-20T00:00:00.000Z",
      archived_at: null,
    },
    error: null,
  });
});

describe("createGoal", () => {
  test("writes a future period instead of deriving one from today", async () => {
    await createGoal({ coupleId: COUPLE_ID, uid: USER_ID, input: input({ period: "2027-Q1" }) });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: "2027-Q1", horizon: "month" }),
    );
  });

  test("a habit is written with no period and no target", async () => {
    await createGoal({
      coupleId: COUPLE_ID,
      uid: USER_ID,
      input: input({ horizon: "day", period: null, targetUnits: 5 }),
    });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: null, target_units: null }),
    );
  });

  test("a task keeps its day and still takes no target", async () => {
    await createGoal({
      coupleId: COUPLE_ID,
      uid: USER_ID,
      input: input({ horizon: "day", period: "2026-11-14", targetUnits: 5 }),
    });
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ period: "2026-11-14", target_units: null }),
    );
  });

  test("refuses a period that doesn't match the horizon, without touching the database", async () => {
    await expect(
      createGoal({ coupleId: COUPLE_ID, uid: USER_ID, input: input({ period: "2026-11-14" }) }),
    ).rejects.toThrow("That date doesn't match the kind of goal.");
    expect(client.from).not.toHaveBeenCalled();
  });

  test("refuses a day that never happened", async () => {
    await expect(
      createGoal({
        coupleId: COUPLE_ID,
        uid: USER_ID,
        input: input({ horizon: "day", period: "2026-02-30" }),
      }),
    ).rejects.toThrow("That date doesn't match the kind of goal.");
    expect(client.from).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- goal-mutations`
Expected: FAIL — `createGoal` still requires `today` and ignores `input.period` (TypeScript will flag the missing property first).

- [ ] **Step 3: Implement**

In `src/lib/domain.ts`, add to `GoalInput`, under `horizon`:

```ts
  /** null for a daily habit; a day key for a task; a period for a milestone. */
  period: string | null;
```

In `src/data/goal-mutations.ts`, replace the `periodFor` import with `horizonOfPeriod, isValidDayKey, isValidPeriod` and rewrite the head of `createGoal`:

```ts
/** The period a goal may carry, checked here so a typo never reaches a trigger. */
function periodForInput(input: GoalInput): string | null {
  if (input.horizon === "day") {
    // No period is a habit; a day key is a one-off task on that day.
    if (input.period === null || isValidDayKey(input.period)) {
      return input.period;
    }
  } else if (
    input.period !== null &&
    isValidPeriod(input.period) &&
    horizonOfPeriod(input.period) === input.horizon
  ) {
    return input.period;
  }
  throw new Error("That date doesn't match the kind of goal.");
}

export async function createGoal(args: {
  coupleId: string;
  uid: string;
  input: GoalInput;
}): Promise<Goal> {
  const { coupleId, uid, input } = args;
  const milestone = input.horizon !== "day";
  const period = periodForInput(input);
  const { data, error } = await supabase
    .from("goals")
    .insert({
      couple_id: coupleId,
      title: input.title.trim(),
      charm: input.charm?.trim() || null,
      horizon: input.horizon,
      owner_id: input.owner === SHARED_OWNER ? null : input.owner,
      period,
      target_units: milestone ? input.targetUnits : null,
      parent_goal_id: input.parentGoalId,
      created_by: uid,
    })
    ...unchanged from .select("*") onwards...
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- goal-mutations`
Expected: PASS. `npm run check` will now fail in `new-goal-dialog.tsx` (it still passes `today` and omits `period`) — Task 9 fixes that; do not commit this task on its own if the repo must stay green. Commit it together with Task 9, or add the two-line stopgap below.

- [ ] **Step 5: Stopgap so the tree compiles**

In `src/components/goals/new-goal-dialog.tsx`, drop `today: ctx.today,` from the `createGoal` call and add `period: horizon === "day" ? null : periodFor(horizon, ctx.today),` to the `input` object, importing `periodFor` from `@/lib/periods`. This preserves today's exact behaviour; Task 9 replaces it with the chosen period.

- [ ] **Step 6: Commit**

```bash
npm run fix && npm run check && npm test
git add src/lib/domain.ts src/data/goal-mutations.ts src/data/goal-mutations.test.ts src/components/goals/new-goal-dialog.tsx
git commit -m "Let the caller say which stretch of time a goal is for"
```

---

### Task 6: The database learns what a day key is

**Files:**
- Create: `supabase/migrations/0008_future.sql`

**Interfaces:**
- Consumes: nothing in TypeScript.
- Produces: `public.is_day_key(text) returns boolean`; `period_horizon` and `period_range` accept day keys; `goals_validate` and `checkins_validate` handle tasks.

There is no SQL test harness in this repo (Vitest is `src/**/*.test.ts` only), so this task's verification is the migration applying cleanly and the manual checks in Step 3.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_future.sql`:

```sql
-- Goals in the future. Milestones needed nothing here -- goals_validate never asked
-- what day it was, and checkins_validate's clock guard already makes a future goal
-- plannable but not stampable. This migration is entirely about the new shape of a
-- `day` goal: period null is still a habit, a day key is a one-off task on that day.

-- A day key that is also a real date. The regex alone would accept 2026-02-30, and
-- period_range would then raise a Postgres range error instead of our own copy.
create or replace function public.is_day_key(p text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  perform p::date;
  return true;
exception when others then
  return false;
end
$$;

-- A task's period is a day, and its horizon is 'day'.
create or replace function public.period_horizon(p text)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case
    when p ~ '^\d{4}$' then 'year'::public.horizon
    when p ~ '^\d{4}-Q[1-4]$' then 'quarter'::public.horizon
    when p ~ '^\d{4}-(0[1-9]|1[0-2])$' then 'month'::public.horizon
    when public.is_day_key(p) then 'day'::public.horizon
  end
$$;

-- A day key is the one-day range, so the parent containment check below needs no
-- special case: period_range(parent) @> period_range(task) just works.
create or replace function public.period_range(p text)
returns daterange
language plpgsql immutable
set search_path = ''
as $$
declare
  y int;
  m int;
  q int;
  first_day date;
begin
  if p ~ '^\d{4}$' then
    y := p::int;
    return daterange(make_date(y, 1, 1), make_date(y, 12, 31), '[]');
  elsif p ~ '^\d{4}-Q[1-4]$' then
    y := left(p, 4)::int;
    q := right(p, 1)::int;
    first_day := make_date(y, (q - 1) * 3 + 1, 1);
    return daterange(first_day, (first_day + interval '3 months' - interval '1 day')::date, '[]');
  elsif p ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    y := left(p, 4)::int;
    m := right(p, 2)::int;
    first_day := make_date(y, m, 1);
    return daterange(first_day, (first_day + interval '1 month' - interval '1 day')::date, '[]');
  elsif public.is_day_key(p) then
    return daterange(p::date, p::date, '[]');
  end if;
  raise exception 'Invalid period %', p;
end
$$;

-- 0007's function, with the day branch split into habit and task. A habit still links
-- to the parent holding today (a day of grace on both sides for time zones); a task
-- links to whatever covers its own day, by the same containment rule as a milestone.
create or replace function public.goals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  parent public.goals;
  up public.horizon;
  parent_changed boolean;
begin
  if new.horizon = 'day' then
    if new.target_units is not null then
      raise exception 'Daily habits and one-off goals have no paw target.';
    end if;
    if new.period is not null and not public.is_day_key(new.period) then
      raise exception 'A one-off goal needs a real date.';
    end if;
  else
    if new.period is null or public.period_horizon(new.period) is distinct from new.horizon then
      raise exception 'That period does not match the horizon.';
    end if;
    if new.target_units is null then
      raise exception 'Milestones need a paw target.';
    end if;
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.members where user_id = new.owner_id and couple_id = new.couple_id
  ) then
    raise exception 'The owner must be in this den.';
  end if;

  parent_changed := tg_op = 'INSERT' or new.parent_goal_id is distinct from old.parent_goal_id
    or new.horizon is distinct from old.horizon or new.period is distinct from old.period;
  if new.parent_goal_id is not null and parent_changed then
    select * into parent from public.goals where id = new.parent_goal_id;
    up := public.parent_horizon(new.horizon);
    if parent.id is null or parent.couple_id <> new.couple_id or parent.archived_at is not null then
      raise exception 'That bigger goal is not in this den.';
    end if;
    if up is null or parent.horizon <> up then
      raise exception 'A goal can only climb toward the horizon just above it.';
    end if;
    -- Anything with a period of its own -- a milestone or a task -- must sit inside
    -- the parent's stretch of time.
    if new.period is not null
       and not (public.period_range(parent.period) @> public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    -- A habit has no period, so it links to the parent that holds today, with a day of
    -- grace on both sides so neither a user ahead of UTC nor one behind it is locked out.
    if new.period is null
       and not (public.period_range(parent.period) @> (current_date - 1)
             or public.period_range(parent.period) @> current_date
             or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for this month.';
    end if;
  end if;
  return new;
end
$$;

revoke execute on function public.goals_validate() from public, anon, authenticated;
revoke execute on function public.is_day_key(text) from public, anon;

-- A task's paw belongs on the task's own day. The existing clock guard above it already
-- refuses any day outside current_date +/- 1, so this is what stops a future task being
-- stamped the moment it is written down.
create or replace function public.checkins_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
  r daterange;
  stamped int;
begin
  select * into g from public.goals where id = new.goal_id;
  if g.id is null or g.archived_at is not null then
    raise exception 'That goal is tucked away.';
  end if;
  if not exists (select 1 from public.members where user_id = new.user_id and couple_id = g.couple_id) then
    raise exception 'You are not in this den.';
  end if;
  if g.owner_id is not null and g.owner_id <> new.user_id then
    raise exception 'Only the owner stamps this one.';
  end if;
  if new.day < current_date - 1 or new.day > current_date + 1 then
    raise exception 'Your clock and ours disagree. Reload and try again.';
  end if;
  new.couple_id := g.couple_id;
  new.horizon := g.horizon;
  if g.horizon = 'day' then
    if g.period is not null and g.period::date <> new.day then
      raise exception 'That one is for another day.';
    end if;
  else
    r := public.period_range(g.period);
    if not (r @> new.day) then
      raise exception 'That goal belongs to another stretch of time.';
    end if;
    select count(*) into stamped from public.checkins where goal_id = g.id and r @> day;
    if stamped >= g.target_units then
      raise exception 'Every paw is already on this one.';
    end if;
  end if;
  return new;
end
$$;

revoke execute on function public.checkins_validate() from public, anon, authenticated;
```

- [ ] **Step 2: Apply it**

Apply through the Supabase MCP `apply_migration` (name `0008_future`) or `supabase db push`. **Ask the owner first** — this is the live database (CLAUDE.md Rule 2).

- [ ] **Step 3: Verify by hand against the live schema**

Run these reads (they write nothing):

```sql
select public.period_horizon('2026-11-14');            -- day
select public.period_range('2026-11-14');              -- [2026-11-14,2026-11-15)
select public.is_day_key('2026-02-30');                -- false
select public.period_range('2026-11') @> public.period_range('2026-11-14');  -- true
```

Expected: `day`, the one-day range, `false`, `true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_future.sql
git commit -m "Teach the triggers that a day goal may have a day"
```

---

### Task 7: The period picker walks forward

**Files:**
- Modify: `src/components/goals/period-picker.tsx`

**Interfaces:**
- Consumes: `canPlanPeriod`, `periodLabel`, `shiftPeriod` (Task 1).
- Produces: unchanged props (`period`, `current`, `onChange`).

No unit test — there is no component harness. Verified in the browser in Task 11.

- [ ] **Step 1: Implement**

Replace the body of `src/components/goals/period-picker.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { canPlanPeriod, periodLabel, shiftPeriod } from "@/lib/periods";

export default function PeriodPicker({
  period,
  current,
  today,
  onChange,
}: {
  period: string;
  current: string;
  today: string;
  onChange: (period: string) => void;
}) {
  const earlier = useCallback(() => onChange(shiftPeriod(period, -1)), [onChange, period]);
  const later = useCallback(() => onChange(shiftPeriod(period, 1)), [onChange, period]);
  // Looking back is unbounded -- every memory is worth keeping. Looking forward stops
  // where planning turns into wandering.
  const canGoLater = canPlanPeriod(shiftPeriod(period, 1), today);
  const note = period === current ? null : period < current ? "memory" : "ahead";
  return (
    <div className="flex items-center gap-1">
      <Button aria-label="Earlier" onClick={earlier} size="icon" type="button" variant="ghost">
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-[9rem] text-center font-heading text-lg">
        {periodLabel(period)}
        {note ? <span className="ml-2 text-muted-foreground text-xs">{note}</span> : null}
      </span>
      <Button
        aria-label="Later"
        disabled={!canGoLater}
        onClick={later}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Check it compiles**

Run: `npm run check`
Expected: one error in `timeline.tsx` — `PeriodPicker` now needs `today`. Task 8 supplies it; fix it there.

---

### Task 8: A future period is a place you can write

**Files:**
- Modify: `src/pages/timeline.tsx`, `src/components/goals/milestone-card.tsx`

**Interfaces:**
- Consumes: `canPlanPeriod` (Task 1), `parentCandidates` (Task 2), `PeriodPicker` (Task 7).
- Produces: `MilestoneCard` gains `notYet?: boolean`.

- [ ] **Step 1: Split read-only into past and future in `MilestoneSection`**

In `src/pages/timeline.tsx`, replace the clamp and the `readOnly` line:

```tsx
  const current = periodFor(horizon, data.today);
  // A period from the URL only counts on its own tab, and only inside the stretch of
  // time we let a couple plan for.
  const viewPeriod =
    period && horizonOfPeriod(period) === horizon && canPlanPeriod(period, data.today)
      ? period
      : current;
  // A memory is finished and cannot be rewritten. A plan can be written, edited and
  // sealed -- it just cannot be stamped until its time comes round.
  const isMemory = viewPeriod < current;
  const notYet = viewPeriod > current;
```

Use `isMemory` everywhere the old `readOnly` was used for the menu and the card, and pass `notYet` through:

```tsx
        <PeriodPicker
          current={current}
          onChange={setPeriod}
          period={viewPeriod}
          today={data.today}
        />
```

```tsx
                  menu={
                    isMemory ? undefined : (
                      <GoalMenu ... />
                    )
                  }
                  notYet={notYet}
                  readOnly={isMemory}
```

and the empty-state copy gains its third voice:

```tsx
          {isMemory
            ? "Nothing was written down for this stretch."
            : notYet
              ? "Nothing planned yet. What do you want this stretch to hold?"
              : "No goals for this stretch yet. Dream a little?"}
```

- [ ] **Step 2: Let the page create into the viewed period**

`MilestoneSection` owns `viewPeriod`, but the dialog is mounted by the page. Lift the derivation: in `TimelinePage`, above the `return`, add

```tsx
  // The period the picker is showing is the period a new goal belongs to. For the Day
  // tab there is no picker, so a new habit or task decides its own date in the dialog.
  const currentPeriod = h === "day" ? null : periodFor(h, today);
  const viewedPeriod =
    h === "day"
      ? null
      : period && horizonOfPeriod(period) === h && canPlanPeriod(period, today)
        ? period
        : currentPeriod;
  const viewingMemory = viewedPeriod !== null && currentPeriod !== null && viewedPeriod < currentPeriod;
```

Delete the old `viewingMemory` definition (it used `period < periodFor(h, today)` with the extra guards). Pass `period={viewedPeriod}` to `MilestoneSection` so both agree — change its `period` prop type to `string | null` and use it directly as `viewPeriod` when it is non-null.

Pass the period into the dialog:

```tsx
      <NewGoalDialog
        ctx={{ coupleId: me.couple.id, uid: me.userId, today }}
        editing={editing}
        horizon={h}
        me={view.me}
        members={view.members}
        onCreated={onCreated}
        onOpenChange={onDialogOpenChange}
        onSaved={onSaved}
        open={dialogOpen}
        parents={parentCandidates(view.goals, h, dialogPeriod, today)}
        period={viewedPeriod}
      />
```

where `dialogPeriod` is `viewedPeriod` for a milestone tab. (On the Day tab the dialog picks its own date, and asks for its parents itself — see Task 9, Step 3.)

The "New goal" button keeps `disabled={viewingMemory}`, which now means "only a memory is closed for writing".

- [ ] **Step 3: Give `MilestoneCard` its "not yet"**

In `src/components/goals/milestone-card.tsx`, add `notYet = false` to the props (and `notYet?: boolean` to the type), then:

```tsx
  const canStamp =
    !readOnly && !notYet && (shared || goal.owner === me) && progress !== undefined && !progress.complete;
```

Find the stamp `Button` and, when `notYet` is true, render it disabled with the label `Not yet` in place of its usual copy. Keep the seal button working — sealing a plan is exactly what a plan is for.

- [ ] **Step 4: Verify**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add src/pages/timeline.tsx src/components/goals/milestone-card.tsx src/components/goals/period-picker.tsx
git commit -m "Open the months ahead for writing, not for stamping"
```

---

### Task 9: A card, a section and a date field for tasks

**Files:**
- Create: `src/components/goals/task-card.tsx`
- Modify: `src/pages/timeline.tsx`, `src/components/goals/new-goal-dialog.tsx`

**Interfaces:**
- Consumes: `dayLabel` (Task 1), `stampersOf` (Task 2), `TaskState` (Task 3), `TimelineData.tasks`/`taskStates` (Task 4), `GoalInput.period` (Task 5).
- Produces: `TaskCard` default export; `NewGoalDialog` gains `period: string | null`.

- [ ] **Step 1: Write `TaskCard`**

Create `src/components/goals/task-card.tsx`. It is `HabitCard` with the 7-day strip replaced by the task's date, and the paw enabled only on the day itself:

```tsx
import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback } from "react";
import { colorFor, inkFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, type Member, SHARED_OWNER } from "@/lib/domain";
import { stampersOf } from "@/lib/goals";
import type { TaskState } from "@/lib/ladder";
import { PRESS_SCALE, springs } from "@/lib/motion";
import { dayLabel } from "@/lib/periods";

function stamperLabel(mine: boolean, done: boolean, name: string, title: string): string {
  if (mine) {
    return done ? `Undo your paw on ${title}` : `Stamp your paw on ${title}`;
  }
  return done ? `${name} did ${title}` : `Waiting for ${name}`;
}

export default function TaskCard({
  goal,
  state,
  members,
  me,
  today,
  busy = false,
  onToggle,
  menu,
}: {
  goal: Goal;
  state: TaskState | undefined;
  members: Member[];
  me: string;
  today: string;
  busy?: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
  menu?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const shared = goal.owner === SHARED_OWNER;
  const owner = members.find((m) => m.id === goal.owner);
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared
    ? `linear-gradient(90deg, ${gradient.join(", ")})`
    : colorFor(owner?.color ?? "rose", theme);
  const day = goal.period ?? today;
  // The database refuses a paw on any day but the task's own, so the card doesn't offer one.
  const isToday = day === today;
  const overdue = day < today && !state?.done;

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h2>
          <p className="m-0 text-muted-foreground text-xs">
            {dayLabel(day, today)}
            {overdue ? " · still waiting" : ""}
            {" · "}
            {shared ? "Together" : (owner?.displayName ?? "")}
          </p>
        </div>
        {menu}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {stampersOf(goal, members).map((m) => {
          const done = state?.doneBy[m.id] ?? false;
          const mine = m.id === me;
          const color = colorFor(m.color, theme);
          return <StamperPaw ... />;
        })}
      </div>
    </article>
  );
}
```

Write `StamperPaw` as a small component in the same file, modelled exactly on `StamperRow` in `habit-card.tsx:17-79` but without the `strip`/`stripDays` block and with `disabled={!mine || !isToday || busy}`. A hook cannot be called inside the `.map` callback, which is why the paw is its own component — follow the same pattern `habit-card.tsx` already uses.

- [ ] **Step 2: Give the Day tab its two sections**

In `src/pages/timeline.tsx`, inside the `h === "day"` branch, keep the habit grid and add below it:

```tsx
            {(() => {
              // Today's and everything ahead, plus anything overdue that was never done:
              // a task that slipped shouldn't vanish, and a finished one shouldn't linger.
              const tasks = view.tasks.filter(
                (g) => (g.period ?? "") >= today || !view.taskStates[g.id]?.done,
              );
              return tasks.length === 0 ? null : (
                <div className="mt-8">
                  <p className="island-kicker mb-3">On a day</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tasks.map((goal, index) => (
                      <StaggerItem index={index} key={goal.id}>
                        <TaskCard
                          busy={habitToggle.busy.has(goal.id)}
                          goal={goal}
                          me={view.me}
                          members={view.members}
                          menu={<GoalMenu goal={goal} onArchive={archive} onEdit={edit} />}
                          onToggle={habitToggle.toggle}
                          state={taskToggle(goal.id)}
                          today={today}
                        />
                      </StaggerItem>
                    ))}
                  </div>
                </div>
              );
            })()}
```

Wrap the two sections in a fragment, and give the habit grid its own `On repeat`/`Every day` kicker so the Day tab reads as two named groups rather than one list that changed shape.

A task's paw is *not* routed through `useHabitToggle`'s optimistic override: that
override speaks `HabitState` (`todayBy`), and a `TaskState` has a different shape.
Pass `state={view.taskStates[goal.id]}` and let the paw appear on the refresh that
`useHabitToggle.toggle` already awaits — the button is disabled while `busy`, so the
card never looks stuck. `toggle` itself works unchanged for a task: it stamps
`localDayKey()`, which for a task shown with an enabled paw is the task's own day.

`view` is computed after the early returns in `TimelinePage`, so this code belongs inside the same block as the rest of the JSX.

- [ ] **Step 3: The dialog learns about dates**

In `src/components/goals/new-goal-dialog.tsx`:

- Add `period: string | null` to the props, and `today` is already on `ctx`.
- Add state for a task's day and whether this is a task at all:

```tsx
  const [taskDayValue, setTaskDayValue] = useState("");
  // On the Day tab a goal is a habit until a date is given; a date makes it a one-off.
  const isTask = horizon === "day" && taskDayValue !== "";
```

- Reset `taskDayValue` in the same effects that reset the rest (`""` for a new goal; `editing.period ?? ""` when editing).
- Render, only when `horizon === "day"` and not editing:

```tsx
          {horizon === "day" && !editing ? (
            <div className="space-y-2">
              <Label htmlFor="goal-day">On a day (optional)</Label>
              <Input id="goal-day" min={ctx.today} onChange={onTaskDay} type="date" value={taskDayValue} />
              <p className="m-0 text-muted-foreground text-xs">
                Leave this empty for something you'll do every day.
              </p>
            </div>
          ) : null}
```

- Hide the "Paw prints to fill" field for tasks — it is already hidden for `horizon === "day"`, so nothing changes.
- In `submit`, pass the period:

```tsx
            period: horizon === "day" ? taskDayValue || null : period,
```

- The description line: when `horizon === "day"`, show `HORIZON_HINT.day` while no date is set and "A one-off thing, on the day you choose." once one is.
- `editing` never changes a period (the column is immutable), so the date field is not rendered when editing; show the task's date as static text instead.

Update `TimelinePage`'s `parentCandidates` call to follow the dialog's date. The simplest honest wiring: give the dialog the whole `goals` list and let it compute its own parents, since only it knows the chosen date. Change the prop from `parents: Goal[]` to `goals: Goal[]` and inside the dialog:

```tsx
  const parents = useMemo(
    () => parentCandidates(goals, horizon, horizon === "day" ? taskDayValue || null : period, ctx.today),
    [goals, horizon, taskDayValue, period, ctx.today],
  );
```

- [ ] **Step 4: Verify**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run fix && npm run check && npm test
git add src/components/goals/task-card.tsx src/components/goals/new-goal-dialog.tsx src/pages/timeline.tsx
git commit -m "Give a one-off thing a day of its own"
```

---

### Task 10: Today's tasks reach the Den

**Files:**
- Modify: `src/components/den/today-strip.tsx`, `src/pages/den.tsx`

**Interfaces:**
- Consumes: `DenData.todayTasks`, `DenData.taskStates` (Task 4), `TaskCard` (Task 9).

- [ ] **Step 1: Implement**

`TodayStrip` takes two more props, `tasks: Goal[]`, `taskStates: Record<string, TaskState>` and `today: string`, renders the task cards in the same grid ahead of the habits (a thing due today is more urgent than a habit), and its empty state only shows when both lists are empty.

In `den.tsx`, pass `tasks={view.todayTasks} taskStates={view.taskStates} today={view.today}`.

- [ ] **Step 2: Verify**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
npm run fix && npm run check && npm test
git add src/components/den/today-strip.tsx src/pages/den.tsx
git commit -m "Put today's one-off in the den, where today lives"
```

---

### Task 11: See it work, at every width

**Files:** none — verification only.

- [ ] **Step 1: Run the whole gate**

Run: `npm run fix && npm run check && npm test`
Expected: PASS, no diff left by `fix` beyond what is committed.

- [ ] **Step 2: Drive the real app**

Start `npm run dev` and, signed in to a real den, walk:

1. Timeline → Month → forward arrow → next month reads `ahead`; "New goal" is enabled; create one; it appears; its stamp button reads "Not yet" and is disabled; the seal dialog still opens for a shared goal.
2. Forward to the cap (24 months) → the arrow disables.
3. Back to a past month → reads `memory`, "New goal" disabled, no menu on the cards. Unchanged from before.
4. Day tab → create a habit with no date → lands in *Every day*. Create one with a date next week → lands in *On a day* with "in N days" and a disabled paw.
5. Create a task dated today → its paw is enabled, stamping it fills the paw, and it shows on the Den.
6. Give a task a parent (a month goal covering its day) → completing the task moves the parent's bar by one paw.

- [ ] **Step 3: Check every width**

At 320 / 375 / 768 / 1280: the Day tab's two sections, a `TaskCard` with a long title, the period picker with `ahead` showing, and the dialog with the date field open. Nothing overflows; the date input is reachable above the keyboard on a phone.

- [ ] **Step 4: Commit any fixes**

```bash
npm run fix && npm run check && npm test
git commit -am "Fit the new cards to a phone"
```

---

### Task 12: Ship it

- [ ] **Step 1: Confirm with the owner** — CLAUDE.md Rule 2: publishing is the owner's call, and the migration in Task 6 touches the live database.
- [ ] **Step 2:** `vercel deploy --target=preview` and click through the preview.
- [ ] **Step 3:** Deploy to production once the preview is good.
