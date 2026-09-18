import { describe, expect, test } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  test("joins plain class names in order", () => {
    expect(cn("island-shell", "p-5")).toBe("island-shell p-5");
  });

  test("drops falsy and empty values", () => {
    expect(cn("nav-link", false, null, undefined, "", 0)).toBe("nav-link");
  });

  test("keeps the last of two conflicting Tailwind utilities", () => {
    expect(cn("px-4", "px-5")).toBe("px-5");
    expect(cn("text-muted-foreground", "text-foreground")).toBe("text-foreground");
  });

  test("keeps utilities that do not conflict", () => {
    expect(cn("min-h-11", "rounded-full", "px-5")).toBe("min-h-11 rounded-full px-5");
  });

  test("lets a caller className override a component default", () => {
    // This is the contract every primitive relies on: cn(variants(), className).
    expect(cn("rounded-full bg-primary", "bg-secondary")).toBe("rounded-full bg-secondary");
  });

  test("resolves conditional objects and nested arrays", () => {
    expect(
      cn(["nav-link", ["font-semibold", "text-sm"]], { "is-active": true, hidden: false }),
    ).toBe("nav-link font-semibold text-sm is-active");
  });

  test("returns an empty string for no usable input", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, false)).toBe("");
  });
});
