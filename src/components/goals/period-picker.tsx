import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { canPlanPeriod, periodLabel, shiftPeriod } from "@/lib/periods";

function note(period: string, current: string): string | null {
  if (period === current) {
    return null;
  }
  return period < current ? "memory" : "ahead";
}

export default function PeriodPicker({
  period,
  current,
  today,
  onChange,
}: {
  period: string;
  current: string;
  today: string;
  onChange: (period: string) => void;
}) {
  const earlier = useCallback(() => onChange(shiftPeriod(period, -1)), [onChange, period]);
  const later = useCallback(() => onChange(shiftPeriod(period, 1)), [onChange, period]);
  // Looking back is unbounded — every memory is worth keeping. Looking forward stops
  // where planning turns into wandering.
  const canGoLater = canPlanPeriod(shiftPeriod(period, 1), today);
  const mark = note(period, current);
  return (
    <div className="flex items-center gap-1">
      <Button aria-label="Earlier" onClick={earlier} size="icon" type="button" variant="ghost">
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-[9rem] text-center font-heading text-lg">
        {periodLabel(period)}
        {mark ? <span className="ml-2 text-muted-foreground text-xs">{mark}</span> : null}
      </span>
      <Button
        aria-label="Later"
        disabled={!canGoLater}
        onClick={later}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
