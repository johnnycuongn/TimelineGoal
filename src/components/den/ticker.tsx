import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";
import PartnerDot, { colorFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import type { Member, TickerItem } from "@/lib/domain";
import { springs } from "@/lib/motion";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function timeAgo(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / MINUTE_MS));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / HOURS_PER_DAY)} d ago`;
}

function HeartsOnMine({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <Heart
      aria-label={`${count} heart from your partner`}
      className="size-5 fill-primary text-primary"
    />
  );
}

function TickerRow({
  item,
  member,
  me,
  now,
  onHeart,
}: {
  item: TickerItem;
  member: Member;
  me: string;
  now: Date;
  onHeart: (item: TickerItem) => void;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const mine = item.uid === me;
  const hearted = Boolean(item.reactions[me]);
  const onClick = useCallback(() => onHeart(item), [onHeart, item]);
  return (
    <li className="flex items-center gap-3">
      <PartnerDot color={member.color} label={member.displayName} />
      <p className="m-0 min-w-0 flex-1 text-sm">
        <span className="font-semibold" style={{ color: colorFor(member.color, theme) }}>
          {mine ? "You" : member.displayName}
        </span>
        {" stamped "}
        <span className="font-semibold">
          {item.charm ? `${item.charm} ` : ""}
          {item.goalTitle}
        </span>
        <span className="text-muted-foreground"> · {timeAgo(item.at, now)}</span>
      </p>
      {mine ? (
        <HeartsOnMine count={Object.keys(item.reactions).length} />
      ) : (
        <motion.button
          aria-label={hearted ? "You sent a heart" : `Send ${member.displayName} a heart`}
          aria-pressed={hearted}
          className="flex size-11 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={hearted}
          onClick={onClick}
          transition={springs.bouncy}
          type="button"
          whileTap={reduced ? undefined : { scale: 1.3 }}
        >
          <Heart className="size-5" fill={hearted ? "currentColor" : "none"} />
        </motion.button>
      )}
    </li>
  );
}

export default function Ticker({
  items,
  members,
  me,
  onHeart,
}: {
  items: TickerItem[];
  members: Member[];
  me: string;
  onHeart: (item: TickerItem) => void;
}) {
  const now = new Date();
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No paw prints yet. The first one is always the cutest.
      </p>
    );
  }
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {items.map((item) => {
        const member = members.find((m) => m.id === item.uid);
        return member ? (
          <TickerRow
            item={item}
            key={item.checkinId}
            me={me}
            member={member}
            now={now}
            onHeart={onHeart}
          />
        ) : null;
      })}
    </ul>
  );
}
