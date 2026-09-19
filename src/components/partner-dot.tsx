import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { PARTNER_COLORS, type PartnerColorKey } from "@/lib/domain";

export function colorFor(key: PartnerColorKey, theme: "light" | "dark"): string {
  return PARTNER_COLORS[key][theme];
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
      className="inline-flex shrink-0 items-center justify-center rounded-full font-heading text-primary-foreground text-xs"
      role="img"
      style={{ width: size, height: size, background: colorFor(color, theme) }}
    >
      {initial}
    </span>
  );
}
