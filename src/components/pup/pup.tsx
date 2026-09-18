import { Dog } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Component, lazy, type ReactNode, Suspense, useState } from "react";
import { cn } from "@/lib/utils";

const PupStage = lazy(() => import("./pup-stage"));

interface BoundaryState {
  failed: boolean;
}

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// R3F builds the renderer inside a floating promise (Canvas's `run()` is async and
// is called un-awaited), so a failed WebGL context surfaces as an unhandled
// rejection that no error boundary can see. Probe once up front instead.
//
// three 0.186's WebGLRenderer only ever asks for a "webgl2" context, so this
// probe must ask for exactly that: a browser with WebGL 1 but no WebGL 2 (the
// flag disabled, a locked-down policy, an old WebView) would otherwise pass the
// probe and then fail renderer construction, leaving the silent empty canvas
// this probe exists to prevent.
let webglOk: boolean | null = null;

function supportsWebGL(): boolean {
  if (webglOk === null) {
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      webglOk = gl !== null;
    } catch {
      webglOk = false;
    }
  }
  return webglOk;
}

function Skeleton() {
  return <div className="h-full w-full animate-pulse rounded-3xl bg-muted" />;
}

function Resting({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
      <Dog aria-hidden="true" className="size-12" />
      <p className="m-0">{name} is napping (3D isn't available here).</p>
    </div>
  );
}

export default function Pup({ name, className }: { name: string; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  const [webgl] = useState(supportsWebGL);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form controls; this groups a canvas
    <div
      aria-label={`${name}, your pup`}
      className={cn("relative h-[300px] w-full sm:h-[380px]", className)}
      role="group"
    >
      {webgl ? (
        <StageBoundary fallback={<Resting name={name} />}>
          <Suspense fallback={<Skeleton />}>
            <PupStage reducedMotion={reduced} />
          </Suspense>
        </StageBoundary>
      ) : (
        <Resting name={name} />
      )}
    </div>
  );
}
