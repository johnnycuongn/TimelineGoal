import { describe, expect, test } from "vitest";
import { isValidShareCode, normalizeShareCode } from "./share-code";

describe("share codes", () => {
  test("normalizeShareCode uppercases and strips spaces and dashes", () => {
    expect(normalizeShareCode(" ab-c d2e ")).toBe("ABCD2E");
  });

  test("isValidShareCode rejects ambiguous glyphs and wrong lengths", () => {
    expect(isValidShareCode("ABCD23")).toBe(true);
    expect(isValidShareCode("ABCD0O")).toBe(false);
    expect(isValidShareCode("ABC")).toBe(false);
    expect(isValidShareCode("abcd23")).toBe(false);
  });
});
