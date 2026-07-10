import { currentPeriod, quarterPeriod, weekPeriod, yearPeriod } from './period';

describe('weekPeriod (ISO 8601)', () => {
  it('computes a mid-year week', () => {
    expect(weekPeriod(new Date(2026, 6, 10))).toBe('2026-W28'); // Fri 10 Jul 2026
  });

  it('assigns early January to the previous ISO year when appropriate', () => {
    // Thu 1 Jan 2026 is ISO 2026-W01; but Fri 1 Jan 2021 was ISO 2020-W53.
    expect(weekPeriod(new Date(2021, 0, 1))).toBe('2020-W53');
    expect(weekPeriod(new Date(2026, 0, 1))).toBe('2026-W01');
  });

  it('assigns late December to the next ISO year when appropriate', () => {
    // Mon 29 Dec 2025 belongs to ISO 2026-W01.
    expect(weekPeriod(new Date(2025, 11, 29))).toBe('2026-W01');
  });

  it('pads single-digit weeks', () => {
    expect(weekPeriod(new Date(2026, 1, 3))).toBe('2026-W06');
  });
});

describe('quarter and year periods', () => {
  it('computes quarters', () => {
    expect(quarterPeriod(new Date(2026, 0, 15))).toBe('2026-Q1');
    expect(quarterPeriod(new Date(2026, 6, 10))).toBe('2026-Q3');
    expect(quarterPeriod(new Date(2026, 11, 31))).toBe('2026-Q4');
  });

  it('computes years and routes via currentPeriod', () => {
    expect(yearPeriod(new Date(2026, 6, 10))).toBe('2026');
    expect(currentPeriod('week', new Date(2026, 6, 10))).toBe('2026-W28');
    expect(currentPeriod('quarter', new Date(2026, 6, 10))).toBe('2026-Q3');
    expect(currentPeriod('year', new Date(2026, 6, 10))).toBe('2026');
  });
});
