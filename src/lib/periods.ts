// Day keys are "YYYY-MM-DD"; periods are "YYYY-MM", "YYYY-Qn" or "YYYY".
// All arithmetic runs on UTC dates built from the key parts, so results never
// depend on the machine's timezone. The browser decides what "today" is.
import { HORIZONS, type Horizon, type MilestoneHorizon } from "./domain";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const QUARTER_RE = /^(\d{4})-Q([1-4])$/;
const YEAR_RE = /^(\d{4})$/;
const MS_PER_DAY = 86_400_000;
const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_YEAR = 12;
const YEAR_KEY_LENGTH = 4;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const pad = (n: number): string => String(n).padStart(2, "0");

function toUtc(day: string): Date {
  const match = DAY_RE.exec(day);
  if (!match) {
    throw new Error(`Invalid day key: ${day}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function dayKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isValidDayKey(value: string): boolean {
  if (!DAY_RE.test(value)) {
    return false;
  }
  return dayKeyFromDate(toUtc(value)) === value;
}

export function shiftDay(day: string, delta: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKeyFromDate(date);
}

/** Signed number of days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / MS_PER_DAY);
}

export function isDayWithinTolerance(day: string, now: Date, toleranceDays: number): boolean {
  if (!isValidDayKey(day)) {
    return false;
  }
  return Math.abs(daysBetween(dayKeyFromDate(now), day)) <= toleranceDays;
}

export function periodFor(horizon: MilestoneHorizon, day: string): string {
  const date = toUtc(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (horizon === "month") {
    return `${year}-${pad(month)}`;
  }
  if (horizon === "quarter") {
    return `${year}-Q${Math.ceil(month / MONTHS_PER_QUARTER)}`;
  }
  return String(year);
}

export function isValidPeriod(value: string): boolean {
  const month = MONTH_RE.exec(value);
  if (month) {
    const m = Number(month[2]);
    return m >= 1 && m <= MONTHS_PER_YEAR;
  }
  return QUARTER_RE.test(value) || YEAR_RE.test(value);
}

export function horizonOfPeriod(period: string): MilestoneHorizon {
  if (MONTH_RE.test(period)) {
    return "month";
  }
  if (QUARTER_RE.test(period)) {
    return "quarter";
  }
  if (YEAR_RE.test(period)) {
    return "year";
  }
  throw new Error(`Invalid period: ${period}`);
}

/** First and last month (1-based) of a period, with its year. */
function monthSpan(period: string): { year: number; first: number; last: number } {
  const month = MONTH_RE.exec(period);
  if (month) {
    const m = Number(month[2]);
    return { year: Number(month[1]), first: m, last: m };
  }
  const quarter = QUARTER_RE.exec(period);
  if (quarter) {
    const q = Number(quarter[2]);
    const first = (q - 1) * MONTHS_PER_QUARTER + 1;
    return { year: Number(quarter[1]), first, last: first + MONTHS_PER_QUARTER - 1 };
  }
  const year = YEAR_RE.exec(period);
  if (year) {
    return { year: Number(year[1]), first: 1, last: MONTHS_PER_YEAR };
  }
  throw new Error(`Invalid period: ${period}`);
}

export function periodRange(period: string): { start: string; end: string } {
  const { year, first, last } = monthSpan(period);
  const start = new Date(Date.UTC(year, first - 1, 1));
  // Day 0 of the following month is the last day of `last`.
  const end = new Date(Date.UTC(year, last, 0));
  return { start: dayKeyFromDate(start), end: dayKeyFromDate(end) };
}

export function periodContainsDay(period: string, day: string): boolean {
  const { start, end } = periodRange(period);
  return day >= start && day <= end;
}

/** Days from the period start through `today`, clamped to [0, length]. */
export function daysElapsedInPeriod(period: string, today: string): number {
  const { start, end } = periodRange(period);
  if (today < start) {
    return 0;
  }
  const last = today < end ? today : end;
  return daysBetween(start, last) + 1;
}

export function shiftPeriod(period: string, delta: number): string {
  const horizon = horizonOfPeriod(period);
  const { year, first } = monthSpan(period);
  if (horizon === "year") {
    return String(year + delta);
  }
  const step = horizon === "month" ? 1 : MONTHS_PER_QUARTER;
  const date = new Date(Date.UTC(year, first - 1 + delta * step, 1));
  return periodFor(horizon, dayKeyFromDate(date));
}

export function periodLabel(period: string): string {
  const horizon = horizonOfPeriod(period);
  const { year, first } = monthSpan(period);
  if (horizon === "month") {
    return `${MONTH_NAMES[first - 1]} ${year}`;
  }
  if (horizon === "quarter") {
    return `Q${Math.ceil(first / MONTHS_PER_QUARTER)} ${year}`;
  }
  return String(year);
}

export function parentHorizon(horizon: Horizon): Horizon | null {
  const index = HORIZONS.indexOf(horizon);
  return HORIZONS[index + 1] ?? null;
}

export function childHorizon(horizon: Horizon): Horizon | null {
  const index = HORIZONS.indexOf(horizon);
  return index > 0 ? (HORIZONS[index - 1] ?? null) : null;
}

/**
 * How much check-in history one fetch carries: a rolling year plus a few days, so
 * 1 January is not a cliff for a streak or a 7-day strip.
 */
export const CHECKIN_WINDOW_DAYS = 370;

/**
 * The earliest day a page needs check-ins for. Always the rolling window, and —
 * when the PeriodPicker has been walked into an older period — 1 January of that
 * period's year as well, so a memory shows the paws it actually collected instead
 * of an empty progress bar. The whole year is taken rather than the period itself
 * so stepping month by month inside one year does not refetch every step.
 */
export function checkinFloor(viewedPeriod: string | undefined, today: string): string {
  const rolling = shiftDay(today, -CHECKIN_WINDOW_DAYS);
  if (viewedPeriod === undefined || !isValidPeriod(viewedPeriod)) {
    return rolling;
  }
  const { start } = periodRange(viewedPeriod.slice(0, YEAR_KEY_LENGTH));
  return start < rolling ? start : rolling;
}
