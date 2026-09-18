import type { Goal, Horizon } from "./domain";
import { parentHorizon, periodFor } from "./periods";

/** Active goals one horizon up from `horizon`, in the period that contains `today`. */
export function parentCandidates(goals: Goal[], horizon: Horizon, today: string): Goal[] {
  const up = parentHorizon(horizon);
  if (!up || up === "day") {
    return [];
  }
  const period = periodFor(up, today);
  return goals.filter((g) => g.horizon === up && g.period === period && g.archivedAt === null);
}
