import { useEffect, useState } from "react";

const IOS_RE = /iphone|ipad|ipod/i;

export function isIos(): boolean {
  return (
    IOS_RE.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** True when running as an installed app (home screen), not in a browser tab. */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const nav = navigator as Navigator & { standalone?: boolean };
  return standalone || nav.standalone === true;
}
