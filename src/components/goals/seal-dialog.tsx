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
import { friendlyError } from "@/lib/errors";
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
  const [error, setError] = useState<string | null>(null);
  // Every close path clears a stale failure, so the next goal opens clean.
  const changeOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        setError(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );
  const close = useCallback(() => changeOpen(false), [changeOpen]);
  const press = useCallback(async () => {
    if (!goal) {
      return;
    }
    setPressing(true);
    setError(null);
    try {
      await onSeal(goal);
      // Let the wax land before the dialog goes; the button stays held until then.
      window.setTimeout(() => changeOpen(false), SEAL_CLOSE_MS);
      window.setTimeout(() => setPressing(false), SEAL_CLOSE_MS);
    } catch (err) {
      // Offline, an RLS refusal or the goal_seals trigger: say so and stay open.
      setError(friendlyError(err));
      setPressing(false);
    }
  }, [goal, onSeal, changeOpen]);

  if (!goal) {
    return null;
  }
  const mine = Boolean(goal.seals[me]);
  return (
    <Dialog onOpenChange={changeOpen} open={open}>
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
                className="flex size-20 items-center justify-center rounded-full text-primary-foreground"
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
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
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
