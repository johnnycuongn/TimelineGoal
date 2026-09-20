import { describe, expect, test } from "vitest";
import {
  CHECKIN_WINDOW_DAYS,
  canPlanPeriod,
  checkinFloor,
  childHorizon,
  dayKeyFromDate,
  dayLabel,
  daysBetween,
  daysElapsedInPeriod,
  horizonOfPeriod,
  isDayWithinTolerance,
  isValidDayKey,
  isValidPeriod,
  parentHorizon,
  periodContainsDay,
  periodContainsPeriod,
  periodFor,
  periodLabel,
  periodRange,
  periodsBetween,
  shiftDay,
  shiftPeriod,
} from "./periods";

describe("day keys", () => {
  test("dayKeyFromDate uses UTC parts", () => {
    expect(dayKeyFromDate(new Date(Date.UTC(2026, 8, 17, 23, 30)))).toBe("2026-09-17");
  });

  test("isValidDayKey", () => {
    expect(isValidDayKey("2026-09-17")).toBe(true);
    expect(isValidDayKey("2026-13-01")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("26-09-17")).toBe(false);
  });

  test("shiftDay crosses month and year ends", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("daysBetween is signed", () => {
    expect(daysBetween("2026-09-01", "2026-09-17")).toBe(16);
    expect(daysBetween("2026-09-17", "2026-09-01")).toBe(-16);
  });

  test("isDayWithinTolerance allows one day either side", () => {
    const now = new Date(Date.UTC(2026, 8, 17, 12));
    expect(isDayWithinTolerance("2026-09-16", now, 1)).toBe(true);
    expect(isDayWithinTolerance("2026-09-18", now, 1)).toBe(true);
    expect(isDayWithinTolerance("2026-09-19", now, 1)).toBe(false);
  });
});

describe("periods", () => {
  test("periodFor", () => {
    expect(periodFor("month", "2026-09-17")).toBe("2026-09");
    expect(periodFor("quarter", "2026-09-17")).toBe("2026-Q3");
    expect(periodFor("quarter", "2026-12-31")).toBe("2026-Q4");
    expect(periodFor("year", "2026-09-17")).toBe("2026");
  });

  test("isValidPeriod and horizonOfPeriod", () => {
    expect(isValidPeriod("2026-09")).toBe(true);
    expect(isValidPeriod("2026-Q3")).toBe(true);
    expect(isValidPeriod("2026")).toBe(true);
    expect(isValidPeriod("2026-Q5")).toBe(false);
    expect(isValidPeriod("2026-00")).toBe(false);
    expect(horizonOfPeriod("2026-09")).toBe("month");
    expect(horizonOfPeriod("2026-Q3")).toBe("quarter");
    expect(horizonOfPeriod("2026")).toBe("year");
  });

  test("periodRange is inclusive", () => {
    expect(periodRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange("2028-02").end).toBe("2028-02-29");
    expect(periodRange("2026-Q3")).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(periodRange("2026")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  test("periodContainsDay", () => {
    expect(periodContainsDay("2026-09", "2026-09-30")).toBe(true);
    expect(periodContainsDay("2026-09", "2026-10-01")).toBe(false);
  });

  test("daysElapsedInPeriod counts through today, capped at the period", () => {
    expect(daysElapsedInPeriod("2026-09", "2026-09-17")).toBe(17);
    expect(daysElapsedInPeriod("2026-09", "2026-10-15")).toBe(30);
    expect(daysElapsedInPeriod("2026-09", "2026-08-15")).toBe(0);
  });

  test("shiftPeriod", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftPeriod("2026", -2)).toBe("2024");
  });

  test("periodLabel", () => {
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
    expect(periodLabel("2026")).toBe("2026");
  });

  test("horizon relations", () => {
    expect(parentHorizon("day")).toBe("month");
    expect(parentHorizon("year")).toBeNull();
    expect(childHorizon("month")).toBe("day");
    expect(childHorizon("day")).toBeNull();
  });
});

/**
 * The fetch floor for check-ins. The bug this guards: the old window started at
 * 1 January of the current year, so a memory in an older period showed 0 paws and
 * every streak reset on New Year's Day.
 */
describe("checkinFloor", () => {
  const TODAY = "2026-09-19";
  const ROLLING = "2025-09-14";

  test("no period on screen: the rolling window, which is more than a year", () => {
    expect(checkinFloor(undefined, TODAY)).toBe(ROLLING);
    expect(daysBetween(checkinFloor(undefined, TODAY), TODAY)).toBe(CHECKIN_WINDOW_DAYS);
    expect(CHECKIN_WINDOW_DAYS).toBeGreaterThan(365);
  });

  test("a period inside the rolling window does not widen it", () => {
    expect(checkinFloor("2026-09", TODAY)).toBe(ROLLING);
    expect(checkinFloor("2026-Q1", TODAY)).toBe(ROLLING);
    expect(checkinFloor("2026", TODAY)).toBe(ROLLING);
  });

  test("an older period widens the floor to 1 January of its year", () => {
    expect(checkinFloor("2025-12", TODAY)).toBe("2025-01-01");
    expect(checkinFloor("2025-Q4", TODAY)).toBe("2025-01-01");
    expect(checkinFloor("2025", TODAY)).toBe("2025-01-01");
    expect(checkinFloor("2019-03", TODAY)).toBe("2019-01-01");
  });

  test("the year boundary is not a cliff: 1 January still reaches back a full year", () => {
    expect(checkinFloor(undefined, "2027-01-01")).toBe("2025-12-27");
    expect(checkinFloor("2027-01", "2027-01-01")).toBe("2025-12-27");
  });

  test("a junk period falls back to the rolling window instead of throwing", () => {
    expect(checkinFloor("not-a-period", TODAY)).toBe(ROLLING);
    expect(checkinFloor("2026-13", TODAY)).toBe(ROLLING);
  });
});

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

  test("periodContainsDay still answers for a day-key period", () => {
    expect(periodContainsDay("2026-11-14", "2026-11-14")).toBe(true);
    expect(periodContainsDay("2026-11-14", "2026-11-15")).toBe(false);
  });

  test("daysElapsedInPeriod treats a day key as a one-day period", () => {
    expect(daysElapsedInPeriod("2026-11-14", "2026-11-13")).toBe(0);
    expect(daysElapsedInPeriod("2026-11-14", "2026-11-14")).toBe(1);
    expect(daysElapsedInPeriod("2026-11-14", "2026-12-01")).toBe(1);
  });

  test("a day that never happened is not a period", () => {
    expect(() => periodRange("2026-02-30")).toThrow("Invalid period");
  });
});

describe("planning ahead", () => {
  test("periodsBetween counts steps of the horizon", () => {
    expect(periodsBetween("2026-09", "2026-11")).toBe(2);
    expect(periodsBetween("2026-11", "2026-09")).toBe(-2);
    expect(periodsBetween("2026-Q3", "2027-Q1")).toBe(2);
    expect(periodsBetween("2026", "2029")).toBe(3);
  });

  test("periodsBetween refuses to compare two different horizons", () => {
    expect(() => periodsBetween("2026-09", "2026-Q3")).toThrow("different horizons");
  });

  test("canPlanPeriod allows any memory and a bounded future", () => {
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
