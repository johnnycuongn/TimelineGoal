import { beforeEach, describe, expect, test, vi } from "vitest";

/** What PostgREST hands back at most, however wide a range you ask for. */
const SERVER_MAX_ROWS = 1000;

interface Range {
  from: number;
  to: number;
}

interface Result {
  data: unknown;
  error: unknown;
  count: number | null;
}

interface Stub {
  rows: Record<string, unknown>[];
  /** false when the server answers without a row count. */
  count?: boolean;
  error?: { message: string };
}

interface FakeChain {
  select: (...args: unknown[]) => FakeChain;
  eq: (...args: unknown[]) => FakeChain;
  gte: (...args: unknown[]) => FakeChain;
  order: (...args: unknown[]) => FakeChain;
  range: (from: number, to: number) => FakeChain;
  single: () => Promise<Result>;
  then: <T>(onFulfilled: (value: Result) => T) => Promise<T>;
}

let stubs: Record<string, Stub> = {};
let ranges: Record<string, Range[]> = {};

function countOf(stub: Stub): number | null {
  return stub.count === false ? null : stub.rows.length;
}

function respondList(table: string, range: Range | null): Result {
  const stub = stubs[table] ?? { rows: [] };
  if (stub.error) {
    return { data: null, error: stub.error, count: null };
  }
  if (range === null) {
    return { data: stub.rows, error: null, count: countOf(stub) };
  }
  ranges[table] = [...(ranges[table] ?? []), range];
  const width = Math.min(range.to - range.from + 1, SERVER_MAX_ROWS);
  return {
    data: stub.rows.slice(range.from, range.from + width),
    error: null,
    count: countOf(stub),
  };
}

function respondSingle(table: string): Result {
  const stub = stubs[table] ?? { rows: [] };
  if (stub.error) {
    return { data: null, error: stub.error, count: null };
  }
  return { data: stub.rows[0] ?? null, error: null, count: countOf(stub) };
}

function chainFor(table: string): FakeChain {
  let range: Range | null = null;
  const chain: FakeChain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    range: (from, to) => {
      range = { from, to };
      return chain;
    },
    single: () => Promise.resolve(respondSingle(table)),
    // biome-ignore lint/suspicious/noThenProperty: a query builder is a thenable; so is its stand-in.
    then: (onFulfilled) => Promise.resolve(respondList(table, range)).then(onFulfilled),
  };
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => chainFor(table) },
}));

const { fetchCoupleData } = await import("./queries");

const COUPLE = "c1";
const A = "a";
const B = "b";

function checkinRows(n: number): Record<string, unknown>[] {
  // Newest first, as the query orders them, so row n - 1 is the year's oldest paw.
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    couple_id: COUPLE,
    goal_id: "walk",
    user_id: i % 2 === 0 ? A : B,
    day: "2026-09-17",
    horizon: "day",
    at: `2026-09-17T09:00:00.000Z`,
  }));
}

function heartRows(checkins: Record<string, unknown>[]): Record<string, unknown>[] {
  return checkins.map((c) => ({
    checkin_id: c.id,
    user_id: c.user_id === A ? B : A,
    couple_id: COUPLE,
    kind: "heart",
    created_at: "2026-09-17T10:00:00.000Z",
  }));
}

beforeEach(() => {
  ranges = {};
  stubs = {
    couples: {
      rows: [
        {
          id: COUPLE,
          pup_name: "Mochi",
          anniversary: null,
          invite_code: null,
          created_by: A,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    members: {
      rows: [
        {
          user_id: A,
          couple_id: COUPLE,
          display_name: "Ann",
          color: "rose",
          joined_at: "2026-01-01T00:00:00.000Z",
        },
        {
          user_id: B,
          couple_id: COUPLE,
          display_name: "Bo",
          color: "teal",
          joined_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    },
    goals: { rows: [] },
    goal_seals: { rows: [] },
    checkins: { rows: [] },
    reactions: { rows: [] },
  };
});

describe("fetchCoupleData", () => {
  test("pages past the row cap, so a busy year keeps its oldest paw prints", async () => {
    // Three shared daily habits stamped by both partners for a year.
    stubs.checkins = { rows: checkinRows(2190) };
    const data = await fetchCoupleData(COUPLE, "2026-01-01");
    expect(data.checkins).toHaveLength(2190);
    expect(data.checkins.at(-1)?.id).toBe("p2189");
    expect(ranges.checkins).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
    ]);
  });

  test("hearts are paged too, so none of them go missing", async () => {
    const rows = checkinRows(1200);
    stubs.checkins = { rows };
    stubs.reactions = { rows: heartRows(rows) };
    const data = await fetchCoupleData(COUPLE, "2026-01-01");
    expect(ranges.reactions).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(data.checkins.every((c) => Object.keys(c.reactions).length === 1)).toBe(true);
  });

  test("a quiet den costs one page per growing table", async () => {
    const rows = checkinRows(3);
    stubs.checkins = { rows };
    stubs.reactions = { rows: heartRows(rows.slice(0, 1)) };
    const data = await fetchCoupleData(COUPLE, "2026-01-01");
    expect(data.checkins).toHaveLength(3);
    expect(ranges.checkins).toEqual([{ from: 0, to: 999 }]);
    expect(ranges.reactions).toEqual([{ from: 0, to: 999 }]);
  });

  test("a server that reports no count is paged until a page comes back empty", async () => {
    stubs.checkins = { rows: checkinRows(1000), count: false };
    const data = await fetchCoupleData(COUPLE, "2026-01-01");
    expect(data.checkins).toHaveLength(1000);
    expect(ranges.checkins).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  test("an error on a paged table is thrown, not swallowed", async () => {
    stubs.checkins = { rows: [], error: { message: "no paw prints for you" } };
    await expect(fetchCoupleData(COUPLE, "2026-01-01")).rejects.toThrow("no paw prints for you");
  });
});
