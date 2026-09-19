import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { ErrorPanel } from "@/components/error-panel";
import GoalMenu from "@/components/goals/goal-menu";
import HabitCard from "@/components/goals/habit-card";
import HorizonTabs from "@/components/goals/horizon-tabs";
import MilestoneCard from "@/components/goals/milestone-card";
import NewGoalDialog from "@/components/goals/new-goal-dialog";
import PeriodPicker from "@/components/goals/period-picker";
import SealDialog from "@/components/goals/seal-dialog";
import Confetti from "@/components/pup/confetti";
import Pup from "@/components/pup/pup";
import { usePupMood } from "@/components/pup/pup-mood-context";
import { Button } from "@/components/ui/button";
import { useDen } from "@/data/den-context";
import { archiveGoal, sealGoal, stamp, undoLastMilestonePaw } from "@/data/goal-mutations";
import { useCoupleData } from "@/data/use-couple-data";
import { useHabitToggle } from "@/hooks/use-habit-toggle";
import { useToday } from "@/hooks/use-today";
import { localDayKey } from "@/lib/day";
import {
  type Goal,
  HORIZONS,
  type Horizon,
  isSealed,
  type MilestoneHorizon,
  SHARED_OWNER,
} from "@/lib/domain";
import { parentCandidates } from "@/lib/goals";
import { computeProgress } from "@/lib/ladder";
import { horizonOfPeriod, isValidPeriod, periodFor } from "@/lib/periods";
import { type TimelineData, timelineView, toLite } from "@/lib/views";

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
  const { trigger } = usePupMood();
  const [burst, setBurst] = useState(0);
  const pupName = data?.couple.pupName ?? "your pup";
  const onStamped = useCallback(() => trigger("happy"), [trigger]);
  const habitToggle = useHabitToggle(ctx, onStamped);

  const [sealGoalId, setSealGoalId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [busyGoal, setBusyGoal] = useState<string | null>(null);

  // Switching horizon drops any period so a memory view never leaks across tabs.
  // Both writes replace the entry so Back leaves the page instead of walking tabs.
  const setHorizon = useCallback(
    (next: Horizon) => setParams({ h: next }, { replace: true }),
    [setParams],
  );
  const openDialog = useCallback(() => setDialogOpen(true), []);

  const runGoalAction = useCallback(
    async (goal: Goal, work: () => Promise<void>) => {
      if (busyGoal) {
        return;
      }
      setBusyGoal(goal.id);
      try {
        await work();
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't land. Try again?");
      } finally {
        setBusyGoal(null);
      }
    },
    [busyGoal, refresh],
  );

  const stampMilestone = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        if (!data) {
          return;
        }
        const active = data.goals.filter((g) => g.archivedAt === null);
        const lite = toLite(data);
        const before = computeProgress(active, lite, today)[goal.id]?.complete ?? false;
        const day = localDayKey();
        const { created } = await stamp({
          coupleId: me.couple.id,
          goalId: goal.id,
          uid: me.userId,
          day,
        });
        if (!created) {
          return;
        }
        const after =
          computeProgress(active, [...lite, { goalId: goal.id, uid: me.userId, day }], today)[
            goal.id
          ]?.complete ?? false;
        if (after && !before && (goal.horizon === "quarter" || goal.horizon === "year")) {
          trigger("proud");
        } else if (after && !before) {
          trigger("party");
          setBurst((b) => b + 1);
        } else {
          trigger("happy");
        }
      }),
    [runGoalAction, data, today, me.couple.id, me.userId, trigger],
  );
  const undoMilestone = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        // Newest own stamp on this goal; data.checkins is newest-first.
        const last = data?.checkins.find((c) => c.goalId === goal.id && c.uid === me.userId);
        if (!last) {
          throw new Error("No paw of yours to take back.");
        }
        await undoLastMilestonePaw(last.id);
      }),
    [runGoalAction, data, me.userId],
  );
  const archive = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        await archiveGoal(goal.id);
      }),
    [runGoalAction],
  );
  const seal = useCallback(
    async (goal: Goal) => {
      await sealGoal(goal.id, me.userId, me.couple.id);
      const fresh = await refresh();
      const updated = fresh?.goals.find((g) => g.id === goal.id);
      if (
        updated &&
        isSealed(
          updated,
          (fresh?.members ?? []).map((m) => m.id),
        )
      ) {
        trigger("party");
        setBurst((b) => b + 1);
      }
    },
    [me.userId, me.couple.id, refresh, trigger],
  );
  const openSeal = useCallback((goal: Goal) => setSealGoalId(goal.id), []);
  const onSealOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSealGoalId(null);
    }
  }, []);
  // The wax is a milestone ritual, so a shared daily habit never opens the dialog.
  const onCreated = useCallback(
    (goal: Goal) => {
      void refresh();
      if (goal.owner === SHARED_OWNER && goal.horizon !== "day") {
        setSealGoalId(goal.id);
      }
    },
    [refresh],
  );
  const onSaved = useCallback(() => {
    setEditing(null);
    void refresh();
  }, [refresh]);
  const onDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
    }
  }, []);
  const edit = useCallback((goal: Goal) => {
    setEditing(goal);
    setDialogOpen(true);
  }, []);
  const setPeriod = useCallback(
    (p: string) => setParams({ h, period: p }, { replace: true }),
    [setParams, h],
  );

  // Only a cold failure blanks the page: with keepPreviousData a failed background
  // revalidation (a phone off Wi-Fi for a second) must not throw away a warm Timeline.
  if (error && !data) {
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
  // The dialog always gets the live goal, so a partner's wax arriving by Realtime
  // fills the second seal while the dialog is open.
  const sealGoalLive = sealGoalId ? (view.goals.find((g) => g.id === sealGoalId) ?? null) : null;
  // The same rule MilestoneSection applies: a period from the URL only counts on
  // its own tab and never in the future, so the button matches what is on screen.
  const viewingMemory =
    h !== "day" &&
    period !== undefined &&
    horizonOfPeriod(period) === h &&
    period < periodFor(h, today);

  return (
    <section className="page-wrap py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Timeline</p>
          <h1 className="display-title m-0 text-3xl">Our goals</h1>
        </div>
        <Button disabled={viewingMemory} onClick={openDialog} type="button">
          <Plus /> New {h === "day" ? "habit" : "goal"}
        </Button>
      </div>
      <div className="island-shell relative mb-6 overflow-hidden p-2">
        <Pup className="h-[200px] sm:h-[240px]" name={pupName} />
        <Confetti burst={burst} />
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
              menu={<GoalMenu goal={goal} onArchive={archive} onEdit={edit} />}
              onToggle={habitToggle.toggle}
              state={habitToggle.view(goal.id, view.habits[goal.id])}
            />
          ))}
        </div>
      ) : (
        <MilestoneSection
          busyGoal={busyGoal}
          data={view}
          horizon={h}
          onArchive={archive}
          onEdit={edit}
          onSeal={openSeal}
          onStamp={stampMilestone}
          onUndo={undoMilestone}
          period={period}
          setPeriod={setPeriod}
        />
      )}

      <SealDialog
        goal={sealGoalLive}
        me={view.me}
        members={view.members}
        onOpenChange={onSealOpenChange}
        onSeal={seal}
        open={sealGoalLive !== null}
      />

      <NewGoalDialog
        ctx={{ coupleId: me.couple.id, uid: me.userId, today }}
        editing={editing}
        horizon={h}
        me={view.me}
        members={view.members}
        onCreated={onCreated}
        onOpenChange={onDialogOpenChange}
        onSaved={onSaved}
        open={dialogOpen}
        parents={parentCandidates(view.goals, h, today)}
      />
    </section>
  );
}

function MilestoneSection({
  data,
  horizon,
  period,
  setPeriod,
  busyGoal,
  onStamp,
  onUndo,
  onSeal,
  onEdit,
  onArchive,
}: {
  data: TimelineData;
  horizon: MilestoneHorizon;
  period: string | undefined;
  setPeriod: (p: string) => void;
  busyGoal: string | null;
  onStamp: (g: Goal) => void;
  onUndo: (g: Goal) => void;
  onSeal: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onArchive: (g: Goal) => void;
}) {
  const current = periodFor(horizon, data.today);
  // A period from the URL only counts if it belongs to this tab and is not in the future.
  const viewPeriod =
    period && horizonOfPeriod(period) === horizon && period <= current ? period : current;
  const readOnly = viewPeriod !== current;
  const goals = data.goals.filter((g) => g.horizon === horizon && g.period === viewPeriod);
  const byId = new Map(data.goals.map((g) => [g.id, g]));
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <PeriodPicker current={current} onChange={setPeriod} period={viewPeriod} />
      </div>
      {goals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {readOnly
            ? "Nothing here from back then."
            : "No goals for this stretch yet. Dream a little?"}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const progress = data.progress[goal.id];
            return (
              <MilestoneCard
                busy={busyGoal === goal.id}
                childGoals={data.goals.filter((g) => g.parentGoalId === goal.id)}
                goal={goal}
                key={goal.id}
                me={data.me}
                members={data.members}
                menu={
                  readOnly ? undefined : (
                    <GoalMenu
                      canUndo={
                        (progress?.own ?? 0) > 0 &&
                        (goal.owner === data.me || goal.owner === SHARED_OWNER)
                      }
                      goal={goal}
                      onArchive={onArchive}
                      onEdit={onEdit}
                      onUndo={onUndo}
                    />
                  )
                }
                onSeal={onSeal}
                onStamp={onStamp}
                parent={goal.parentGoalId ? byId.get(goal.parentGoalId) : undefined}
                progress={progress}
                progressById={data.progress}
                readOnly={readOnly}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
