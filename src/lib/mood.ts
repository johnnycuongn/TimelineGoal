// The pup's persistent mood. Derived on the client from Den data and local
// time, so the database knows nothing about moods.
export const SLEEPY_HOUR = 20;
export const POUT_AFTER_DAYS = 3;
const MS_PER_DAY = 86_400_000;

export type PersistentMood = "idle" | "sleepy" | "pout";

// A couple with no check-ins yet (lastCheckInAt null) stays idle: a brand-new
// den should never open on a sleepy or pouting pup.
export function derivePersistentMood(input: {
  lastCheckInAt: string | null;
  todayCount: number;
  now: Date;
}): PersistentMood {
  const { lastCheckInAt, todayCount, now } = input;
  if (lastCheckInAt) {
    const quietDays = (now.getTime() - new Date(lastCheckInAt).getTime()) / MS_PER_DAY;
    if (quietDays >= POUT_AFTER_DAYS) {
      return "pout";
    }
    if (todayCount === 0 && now.getHours() >= SLEEPY_HOUR) {
      return "sleepy";
    }
  }
  return "idle";
}
