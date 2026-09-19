import { Stamp } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import PawRow from "@/components/goals/paw-row";
import { colorFor } from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, isSealed, type Member, SHARED_OWNER } from "@/lib/domain";
import { filledPaws, type GoalProgress } from "@/lib/ladder";

const PERCENT = 100;

function childLabel(child: Goal, cp: GoalProgress | undefined): string {
  if (child.horizon === "day") {
    return "daily habit";
  }
  return cp ? `${filledPaws(cp)}/${cp.target}` : "";
}

function sealLabel(mySeal: boolean): string {
  return mySeal ? "Waiting for their paw" : "Waiting for your paw";
}

export default function MilestoneCard({
  goal,
  progress,
  parent,
  childGoals,
  progressById,
  members,
  me,
  readOnly,
  busy = false,
  onStamp,
  onSeal,
  menu,
}: {
  goal: Goal;
  progress: GoalProgress | undefined;
  parent: Goal | undefined;
  childGoals: Goal[];
  progressById: Record<string, GoalProgress>;
  members: Member[];
  me: string;
  readOnly: boolean;
  busy?: boolean;
  onStamp: (goal: Goal) => void;
  onSeal: (goal: Goal) => void;
  menu?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const owner = members.find((m) => m.id === goal.owner);
  const shared = goal.owner === SHARED_OWNER;
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared
    ? `linear-gradient(90deg, ${gradient.join(", ")})`
    : colorFor(owner?.color ?? "rose", theme);
  const pawColor = shared ? (gradient[0] ?? "") : colorFor(owner?.color ?? "rose", theme);
  const canStamp =
    !readOnly && (shared || goal.owner === me) && progress !== undefined && !progress.complete;
  const sealed = isSealed(
    goal,
    members.map((m) => m.id),
  );
  const mySeal = Boolean(goal.seals[me]);
  const percent = progress ? Math.round((progress.progress / progress.target) * PERCENT) : 0;
  const stampGoal = useCallback(() => onStamp(goal), [onStamp, goal]);
  const seal = useCallback(() => onSeal(goal), [onSeal, goal]);

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h2>
          <p className="m-0 text-muted-foreground text-xs">
            {shared ? "Together" : owner?.displayName}
            {progress?.complete ? " · done!" : ""}
          </p>
          {parent ? (
            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              climbs toward {parent.charm ? `${parent.charm} ` : ""}
              {parent.title}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shared && !sealed && !readOnly ? (
            <Button onClick={seal} size="sm" type="button" variant={mySeal ? "ghost" : "secondary"}>
              <Stamp /> <span className="hidden sm:inline">{sealLabel(mySeal)}</span>
              <span className="sm:hidden">Seal</span>
            </Button>
          ) : null}
          {shared && sealed ? <span className="text-muted-foreground text-xs">Sealed</span> : null}
          {menu}
        </div>
      </div>
      {progress ? (
        <div className="mt-4 space-y-2">
          <PawRow
            busy={busy}
            color={pawColor}
            filled={filledPaws(progress)}
            label={goal.title}
            onStamp={canStamp ? stampGoal : undefined}
            target={progress.target}
          />
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${percent}%`, background: accent }}
            />
          </div>
          {progress.ladder > 0 ? (
            <p className="m-0 text-muted-foreground text-xs">
              {progress.ladder.toFixed(1)} paw{progress.ladder === 1 ? "" : "s"} climbed up from
              smaller goals
            </p>
          ) : null}
        </div>
      ) : null}
      {childGoals.length > 0 ? (
        <ul className="mt-4 list-none space-y-1 border-border border-t pt-3 pl-0">
          {childGoals.map((c) => (
            <li className="flex items-center justify-between gap-2 text-sm" key={c.id}>
              <span className="min-w-0 truncate">
                {c.charm ? `${c.charm} ` : ""}
                {c.title}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {childLabel(c, progressById[c.id])}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
