import { Check } from "lucide-react";
import { type MouseEvent, useCallback } from "react";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import {
  isPartnerColorKey,
  PARTNER_COLORS,
  type PartnerColorKey,
  partnerColorKeys,
} from "@/lib/domain";

/** The stored keys are lowercase; a screen reader should hear a word, not a token. */
function labelFor(key: PartnerColorKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function ColorPicker({
  value,
  onChange,
  taken = [],
}: {
  value: PartnerColorKey;
  onChange: (key: PartnerColorKey) => void;
  taken?: PartnerColorKey[];
}) {
  const theme = useResolvedTheme();
  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.dataset.color;
      if (key && isPartnerColorKey(key)) {
        onChange(key);
      }
    },
    [onChange],
  );
  return (
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Your colour</legend>
      {partnerColorKeys.map((key) => {
        const selected = value === key;
        const disabled = taken.includes(key) && !selected;
        return (
          <button
            aria-label={labelFor(key)}
            aria-pressed={selected}
            className="flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 aria-pressed:scale-110 aria-pressed:ring-2 aria-pressed:ring-ring"
            data-color={key}
            disabled={disabled}
            key={key}
            onClick={onPick}
            style={{ background: PARTNER_COLORS[key][theme] }}
            type="button"
          >
            {selected ? <Check className="size-4 text-primary-foreground" /> : null}
          </button>
        );
      })}
    </fieldset>
  );
}
