import { useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HORIZONS, type Horizon } from "@/lib/domain";

const LABELS: Record<Horizon, string> = {
  day: "Day",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

function isHorizon(value: string): value is Horizon {
  return (HORIZONS as readonly string[]).includes(value);
}

export default function HorizonTabs({
  value,
  onChange,
}: {
  value: Horizon;
  onChange: (h: Horizon) => void;
}) {
  const onValueChange = useCallback(
    (v: string) => {
      if (isHorizon(v)) {
        onChange(v);
      }
    },
    [onChange],
  );
  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList>
        {HORIZONS.map((h) => (
          <TabsTrigger key={h} value={h}>
            {LABELS[h]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
