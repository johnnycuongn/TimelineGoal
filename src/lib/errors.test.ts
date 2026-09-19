import { describe, expect, test } from "vitest";
import { friendlyError, isDuplicate } from "./errors";

describe("friendlyError", () => {
  test("never leaks a check-constraint message from Postgres", () => {
    const pgError = {
      code: "23514",
      message: 'new row for relation "couples" violates check constraint "couples_pup_name_check"',
    };
    const copy = friendlyError(pgError);
    expect(copy).toBe("That didn't fit. Have another look and try again?");
    expect(copy).not.toContain("constraint");
  });

  test("maps duplicates and network failures to their own copy", () => {
    expect(friendlyError({ code: "23505", message: "duplicate key value" })).toBe(
      "Already stamped.",
    );
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe(
      "We couldn't reach the den. Check your connection and try again.",
    );
    expect(friendlyError({ message: "Failed to fetch" })).toBe(
      "We couldn't reach the den. Check your connection and try again.",
    );
  });

  test("reads an offline failure through postgrest's re-shaped error", () => {
    const offline = "We couldn't reach the den. Check your connection and try again.";
    // What postgrest-js hands the client when the fetch itself never leaves the phone.
    expect(friendlyError({ message: "TypeError: Failed to fetch", details: "", code: "" })).toBe(
      offline,
    );
    expect(friendlyError({ message: "FetchError: fetch failed" })).toBe(offline);
    // Safari says "Load failed" instead, and node-fetch names the error rather than the message.
    expect(friendlyError({ message: "TypeError: Load failed" })).toBe(offline);
    expect(friendlyError({ name: "FetchError", message: "request to ... failed" })).toBe(offline);
  });

  test("passes a database rule's own wording straight through", () => {
    expect(friendlyError({ message: "That code isn't waiting for anyone." })).toBe(
      "That code isn't waiting for anyone.",
    );
    expect(friendlyError(null)).toBe("That didn't land. Try again?");
  });

  test("a caller's fallback only covers an error with nothing to say", () => {
    const paw = "That paw didn't land. Try again?";
    // Nothing usable in the error: the caller's own voice, not the generic line.
    expect(friendlyError(null, paw)).toBe(paw);
    expect(friendlyError({}, paw)).toBe(paw);
    expect(friendlyError("stringly thrown", paw)).toBe(paw);
    // A failure we have copy for always wins over the fallback.
    expect(friendlyError(new TypeError("Failed to fetch"), paw)).toBe(
      "We couldn't reach the den. Check your connection and try again.",
    );
    expect(friendlyError({ message: "TypeError: Failed to fetch", code: "" }, paw)).toBe(
      "We couldn't reach the den. Check your connection and try again.",
    );
    expect(friendlyError({ code: "23514", message: "violates check constraint" }, paw)).toBe(
      "That didn't fit. Have another look and try again?",
    );
    // Copy that already came through friendlyError once survives a second pass.
    expect(friendlyError(new Error("We haven't found your den yet."), paw)).toBe(
      "We haven't found your den yet.",
    );
  });

  test("isDuplicate only matches 23505", () => {
    expect(isDuplicate({ code: "23505" })).toBe(true);
    expect(isDuplicate({ code: "23514" })).toBe(false);
  });
});

/** Every user-facing toast has to go through friendlyError, not print the error itself. */
describe("no toast prints a raw error", () => {
  const RAW_TOAST = /toast\.error\([^;]*?\.message/;
  const RAW_MESSAGE = /instanceof Error \?[^;]*?\.message/;

  // Every source file in src/, read as text, test files excluded.
  const modules = import.meta.glob("../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const sources = Object.entries(modules).filter(([path]) => !path.includes(".test."));

  function offenders(pattern: RegExp): string[] {
    return sources.filter(([, source]) => pattern.test(source)).map(([path]) => path);
  }

  test("there is something to scan", () => {
    expect(sources.length).toBeGreaterThan(40);
  });

  test("toast.error never reads .message off the error", () => {
    expect(offenders(RAW_TOAST)).toEqual([]);
  });

  test("the diagnostics panel is the only place that shows an error verbatim", () => {
    // error-panel.tsx prints the message in a <pre> under friendly prose, on purpose.
    expect(offenders(RAW_MESSAGE)).toEqual(["../components/error-panel.tsx"]);
  });
});
