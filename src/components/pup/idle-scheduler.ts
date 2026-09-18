// Weighted ambient idle picker. Pure: the stage feeds it Math.random.
export type IdleEntry = readonly [clip: string, weight: number, minSec: number, maxSec: number];

export const IDLE_POOL: readonly IdleEntry[] = [
  ["Idle", 8, 6, 12],
  ["Idle_2", 4, 5, 9],
  ["Eating", 3, 4, 8],
  ["Walk", 3, 3, 6],
];

export const FIRST_HOLD_MS = 4000;
const MS = 1000;

export function pickIdle(
  random: () => number = Math.random,
  pool: readonly IdleEntry[] = IDLE_POOL,
): { clip: string; holdMs: number } {
  const total = pool.reduce((sum, e) => sum + e[1], 0);
  let roll = random() * total;
  const last = pool.at(-1);
  if (!last) {
    throw new Error("Idle pool is empty.");
  }
  let chosen: IdleEntry = last;
  for (const entry of pool) {
    if (roll < entry[1]) {
      chosen = entry;
      break;
    }
    roll -= entry[1];
  }
  const [clip, , minSec, maxSec] = chosen;
  const holdMs = Math.round((minSec + random() * (maxSec - minSec)) * MS);
  return { clip, holdMs };
}
