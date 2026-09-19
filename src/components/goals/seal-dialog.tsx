import { Stamp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { colorFor } from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import type { Goal, Member } from "@/lib/domain";
import { springs } from "@/lib/motion";

const SEAL_CLOSE_MS = 600;

export default function SealDialog({
  goal,
  members,
  me,
  open,
  onOpenChange,
  onSeal,
}: {
  goal: Goal | null;
  members: Member[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSeal: (goal: Goal) => Promise<void>;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const [pressing, setPressing] = useState(false);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const press = useCallback(async () => {
    if (!goal) {
      return;
    }
    setPressing(true);
    try {
      await onSeal(goal);
      window.setTimeout(() => onOpenChange(false), SEAL_CLOSE_MS);
    } finally {
      window.setTimeout(() => setPressing(false), SEAL_CLOSE_MS);
    }
  }, [goal, onSeal, onOpenChange]);

  if (!goal) {
    return null;
  }
  const mine = Boolean(goal.seals[me]);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seal the deal</DialogTitle>
          <DialogDescription>
            A shared goal deserves both your paws on it: {goal.title}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-8 py-6">
          {members.map((m) => {
            const done = Boolean(goal.seals[m.id]);
            return (
              <motion.div
                animate={
                  done
                    ? { scale: [1.4, 1], rotate: [-8, 0], opacity: 1 }
                    : { scale: 1, opacity: 0.3 }
                }
                className="flex size-20 items-center justify-center rounded-full text-white"
                initial={false}
                key={m.id}
                style={{ background: colorFor(m.color, theme) }}
                transition={reduced ? { duration: 0.12 } : springs.bouncy}
              >
                <Stamp className="size-8" />
              </motion.div>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={close} type="button" variant="ghost">
            Later
          </Button>
          <Button disabled={mine || pressing} onClick={press} type="button">
            {mine ? "You've sealed it" : "Press my paw"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
