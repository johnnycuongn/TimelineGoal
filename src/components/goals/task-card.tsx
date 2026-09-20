import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback } from "react";
import { colorFor, inkFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, type Member, SHARED_OWNER } from "@/lib/domain";
import { stampersOf } from "@/lib/goals";
import type { TaskState } from "@/lib/ladder";
import { PRESS_SCALE, springs } from "@/lib/motion";
import { dayLabel } from "@/lib/periods";

function stamperLabel(mine: boolean, done: boolean, name: string, title: string): string {
  if (mine) {
    return done ? `Undo your paw on ${title}` : `Stamp your paw on ${title}`;
  }
  return done ? `${name} did ${title}` : `Waiting for ${name}`;
}

/** One partner's paw. Its own component because it reads the theme with a hook. */
function StamperPaw({
  goal,
  member,
  me,
  done,
  open,
  busy,
  onToggle,
}: {
  goal: Goal;
  member: Member;
  me: string;
  done: boolean;
  /** Is today the day? The database refuses a paw on any other. */
  open: boolean;
  busy: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const mine = member.id === me;
  const color = colorFor(member.color, theme);
  const onClick = useCallback(() => onToggle(goal, done), [onToggle, goal, done]);
  return (
    <div className="flex items-center gap-3">
      <motion.button
        aria-label={stamperLabel(mine, done, member.displayName, goal.title)}
        aria-pressed={done}
        className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
        disabled={!mine || !open || busy}
        onClick={onClick}
        style={{
          borderColor: color,
          background: done ? color : "transparent",
          color: done ? inkFor(member.color, theme) : color,
        }}
        transition={springs.press}
        type="button"
        whileTap={mine && open && !reduced ? { scale: PRESS_SCALE } : undefined}
      >
        <PawPrint className="size-6" fill={done ? "currentColor" : "none"} />
      </motion.button>
      <p className="m-0 min-w-0 flex-1 truncate text-sm">
        {mine ? "You" : member.displayName}
        {done ? " · done" : ""}
      </p>
    </div>
  );
}

export default function TaskCard({
  goal,
  state,
  members,
  me,
  today,
  busy = false,
  onToggle,
  menu,
}: {
  goal: Goal;
  state: TaskState | undefined;
  members: Member[];
  me: string;
  today: string;
  busy?: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
  menu?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const shared = goal.owner === SHARED_OWNER;
  const owner = members.find((m) => m.id === goal.owner);
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared
    ? `linear-gradient(90deg, ${gradient.join(", ")})`
    : colorFor(owner?.color ?? "rose", theme);
  // A one-off always has a period; `today` is only here so the type stays honest.
  const day = goal.period ?? today;
  const open = day === today;
  const overdue = day < today && !state?.done;

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5"
        style={{ background: accent, opacity: state?.done ? 0.4 : 1 }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h2>
          <p className="m-0 text-muted-foreground text-xs">
            {dayLabel(day, today)}
            {overdue ? " · still waiting" : ""}
            {" · "}
            {shared ? "Together" : (owner?.displayName ?? "")}
          </p>
        </div>
        {menu}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {stampersOf(goal, members).map((m) => (
          <StamperPaw
            busy={busy}
            done={state?.doneBy[m.id] ?? false}
            goal={goal}
            key={m.id}
            me={me}
            member={m}
            onToggle={onToggle}
            open={open}
          />
        ))}
      </div>
      {open ? null : (
        <p className="mt-3 mb-0 text-muted-foreground text-xs">
          {day > today
            ? "Its paw waits for the day."
            : "The day has passed — tuck it away, or do it late."}
        </p>
      )}
    </article>
  );
}
