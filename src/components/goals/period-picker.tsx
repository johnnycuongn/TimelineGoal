import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { periodLabel, shiftPeriod } from "@/lib/periods";

export default function PeriodPicker({
  period,
  current,
  onChange,
}: {
  period: string;
  current: string;
  onChange: (period: string) => void;
}) {
  const isCurrent = period === current;
  const earlier = useCallback(() => onChange(shiftPeriod(period, -1)), [onChange, period]);
  const later = useCallback(() => onChange(shiftPeriod(period, 1)), [onChange, period]);
  return (
    <div className="flex items-center gap-1">
      <Button aria-label="Earlier" onClick={earlier} size="icon" type="button" variant="ghost">
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-[9rem] text-center font-heading text-lg">
        {periodLabel(period)}
        {isCurrent ? null : <span className="ml-2 text-muted-foreground text-xs">memory</span>}
      </span>
      <Button
        aria-label="Later"
        disabled={isCurrent}
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
