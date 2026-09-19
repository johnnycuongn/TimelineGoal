import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/day";

const MINUTE_MS = 60_000;

/** The visitor's local day, kept current across midnight and app resumes. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDayKey());
  useEffect(() => {
    const tick = () => setToday(localDayKey());
    const id = window.setInterval(tick, MINUTE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}
