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

  test("passes a database rule's own wording straight through", () => {
    expect(friendlyError({ message: "That code isn't waiting for anyone." })).toBe(
      "That code isn't waiting for anyone.",
    );
    expect(friendlyError(null)).toBe("That didn't land. Try again?");
  });

  test("isDuplicate only matches 23505", () => {
    expect(isDuplicate({ code: "23505" })).toBe(true);
    expect(isDuplicate({ code: "23514" })).toBe(false);
  });
});
