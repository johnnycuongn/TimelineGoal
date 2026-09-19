import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ErrorPanel } from "@/components/error-panel";
import HabitCard from "@/components/goals/habit-card";
import HorizonTabs from "@/components/goals/horizon-tabs";
import NewGoalDialog from "@/components/goals/new-goal-dialog";
import { Button } from "@/components/ui/button";
import { useDen } from "@/data/den-context";
import { useCoupleData } from "@/data/use-couple-data";
import { useHabitToggle } from "@/hooks/use-habit-toggle";
import { useToday } from "@/hooks/use-today";
import { HORIZONS, type Horizon, SHARED_OWNER } from "@/lib/domain";
import { parentCandidates } from "@/lib/goals";
import { isValidPeriod } from "@/lib/periods";
import { timelineView } from "@/lib/views";

function isHorizon(value: string | null): value is Horizon {
  return value !== null && (HORIZONS as readonly string[]).includes(value);
}

export default function TimelinePage() {
  const { me } = useDen();
  const today = useToday();
  const { data, error, refresh } = useCoupleData(me.couple.id, today);
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hParam = params.get("h");
  const h: Horizon = isHorizon(hParam) ? hParam : "day";
  const periodParam = params.get("period");
  const period = periodParam && isValidPeriod(periodParam) ? periodParam : undefined;

  const ctx = useMemo(
    () => ({ coupleId: me.couple.id, me: me.userId, refresh }),
    [me.couple.id, me.userId, refresh],
  );
  const habitToggle = useHabitToggle(ctx);

  // Switching horizon drops any period so a memory view never leaks across tabs.
  const setHorizon = useCallback((next: Horizon) => setParams({ h: next }), [setParams]);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  const onCreated = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return <ErrorPanel error={error} />;
  }
  if (!data) {
    return (
      <section className="page-wrap py-10">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </section>
    );
  }

  const view = timelineView(data, me.userId, today);
  const habits = view.goals.filter((g) => g.horizon === "day");
  const mine = habits.filter((g) => g.owner === view.me || g.owner === SHARED_OWNER);
  const theirs = habits.filter((g) => g.owner !== view.me && g.owner !== SHARED_OWNER);

  return (
    <section className="page-wrap py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Timeline</p>
          <h1 className="display-title m-0 text-3xl">Our goals</h1>
        </div>
        <Button onClick={openDialog} type="button">
          <Plus /> New {h === "day" ? "habit" : "goal"}
        </Button>
      </div>
      <HorizonTabs onChange={setHorizon} value={h} />

      {h === "day" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {habits.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No habits yet. Add the first small thing you'll do every day.
            </p>
          ) : null}
          {[...mine, ...theirs].map((goal) => (
            <HabitCard
              busy={habitToggle.busy.has(goal.id)}
              goal={goal}
              key={goal.id}
              me={view.me}
              members={view.members}
              onToggle={habitToggle.toggle}
              state={habitToggle.view(goal.id, view.habits[goal.id])}
            />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground text-sm">
          Milestones arrive in the next step. (period: {period ?? "current"})
        </p>
      )}

      <NewGoalDialog
        ctx={{ coupleId: me.couple.id, uid: me.userId, today }}
        horizon={h}
        me={view.me}
        members={view.members}
        onCreated={onCreated}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        parents={parentCandidates(view.goals, h, today)}
      />
    </section>
  );
}
