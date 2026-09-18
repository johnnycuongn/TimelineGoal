import { describe, expect, test } from "vitest";
import { DISPLAY_NAME_MAX, denNamesReady, isPartnerColorKey, PUP_NAME_MAX } from "./domain";

describe("denNamesReady", () => {
  test("rejects an empty or whitespace-only name on either side", () => {
    expect(denNamesReady("", "Ari")).toBe(false);
    expect(denNamesReady("   ", "Ari")).toBe(false);
    expect(denNamesReady("Mochi", "")).toBe(false);
    expect(denNamesReady("Mochi", "\t ")).toBe(false);
  });

  test("accepts trimmable names within both column limits", () => {
    expect(denNamesReady(" Mochi ", " Ari ")).toBe(true);
    expect(denNamesReady("M".repeat(PUP_NAME_MAX), "A".repeat(DISPLAY_NAME_MAX))).toBe(true);
  });

  test("rejects names past the column limits", () => {
    expect(denNamesReady("M".repeat(PUP_NAME_MAX + 1), "Ari")).toBe(false);
    expect(denNamesReady("Mochi", "A".repeat(DISPLAY_NAME_MAX + 1))).toBe(false);
  });
});

describe("isPartnerColorKey", () => {
  test("only the seven palette keys pass", () => {
    expect(isPartnerColorKey("rose")).toBe(true);
    expect(isPartnerColorKey("puce")).toBe(false);
  });
});
