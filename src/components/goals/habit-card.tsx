import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback } from "react";
import { colorFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, type Member, SHARED_OWNER } from "@/lib/domain";
import type { HabitState } from "@/lib/ladder";
import { PRESS_SCALE, springs } from "@/lib/motion";

function stamperLabel(mine: boolean, done: boolean, name: string): string {
  if (mine) {
    return done ? "Undo today's paw" : "Stamp today's paw";
  }
  return done ? `${name} stamped today` : `${name} hasn't stamped yet`;
}

function StamperRow({
  goal,
  member,
  me,
  done,
  strip,
  stripDays,
  busy,
  onToggle,
}: {
  goal: Goal;
  member: Member;
  me: string;
  done: boolean;
  strip: boolean[];
  stripDays: string[];
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
        aria-label={stamperLabel(mine, done, member.displayName)}
        aria-pressed={done}
        className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        disabled={!mine || busy}
        onClick={onClick}
        style={{
          borderColor: color,
          background: done ? color : "transparent",
          color: done ? "#fff" : color,
        }}
        transition={springs.press}
        type="button"
        whileTap={mine && !reduced ? { scale: PRESS_SCALE } : undefined}
      >
        <PawPrint className="size-6" fill={done ? "currentColor" : "none"} />
      </motion.button>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm">{mine ? "You" : member.displayName}</p>
        {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form controls; this groups day dots */}
        <div
          aria-label={`Last 7 days for ${member.displayName}`}
          className="mt-1 flex gap-1"
          role="group"
        >
          {strip.map((on, i) => (
            <span
              className="size-2 rounded-full"
              key={stripDays[i] ?? String(i)}
              style={{ background: on ? color : "var(--border)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HabitCard({
  goal,
  state,
  members,
  me,
  busy = false,
  onToggle,
  menu,
}: {
  goal: Goal;
  state: HabitState | undefined;
  members: Member[];
  me: string;
  busy?: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
  menu?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const shared = goal.owner === SHARED_OWNER;
  const stampers = shared ? members : members.filter((m) => m.id === goal.owner);
  const owner = members.find((m) => m.id === goal.owner);
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared
    ? `linear-gradient(90deg, ${gradient.join(", ")})`
    : colorFor(owner?.color ?? "rose", theme);
  const streak = state && state.streakDays > 1 ? ` · ${state.streakDays} days in a row` : "";

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h3>
          <p className="m-0 text-muted-foreground text-xs">
            {shared ? "Together" : owner?.displayName}
            {streak}
          </p>
        </div>
        {menu}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {stampers.map((m) => (
          <StamperRow
            busy={busy}
            done={state?.todayBy[m.id] ?? false}
            goal={goal}
            key={m.id}
            me={me}
            member={m}
            onToggle={onToggle}
            strip={state?.last7[m.id] ?? []}
            stripDays={state?.stripDays ?? []}
          />
        ))}
      </div>
    </article>
  );
}
