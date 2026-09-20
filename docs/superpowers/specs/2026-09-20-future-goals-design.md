# Goals in the future — design

Date: 2026-09-20

## Problem

Every goal lands in the present. `createGoal` derives a milestone's `period` from
`today` (`src/data/goal-mutations.ts`), the `PeriodPicker`'s forward arrow is
disabled once it reaches the current period, and `MilestoneSection` clamps any
`period` in the URL to `period <= current`. A couple can look back at a memory
but cannot write anything down for next month, next quarter or next year.

Daily habits have no date at all: `horizon = 'day'` means `period is null` and
`target_units is null`, enforced by `goals_validate`. There is nowhere to record
a one-off thing to do on a named day.

## What we are building

1. Milestones (month, quarter, year) can be created in a future period.
2. A new shape of `day` goal: a **task**, a single thing to do on one named day.

## Data model

`Goal.period` on a `day` goal carries the distinction:

| `horizon` | `period` | meaning |
|---|---|---|
| `day` | `null` | habit — every day, no end |
| `day` | `2026-11-14` | task — that one day |
| `month` / `quarter` / `year` | `2026-11` / `2026-Q4` / `2026` | milestone |

`target_units` stays `null` for both kinds of `day` goal: a task is one paw per
stamper, not a bar to fill. No new column and no change to the `horizon` enum,
so the `day → month → quarter → year` ladder that `parentHorizon` and
`childHorizon` index into is untouched, as is the
`checkins_one_paw_per_day` partial unique index keyed to `horizon = 'day'`.

`src/lib/goals.ts` gains `isHabit(goal)` and `isTask(goal)` so no page
open-codes `period === null`.

## Database — `supabase/migrations/0008_future.sql`

Future milestones need no migration: `goals_validate` never consulted the clock
for a milestone, and the `checkins_validate` clock guard (`new.day` within
`current_date ± 1`) already makes a future goal un-stampable. Planning a future
goal is allowed; stamping it early is not. That is the behaviour we want.

Tasks need four changes:

- `period_horizon(p)` learns `^\d{4}-\d{2}-\d{2}$` and returns `'day'`.
- `period_range(p)` returns the one-day range `[d, d]` for a day key.
- `is_day_key(p)` — new. Shape alone is not enough: `2026-02-31` matches the
  regex and would make `period_range` raise a Postgres range error rather than
  one of our own user-facing messages. A `plpgsql` function with an exception
  handler returns false instead.
- `goals_validate` splits its `day` branch: no period is a habit (rules
  unchanged); a period must satisfy `is_day_key`. Parent containment becomes
  uniform — `period_range(parent.period) @> period_range(new.period)` now covers
  tasks, so a task on 14 November climbs toward November or Q4 with no new rule.
  The today ±1 grace on a parent link stays, but applies to habits only.
- `checkins_validate` requires a task's paw to land on the task's own day.

Column grants are not widened. `period` stays immutable after insert, as
`0007_fixes.sql` deliberately made it.

## Pure maths

**`ladder.ts`.** A `day` child contributes `habitFraction` — stamped days over
elapsed days in the parent's period — which would score a finished task 1/30.
Tasks branch off: a task contributes **1 when every one of its stampers has
stamped, else 0** (the owner for a private task, both partners for a shared
one). New `taskState()` sits alongside `computeHabitStates()` and returns
`{ doneBy, done }`, driving both the card and the ladder from one place.

**`goals.ts`.** `parentCandidates` takes the child's *period* rather than
`today`, and offers parents whose range contains it. A goal planned for Q1 2027
then offers 2027's goals, not this year's.

**`periods.ts`.** `periodLabel` handles day keys. `horizonOfPeriod` stays
milestone-only (returning `MilestoneHorizon`) so a day key cannot leak into a
milestone code path; tasks are recognised by `isValidDayKey`.

## Writes

`GoalInput` gains `period: string | null`. `createGoal` stops deriving the
period from `today` and writes what the caller chose.

## UI

**Milestone tabs.** The `PeriodPicker`'s forward arrow unlocks, capped at 24
months / 8 quarters / 5 years ahead. A future period's label reads `ahead` where
a past one reads `memory`. `MilestoneSection`'s single `readOnly` flag splits:
a past period stays fully read-only; a future period is fully editable — create,
edit, seal, archive — but its stamp button is disabled and reads "not yet". The
"New goal" button creates into the period on screen, so the picker *is* the
period chooser and the dialog needs no extra field for milestones.

**Day tab.** Two sections: *Every day* (the habit grid, unchanged) and *On a
day*, listing overdue-and-undone tasks, then today's, then upcoming. A new
`TaskCard` shows the title, a human date ("Today", "Fri 14 Nov", "in 3 days")
and the same paw buttons as a habit, enabled only on the day itself. The dialog
shows a date field when adding to that section.

**Den.** `denView.habits` gains `period === null`, so a task dated next March
cannot appear in today's strip. Tasks due today join the strip — that is what a
task is for.

## Testing

Unit tests for the new maths (`periods`, `ladder`, `goals`, `views`) and the
mutation's period argument, plus the existing suites kept green. Screens checked
at 320 / 375 / 768 / 1280 before the work is called done, per Rule 1.

## Deliberately out of scope

- **Rescheduling a task.** `period` is immutable by column grant; a wrong date
  is fixed by archiving and re-adding. Allowing it back means widening the
  surface `0007_fixes.sql` narrowed on purpose.
- Recurring tasks, reminders or notifications, and any calendar view.
- Done past tasks drop off the Day tab once their day passes. Their paw prints
  stay in the ticker and in the couple's history; nothing is deleted.
