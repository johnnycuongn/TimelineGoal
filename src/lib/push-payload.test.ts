import { describe, expect, test } from "vitest";
import { notificationFromPush, safePath } from "./push-payload";

describe("safePath", () => {
  test("keeps an in-app path", () => {
    expect(safePath("/goals")).toBe("/goals");
  });

  test("keeps the query and hash of an in-app path", () => {
    expect(safePath("/goals?x=1#y")).toBe("/goals?x=1#y");
  });

  test("checks against the origin it is given", () => {
    expect(safePath("/den", "https://couplegoal.example")).toBe("/den");
    expect(safePath("//couplegoal.example.evil/x", "https://couplegoal.example")).toBe("/den");
  });

  test.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example/phish",
    // The URL parser strips tab, CR and LF, so these become `//evil.com`.
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\\evil.com",
    "javascript:alert(1)",
    "goals",
    "",
    42,
    null,
    undefined,
  ])("sends %s to the den", (bad) => {
    expect(safePath(bad)).toBe("/den");
  });
});

describe("notificationFromPush", () => {
  test("reads a well-formed payload", () => {
    const text = JSON.stringify({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: "paws-2026-10-03",
    });
    expect(notificationFromPush(text)).toEqual({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: "paws-2026-10-03",
    });
  });

  test("an empty push still says something", () => {
    expect(notificationFromPush(null)).toEqual({
      title: "CoupleGoal",
      body: "Something happened in your den.",
      url: "/den",
      tag: undefined,
    });
  });

  test("a non-JSON push is shown as plain text", () => {
    expect(notificationFromPush("Hello")).toEqual({
      title: "CoupleGoal",
      body: "Hello",
      url: "/den",
      tag: undefined,
    });
  });

  test("wrong field types fall back field by field, and an off-site url is refused", () => {
    const text = JSON.stringify({ title: 5, body: "Hi", url: "https://evil.example", tag: [] });
    expect(notificationFromPush(text)).toEqual({
      title: "CoupleGoal",
      body: "Hi",
      url: "/den",
      tag: undefined,
    });
  });
});
