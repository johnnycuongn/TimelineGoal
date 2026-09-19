import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createGoal, updateGoal } from "@/data/goal-mutations";
import {
  GOAL_TARGET_MAX,
  GOAL_TARGET_MIN,
  GOAL_TITLE_MAX,
  type Goal,
  type Horizon,
  type Member,
  SHARED_OWNER,
} from "@/lib/domain";

const HORIZON_HINT: Record<Horizon, string> = {
  day: "A habit that shows up every day. One paw per person per day.",
  month: "A milestone for this month, filled with paw prints.",
  quarter: "A bigger milestone for this quarter.",
  year: "The dream for this year.",
};
// UTF-16 units, not glyphs: a ZWJ family emoji is 8 units.
const CHARM_INPUT_MAX = 16;
const DEFAULT_TARGET = 3;

function submitLabel(editing: boolean, sealsOnCreate: boolean): string {
  if (editing) {
    return "Save";
  }
  return sealsOnCreate ? "Create and seal" : "Create";
}

export interface GoalDialogContext {
  coupleId: string;
  uid: string;
  today: string;
}

export default function NewGoalDialog({
  horizon,
  members,
  me,
  parents,
  open,
  onOpenChange,
  onCreated,
  editing,
  onSaved,
  ctx,
}: {
  horizon: Horizon;
  members: Member[];
  me: string;
  parents: Goal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (goal: Goal) => void;
  editing?: Goal | null;
  onSaved?: (goal: Goal) => void;
  ctx: GoalDialogContext;
}) {
  const [title, setTitle] = useState("");
  const [charm, setCharm] = useState("");
  const [owner, setOwner] = useState<string>(me);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [parentGoalId, setParentGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Parents live one horizon up, so a pick made on another tab can never be right.
  // biome-ignore lint/correctness/useExhaustiveDependencies: horizon is the reset trigger, not a value the effect reads
  useEffect(() => {
    setParentGoalId("");
  }, [horizon]);

  // The dialog doubles as the editor; closing it hands the form back to "new".
  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setCharm(editing.charm ?? "");
      setOwner(editing.owner);
      setTarget(editing.targetUnits ?? DEFAULT_TARGET);
      setParentGoalId(editing.parentGoalId ?? "");
      return;
    }
    setTitle("");
    setCharm("");
    setOwner(me);
    setTarget(DEFAULT_TARGET);
    setParentGoalId("");
  }, [editing, me]);

  const onTitle = useCallback((e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value), []);
  const onCharm = useCallback((e: ChangeEvent<HTMLInputElement>) => setCharm(e.target.value), []);
  const onOwner = useCallback((e: ChangeEvent<HTMLSelectElement>) => setOwner(e.target.value), []);
  const onTarget = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setTarget(Number(e.target.value)),
    [],
  );
  const onParent = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => setParentGoalId(e.target.value),
    [],
  );
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        if (editing) {
          await updateGoal(editing.id, {
            title,
            charm: charm || null,
            targetUnits: horizon === "day" ? undefined : target,
            parentGoalId: parentGoalId || null,
          });
          onSaved?.({
            ...editing,
            title,
            charm: charm || null,
            targetUnits: horizon === "day" ? null : target,
            parentGoalId: parentGoalId || null,
          });
          onOpenChange(false);
          return;
        }
        const goal = await createGoal({
          coupleId: ctx.coupleId,
          uid: ctx.uid,
          today: ctx.today,
          input: {
            title,
            charm: charm || null,
            horizon,
            owner,
            targetUnits: horizon === "day" ? null : target,
            parentGoalId: parentGoalId || null,
          },
        });
        setTitle("");
        setCharm("");
        setParentGoalId("");
        onCreated(goal);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the goal.");
      } finally {
        setBusy(false);
      }
    },
    [
      ctx,
      title,
      charm,
      horizon,
      owner,
      target,
      parentGoalId,
      onCreated,
      onOpenChange,
      editing,
      onSaved,
    ],
  );

  // The wax is a milestone ritual, so a shared daily habit is created without one.
  const sealsOnCreate = owner === SHARED_OWNER && horizon !== "day";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit" : "New"} {horizon === "day" ? "habit" : "goal"}
          </DialogTitle>
          <DialogDescription>{HORIZON_HINT[horizon]}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Title</Label>
              <Input
                id="goal-title"
                maxLength={GOAL_TITLE_MAX}
                onChange={onTitle}
                required
                value={title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-charm">Charm</Label>
              <Input
                id="goal-charm"
                maxLength={CHARM_INPUT_MAX}
                onChange={onCharm}
                placeholder="🐾"
                value={charm}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-owner">Whose goal</Label>
            <NativeSelect
              disabled={Boolean(editing)}
              id="goal-owner"
              onChange={onOwner}
              value={owner}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me ? "Mine" : `${m.displayName}'s`}
                </option>
              ))}
              <option value={SHARED_OWNER}>Ours, together</option>
            </NativeSelect>
          </div>
          {horizon === "day" ? null : (
            <div className="space-y-2">
              <Label htmlFor="goal-target">Paw prints to fill</Label>
              <Input
                id="goal-target"
                inputMode="numeric"
                max={GOAL_TARGET_MAX}
                min={GOAL_TARGET_MIN}
                onChange={onTarget}
                type="number"
                value={target}
              />
            </div>
          )}
          {parents.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="goal-parent">Climbs toward</Label>
              <NativeSelect id="goal-parent" onChange={onParent} value={parentGoalId}>
                <option value="">Nothing bigger (yet)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.charm ? `${p.charm} ` : ""}
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={close} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={busy || title.trim().length === 0} type="submit">
              {submitLabel(Boolean(editing), sealsOnCreate)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
