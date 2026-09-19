import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { PARTNER_COLORS, type PartnerColorKey } from "@/lib/domain";

export function colorFor(key: PartnerColorKey, theme: "light" | "dark"): string {
  return PARTNER_COLORS[key][theme];
}

/** Text or glyph colour for something drawn on top of a partner's swatch. */
export function inkFor(key: PartnerColorKey, theme: "light" | "dark"): string {
  return PARTNER_COLORS[key].ink[theme];
}

export default function PartnerDot({
  color,
  label,
  size = 28,
}: {
  color: PartnerColorKey;
  label: string;
  size?: number;
}) {
  const theme = useResolvedTheme();
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-heading text-xs"
      role="img"
      style={{
        width: size,
        height: size,
        background: colorFor(color, theme),
        color: inkFor(color, theme),
      }}
    >
      {initial}
    </span>
  );
}
