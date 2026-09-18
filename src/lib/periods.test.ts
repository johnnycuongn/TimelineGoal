import { describe, expect, test } from "vitest";
import {
  childHorizon,
  dayKeyFromDate,
  daysBetween,
  daysElapsedInPeriod,
  horizonOfPeriod,
  isDayWithinTolerance,
  isValidDayKey,
  isValidPeriod,
  parentHorizon,
  periodContainsDay,
  periodFor,
  periodLabel,
  periodRange,
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
