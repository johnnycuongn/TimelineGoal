import { describe, expect, test } from "vitest";
import {
  keyboardInset,
  type ViewportHost,
  type ViewportMetrics,
  watchKeyboardInset,
} from "@/lib/keyboard-inset";

class FakeViewport extends EventTarget implements ViewportMetrics {
  height: number;
  offsetTop = 0;
  listeners = 0;

  constructor(height: number) {
    super();
    this.height = height;
  }

  override addEventListener(type: string, listener: EventListener) {
    this.listeners += 1;
    super.addEventListener(type, listener);
  }

  override removeEventListener(type: string, listener: EventListener) {
    this.listeners -= 1;
    super.removeEventListener(type, listener);
  }

  resizeTo(height: number) {
    this.height = height;
    this.dispatchEvent(new Event("resize"));
  }
}

describe("keyboardInset", () => {
  test("no keyboard: the two viewports agree", () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
  });

  test("keyboard up: the gap between the viewports", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
  });

  test("a visual viewport pushed down covers that much less of the layout one", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 40 })).toBe(296);
  });

  test("a browser toolbar's worth of gap is not a keyboard", () => {
    expect(keyboardInset(844, { height: 761, offsetTop: 0 })).toBe(0);
  });

  test("a viewport taller than the layout one never reports a negative inset", () => {
    expect(keyboardInset(844, { height: 900, offsetTop: 0 })).toBe(0);
  });

  test("a browser without visualViewport reports nothing to sit on", () => {
    expect(keyboardInset(844, null)).toBe(0);
  });
});

describe("watchKeyboardInset", () => {
  test("reports the inset up front and on every change", () => {
    const viewport = new FakeViewport(844);
    const host: ViewportHost = { innerHeight: 844, visualViewport: viewport };
    const seen: number[] = [];

    const stop = watchKeyboardInset(host, (px) => seen.push(px));
    viewport.resizeTo(508);
    viewport.resizeTo(844);

    expect(seen).toEqual([0, 336, 0]);
    stop();
    expect(viewport.listeners).toBe(0);
  });

  test("a stopped watch goes quiet", () => {
    const viewport = new FakeViewport(844);
    const seen: number[] = [];
    const stop = watchKeyboardInset({ innerHeight: 844, visualViewport: viewport }, (px) =>
      seen.push(px),
    );

    stop();
    viewport.resizeTo(508);

    expect(seen).toEqual([0]);
  });

  test("without visualViewport it reports zero once and stops cleanly", () => {
    const seen: number[] = [];
    const stop = watchKeyboardInset({ innerHeight: 844, visualViewport: null }, (px) =>
      seen.push(px),
    );

    expect(seen).toEqual([0]);
    expect(stop).not.toThrow();
  });
});
