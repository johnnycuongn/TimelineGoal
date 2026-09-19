import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/lib/motion";

interface Slot {
  id: string;
  index: number;
}

export default function PawRow({
  filled,
  target,
  color,
  label,
  onStamp,
  busy = false,
}: {
  filled: number;
  target: number;
  color: string;
  label: string;
  onStamp?: () => void;
  busy?: boolean;
}) {
  const reduced = useReducedMotion();
  const slots: Slot[] = Array.from({ length: target }, (_, index) => ({
    id: `slot-${index}`,
    index,
  }));
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form controls; this groups paw prints
    <div
      aria-label={`${label}: ${filled} of ${target} paw prints`}
      className="flex flex-wrap gap-1"
      role="group"
    >
      {slots.map((slot) => {
        const isFilled = slot.index < filled;
        const isNext = Boolean(onStamp) && slot.index === filled;
        const paw = (
          <motion.span
            animate={{ scale: isFilled ? 1 : 0.9, opacity: isFilled ? 1 : 0.35 }}
            initial={false}
            style={{ color: isFilled ? color : undefined, display: "inline-flex" }}
            transition={reduced ? { duration: 0.12 } : springs.bouncy}
          >
            <PawPrint
              aria-hidden="true"
              className="size-6"
              fill={isFilled ? "currentColor" : "none"}
            />
          </motion.span>
        );
        if (isNext) {
          return (
            <motion.button
              aria-label="Stamp a paw print"
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              key={slot.id}
              onClick={onStamp}
              transition={springs.press}
              type="button"
              whileTap={reduced ? undefined : { scale: 0.9 }}
            >
              {paw}
            </motion.button>
          );
        }
        return (
          <span className="flex size-11 items-center justify-center" key={slot.id}>
            {paw}
          </span>
        );
      })}
    </div>
  );
}
