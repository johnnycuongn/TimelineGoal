import {
  childHorizon,
  currentPeriod,
  dateOfIsoWeek,
  parentHorizon,
  parentPeriod,
  periodLabel,
  prevWeekPeriod,
  quarterPeriod,
  weekPeriod,
  yearPeriod,
} from './period';

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

describe('the ladder between horizons', () => {
  it('walks horizons up and down', () => {
    expect(parentHorizon('week')).toBe('quarter');
    expect(parentHorizon('quarter')).toBe('year');
    expect(parentHorizon('year')).toBeNull();
    expect(childHorizon('year')).toBe('quarter');
    expect(childHorizon('quarter')).toBe('week');
    expect(childHorizon('week')).toBeNull();
  });

  it('finds the Monday of an ISO week', () => {
    // 2026-W28 runs Mon 6 Jul – Sun 12 Jul 2026.
    const monday = dateOfIsoWeek(2026, 28);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(6);
    expect(monday.getDate()).toBe(6);
    expect(weekPeriod(monday)).toBe('2026-W28');
    // Round-trips at the year boundary: 2026-W01 starts Mon 29 Dec 2025.
    const w1 = dateOfIsoWeek(2026, 1);
    expect(w1.getFullYear()).toBe(2025);
    expect(w1.getDate()).toBe(29);
    expect(weekPeriod(w1)).toBe('2026-W01');
  });

  it('maps a week to its quarter and a quarter to its year', () => {
    expect(parentPeriod('2026-W28')).toBe('2026-Q3');
    expect(parentPeriod('2026-W01')).toBe('2026-Q1');
    expect(parentPeriod('2026-Q3')).toBe('2026');
    expect(parentPeriod('2026')).toBeNull();
  });

  it('assigns a quarter-straddling week by its Thursday', () => {
    // 2026-W27: Mon 29 Jun – Sun 5 Jul. Thursday 2 Jul → Q3.
    expect(parentPeriod('2026-W27')).toBe('2026-Q3');
    // 2026-W14: Mon 30 Mar – Sun 5 Apr. Thursday 2 Apr → Q2.
    expect(parentPeriod('2026-W14')).toBe('2026-Q2');
  });

  it('steps back one week across year boundaries', () => {
    expect(prevWeekPeriod('2026-W28')).toBe('2026-W27');
    expect(prevWeekPeriod('2026-W01')).toBe('2025-W52'); // 2025 has 52 ISO weeks
    expect(prevWeekPeriod('2021-W01')).toBe('2020-W53'); // 2020 had 53
  });

  it('labels periods for humans', () => {
    expect(periodLabel('2026-W08')).toBe('Week 8');
    expect(periodLabel('2026-Q3')).toBe('Q3 2026');
    expect(periodLabel('2026')).toBe('2026');
  });
});
