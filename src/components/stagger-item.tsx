import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { springs, timings } from "@/lib/motion";

const MS_PER_SECOND = 1000;
const RISE_PX = 8;

/**
 * One card in a grid, fading up `timings.staggerMs` after the card before it —
 * the spec's list stagger, on `springs.default` because it moves. Under reduced
 * motion it is the 120 ms fade and no movement at all.
 */
export default function StaggerItem({ index, children }: { index: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      className="min-w-0"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: RISE_PX }}
      transition={
        reduced
          ? { duration: timings.reducedMotionFadeMs / MS_PER_SECOND }
          : { ...springs.default, delay: (index * timings.staggerMs) / MS_PER_SECOND }
      }
    >
      {children}
    </motion.div>
  );
}
