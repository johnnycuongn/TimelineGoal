/**
 * How much of the layout viewport the software keyboard is sitting on top of.
 *
 * A bottom sheet is `position: fixed; bottom: 0`, which pins it to the layout viewport
 * — and iOS never shrinks that for the keyboard. Only the visual viewport shrinks, so
 * the sheet stays where it was and the keyboard covers it. Measuring the gap between
 * the two viewports gives the sheet something to sit on.
 */

export interface ViewportMetrics {
  /** Height of the visual viewport: what the person can actually see. */
  height: number;
  /** How far the visual viewport has been pushed down inside the layout viewport. */
  offsetTop: number;
}

interface ViewportEvents {
  addEventListener(type: "resize" | "scroll", listener: () => void): void;
  removeEventListener(type: "resize" | "scroll", listener: () => void): void;
}

export interface ViewportHost {
  /** Height of the layout viewport, which the keyboard leaves alone. */
  innerHeight: number;
  visualViewport: (ViewportMetrics & ViewportEvents) | null;
}

// Safari's own toolbars leave a gap of their own between the two viewports — around
// 50–90px, and no keyboard is that short. Below this the gap is chrome, not a keyboard,
// and lifting the sheet over it would just show a strip of page underneath.
const MIN_KEYBOARD_PX = 120;

export function keyboardInset(layoutHeight: number, viewport: ViewportMetrics | null): number {
  if (!viewport) {
    return 0;
  }
  const covered = layoutHeight - viewport.height - viewport.offsetTop;
  return covered >= MIN_KEYBOARD_PX ? Math.round(covered) : 0;
}

/**
 * Reports the inset on every visual viewport change until the returned function is
 * called. Reports once up front too, so a caller starts from the truth rather than 0.
 */
export function watchKeyboardInset(host: ViewportHost, report: (px: number) => void): () => void {
  const viewport = host.visualViewport;
  if (!viewport) {
    // No visualViewport, no way to see the keyboard: the sheet stays where it is.
    report(0);
    return () => {};
  }
  // Scroll matters as much as resize: iOS moves the visual viewport to reveal the field
  // it just focused, which changes how much of the layout viewport is left underneath.
  const update = () => report(keyboardInset(host.innerHeight, viewport));
  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
  };
}
