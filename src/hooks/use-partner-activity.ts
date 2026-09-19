import { useEffect, useRef } from "react";
import type { Member, TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";
import { diffDen } from "./den-diff";

export function usePartnerActivity(
  data: DenData,
  handlers: {
    onPartnerStamp: (item: TickerItem, member: Member) => void;
    onHeart: (count: number) => void;
  },
): void {
  const prev = useRef<DenData | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const diff = diffDen(prev.current, data, data.me);
    prev.current = data;
    for (const item of diff.partnerStamps) {
      const member = data.members.find((m) => m.id === item.uid);
      if (member) {
        latest.current.onPartnerStamp(item, member);
      }
    }
    if (diff.newHeartsOnMine > 0) {
      latest.current.onHeart(diff.newHeartsOnMine);
    }
  }, [data]);
}
