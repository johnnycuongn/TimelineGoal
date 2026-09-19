import type { TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";

export interface DenDiff {
  partnerStamps: TickerItem[];
  newHeartsOnMine: number;
}

/**
 * The newest stamp time in a ticker window, as epoch ms, or `-Infinity` when the
 * window is empty (nothing has been seen yet, so nothing can be stale).
 */
function newestAt(items: TickerItem[]): number {
  let newest = Number.NEGATIVE_INFINITY;
  for (const t of items) {
    const ms = Date.parse(t.at);
    if (!Number.isNaN(ms) && ms > newest) {
      newest = ms;
    }
  }
  return newest;
}

/**
 * The ticker is a fixed-size window over `checkins` ordered `at desc`, so "absent
 * from the previous window" does not mean "new": undoing a paw hard-deletes a row
 * and pulls a check-in from beyond the window into it. `checkins.at` is the server
 * clock at insert, so a genuinely new stamp is never older than the newest stamp we
 * had already seen — that watermark tells the two cases apart.
 */
function isFreshStamp(item: TickerItem, watermark: number): boolean {
  const ms = Date.parse(item.at);
  return Number.isNaN(ms) || ms >= watermark;
}

/** What changed between two Den views, from my point of view. */
export function diffDen(prev: DenData | null, next: DenData, me: string): DenDiff {
  if (!prev) {
    return { partnerStamps: [], newHeartsOnMine: 0 };
  }
  const seen = new Map(prev.ticker.map((t) => [t.checkinId, t]));
  const watermark = newestAt(prev.ticker);
  const partnerStamps = next.ticker.filter(
    (t) => t.uid !== me && !seen.has(t.checkinId) && isFreshStamp(t, watermark),
  );
  let newHeartsOnMine = 0;
  for (const t of next.ticker) {
    const was = seen.get(t.checkinId);
    // A heart needs one of my stamps that was already on screen. An unseen row is
    // either brand new (nobody has had a chance to heart it) or shifted in from
    // beyond the window carrying hearts from days ago — neither is news.
    if (t.uid !== me || !was) {
      continue;
    }
    const before = Object.keys(was.reactions).length;
    const after = Object.keys(t.reactions).length;
    if (after > before) {
      newHeartsOnMine += after - before;
    }
  }
  return { partnerStamps, newHeartsOnMine };
}
