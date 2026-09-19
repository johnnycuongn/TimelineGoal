// The pup's persistent mood. Derived on the client from Den data and local
// time, so the database knows nothing about moods.
export const SLEEPY_HOUR = 20;
/** The pup starts settling at 21:00 and is flat out from 22:00 until 06:00. */
export const DROWSY_HOUR = 21;
export const RESTING_HOUR = 22;
export const MORNING_HOUR = 6;
export const POUT_AFTER_DAYS = 3;
const MS_PER_DAY = 86_400_000;

export type PersistentMood = "idle" | "sleepy" | "pout" | "drowsy" | "resting";

// A couple with no check-ins yet (lastCheckInAt null) stays idle: a brand-new
// den should never open on a sleepy or pouting pup.
export function derivePersistentMood(input: {
  lastCheckInAt: string | null;
  todayCount: number;
  now: Date;
}): PersistentMood {
  const { lastCheckInAt, todayCount, now } = input;
  const hour = now.getHours();
  const quietDays = lastCheckInAt
    ? (now.getTime() - new Date(lastCheckInAt).getTime()) / MS_PER_DAY
    : 0;
  if (lastCheckInAt && quietDays >= POUT_AFTER_DAYS) {
    // A pup with three quiet days behind it sulks through the night too.
    return "pout";
  }
  // Bedtime reads the clock and nothing else. There is no reproach in it, so unlike
  // sleepy and pout it applies to a brand-new den as much as an old one.
  if (hour >= RESTING_HOUR || hour < MORNING_HOUR) {
    return "resting";
  }
  if (hour >= DROWSY_HOUR) {
    return "drowsy";
  }
  if (lastCheckInAt && todayCount === 0 && hour >= SLEEPY_HOUR) {
    return "sleepy";
  }
  return "idle";
}
