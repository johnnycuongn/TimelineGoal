import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Lightning CSS is Tailwind's dependency, not ours, and the two can resolve to different
// versions. Reaching for Tailwind's copy is the point: the assertions below are about
// what that exact minifier does to the stylesheet on `vite build`.
const here = createRequire(import.meta.url);
const { transform } = createRequire(here.resolve("@tailwindcss/node"))("lightningcss") as {
  transform: (options: { filename: string; code: Buffer; minify: boolean }) => { code: Buffer };
};

/**
 * Tailwind v4 runs Lightning CSS over the stylesheet on `vite build`, and Lightning CSS
 * folds an individual transform property into a `transform` beside it: `translate: none`
 * written next to `transform: none` leaves only `transform: none` in the bundle. That is
 * silent and only bites in production, so the phone rules are checked the way they ship.
 */
const source = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)));
const shipped = transform({ filename: "styles.css", code: source, minify: true }).code.toString();

function phoneRuleFor(slot: string): string {
  // Lightning CSS prints the query as `max-width:639px` or `width<=639px` depending on
  // the browser targets it is handed, and the phone rules are the only ones behind it.
  const query = "@media ?\\((?:max-width:639px|width<=639px)\\)";
  const block = new RegExp(`${query}\\{[^}]*\\[data-slot=${slot}\\]\\{([^}]*)\\}`);
  const found = block.exec(shipped)?.[1];
  if (found === undefined) {
    throw new Error(`no phone rule for [data-slot=${slot}] survived minification`);
  }
  return found;
}

describe("the bottom-sheet rules survive minification", () => {
  test("dialogs drop the centering translate the utilities carry", () => {
    // Without this the sheet keeps -translate-x-1/2 -translate-y-1/2 and sits half a
    // screen off to the left, which is what shipped to the phones.
    expect(phoneRuleFor("dialog-content")).toContain("translate:none");
  });
});
