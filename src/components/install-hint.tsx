import { Share, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIos, useIsStandalone } from "@/hooks/use-is-standalone";

const DISMISS_KEY = "couplegoal.install-hint.dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** iOS has no install prompt API; the hint explains the Share → Add to Home Screen route. */
export default function InstallHint() {
  const standalone = useIsStandalone();
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: the hint simply comes back next visit.
    }
  }, []);
  if (standalone || dismissed || !isIos()) {
    return null;
  }
  return (
    <aside className="island-shell mb-6 flex items-start gap-3 p-4">
      <Share aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="m-0 flex-1 text-sm">
        Keep us on your Home Screen: tap <strong>Share</strong>, then{" "}
        <strong>Add to Home Screen</strong>.
      </p>
      <Button aria-label="Dismiss" onClick={dismiss} size="icon" type="button" variant="ghost">
        <X className="size-5" />
      </Button>
    </aside>
  );
}
