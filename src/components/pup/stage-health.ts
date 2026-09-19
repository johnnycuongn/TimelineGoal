// Why the 3D pup is not on screen. The stage sits behind an error boundary and a WebGL
// probe, and both used to fail silently: the person just saw "3D isn't available here"
// and we had nothing to go on. Recorded here so the console — and the ?kbdebug probe —
// can say which of the two it was.

let webgl: boolean | null = null;
let stageError: string | null = null;

export function recordWebgl(ok: boolean): void {
  webgl = ok;
}

export function recordStageError(error: unknown): void {
  stageError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("[pup] 3D stage failed, falling back", error);
}

export function stageHealth(): { webgl: boolean | null; stageError: string | null } {
  return { webgl, stageError };
}
