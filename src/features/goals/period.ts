/**
 * Goal periods. Weekly goals live in an ISO-8601 week (e.g. "2026-W28"),
 * quarterly in "2026-Q3", yearly in "2026". "This week" is just a query —
 * old periods archive themselves (see couple-growth: memories, not clutter).
 */

export type Horizon = 'week' | 'quarter' | 'year';

/** ISO week number + ISO week-year for a date (UTC-safe math on local calendar date). */
function isoWeekParts(date: Date): { year: number; week: number } {
  // Work on a copy at local midday to dodge DST edges.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  // ISO: Thursday determines the week's year.
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3); // move to Thursday of this week
  const isoYear = d.getFullYear();
  const jan4 = new Date(isoYear, 0, 4, 12);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Thu = new Date(jan4);
  week1Thu.setDate(jan4.getDate() - jan4Day + 3);
  const week = 1 + Math.round((d.getTime() - week1Thu.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: isoYear, week };
}

/** "2026-W28" for the ISO week containing `date`. */
export function weekPeriod(date: Date = new Date()): string {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** "2026-Q3" for the quarter containing `date`. */
export function quarterPeriod(date: Date = new Date()): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

/** "2026" for the year containing `date`. */
export function yearPeriod(date: Date = new Date()): string {
  return String(date.getFullYear());
}

/** Current period string for a horizon. */
export function currentPeriod(horizon: Horizon, date: Date = new Date()): string {
  switch (horizon) {
    case 'week':
      return weekPeriod(date);
    case 'quarter':
      return quarterPeriod(date);
    case 'year':
      return yearPeriod(date);
  }
}

/** One rung up the ladder: week → quarter, quarter → year, year → null. */
export function parentHorizon(horizon: Horizon): Horizon | null {
  return horizon === 'week' ? 'quarter' : horizon === 'quarter' ? 'year' : null;
}

/** One rung down the ladder: year → quarter, quarter → week, week → null. */
export function childHorizon(horizon: Horizon): Horizon | null {
  return horizon === 'year' ? 'quarter' : horizon === 'quarter' ? 'week' : null;
}

/** Monday of the given ISO week, at local midday (DST-safe for day arithmetic). */
export function dateOfIsoWeek(isoYear: number, week: number): Date {
  // Jan 4 is always in ISO week 1; back up to that week's Monday.
  const jan4 = new Date(isoYear, 0, 4, 12);
  const jan4Day = (jan4.getDay() + 6) % 7; // Mon=0..Sun=6
  const d = new Date(isoYear, 0, 4 - jan4Day, 12);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

/**
 * The period one rung up the ladder: "2026-W28" → "2026-Q3", "2026-Q3" → "2026".
 * A week straddling a quarter boundary belongs to its Thursday's quarter (same
 * convention ISO uses for week-years). Returns null for a year period.
 */
export function parentPeriod(period: string): string | null {
  const w = /^(\d{4})-W(\d{2})$/.exec(period);
  if (w) {
    const thursday = dateOfIsoWeek(Number(w[1]), Number(w[2]));
    thursday.setDate(thursday.getDate() + 3);
    return quarterPeriod(thursday);
  }
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return q[1];
  return null;
}

/** The ISO week before `period` — handles year boundaries ("2026-W01" → "2025-W53"). */
export function prevWeekPeriod(period: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(period);
  if (!m) throw new Error(`Not a week period: ${period}`);
  const monday = dateOfIsoWeek(Number(m[1]), Number(m[2]));
  monday.setDate(monday.getDate() - 7);
  return weekPeriod(monday);
}

/** Friendly label: "Week 28" · "Q3 2026" · "2026". */
export function periodLabel(period: string): string {
  const w = /^(\d{4})-W(\d{2})$/.exec(period);
  if (w) return `Week ${Number(w[2])}`;
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return `Q${q[2]} ${q[1]}`;
  return period;
}
