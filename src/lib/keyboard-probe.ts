// TEMPORARY diagnostic, opt-in via ?kbdebug=1. Prints what the keyboard is actually
// doing to the viewport on a real phone, because iOS is the one place we cannot drive
// a software keyboard from a test. Delete once the bottom-sheet bug is understood.
import { keyboardInset } from "@/lib/keyboard-inset";

const TICK_MS = 250;

export function startKeyboardProbe(): void {
  const box = document.createElement("pre");
  box.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "z-index:99999",
    "margin:0",
    "padding:6px 8px",
    "font:11px/1.35 ui-monospace,monospace",
    "color:#fff",
    "background:rgba(0,0,0,.78)",
    "pointer-events:none",
    "white-space:pre",
  ].join(";");
  document.body.appendChild(box);

  // Counted separately from the numbers: if these stay at 0 while the keyboard is up,
  // the events never fire here and no amount of correct arithmetic would have helped.
  let resizes = 0;
  let scrolls = 0;
  const vv = window.visualViewport;
  vv?.addEventListener("resize", () => {
    resizes += 1;
  });
  vv?.addEventListener("scroll", () => {
    scrolls += 1;
  });
  let focused = "none";
  document.addEventListener("focusin", (e) => {
    focused = (e.target as HTMLElement)?.id || (e.target as HTMLElement)?.tagName || "?";
  });

  const draw = () => {
    const sheet = document.querySelector('[data-slot="dialog-content"]');
    const rect = sheet?.getBoundingClientRect();
    const cssVar = getComputedStyle(document.documentElement)
      .getPropertyValue("--keyboard-inset")
      .trim();
    box.textContent = [
      "kb-probe 1",
      `standalone ${String(window.matchMedia("(display-mode: standalone)").matches)}`,
      `inner  ${window.innerHeight}`,
      vv
        ? `vv     h=${Math.round(vv.height)} top=${Math.round(vv.offsetTop)} page=${Math.round(vv.pageTop)} s=${vv.scale.toFixed(2)}`
        : "vv     MISSING",
      `scrollY ${Math.round(window.scrollY)}`,
      `events r=${resizes} s=${scrolls}`,
      `inset  ${vv ? keyboardInset(window.innerHeight, vv) : "n/a"}`,
      `cssvar ${cssVar || "(unset)"}`,
      rect ? `sheet  top=${Math.round(rect.top)} bot=${Math.round(rect.bottom)}` : "sheet  none",
      `focus  ${focused}`,
    ].join("\n");
  };
  draw();
  // Polled, not event-driven: the numbers have to be visible even if no event fires.
  window.setInterval(draw, TICK_MS);
}
