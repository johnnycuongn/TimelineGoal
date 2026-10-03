import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withTimeout } from "./timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a promise that settles in time gives its value", async () => {
    const quick = new Promise<string>((resolve) => setTimeout(() => resolve("done"), 1000));
    const raced = withTimeout(quick, 3000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(raced).resolves.toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  test("a promise that hangs gives up after the limit with undefined", async () => {
    const hung = new Promise<string>(() => undefined);
    let settled = false;
    const raced = withTimeout(hung, 3000).then((value) => {
      settled = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(raced).resolves.toBeUndefined();
  });

  test("a rejection inside the limit still rejects", async () => {
    const failing = Promise.reject(new Error("nope"));
    await expect(withTimeout(failing, 3000)).rejects.toThrow("nope");
    expect(vi.getTimerCount()).toBe(0);
  });
});
