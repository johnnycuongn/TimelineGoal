import type { TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";

export interface DenDiff {
  partnerStamps: TickerItem[];
  newHeartsOnMine: number;
}

/** What changed between two Den views, from my point of view. */
export function diffDen(prev: DenData | null, next: DenData, me: string): DenDiff {
  if (!prev) {
    return { partnerStamps: [], newHeartsOnMine: 0 };
  }
  const seen = new Map(prev.ticker.map((t) => [t.checkinId, t]));
  const partnerStamps = next.ticker.filter((t) => t.uid !== me && !seen.has(t.checkinId));
  let newHeartsOnMine = 0;
  for (const t of next.ticker) {
    if (t.uid !== me) {
      continue;
    }
    const before = Object.keys(seen.get(t.checkinId)?.reactions ?? {}).length;
    const after = Object.keys(t.reactions).length;
    if (after > before) {
      newHeartsOnMine += after - before;
    }
  }
  return { partnerStamps, newHeartsOnMine };
}
