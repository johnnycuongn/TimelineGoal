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
