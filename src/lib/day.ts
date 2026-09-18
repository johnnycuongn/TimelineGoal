const pad = (n: number): string => String(n).padStart(2, "0");

/** Today's key in the visitor's local time zone. */
export function localDayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
