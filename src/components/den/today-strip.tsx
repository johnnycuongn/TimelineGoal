import { Link } from "react-router";
import HabitCard from "@/components/goals/habit-card";
import type { HabitToggle } from "@/hooks/use-habit-toggle";
import type { Goal, Member } from "@/lib/domain";
import type { HabitState } from "@/lib/ladder";

export default function TodayStrip({
  habits,
  states,
  members,
  me,
  toggle,
}: {
  habits: Goal[];
  states: Record<string, HabitState>;
  members: Member[];
  me: string;
  toggle: HabitToggle;
}) {
  if (habits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No daily habits yet.{" "}
        <Link className="focus-ring rounded-sm underline" to="/goals?h=day">
          Add one on the Timeline
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {habits.map((goal) => (
        <HabitCard
          busy={toggle.busy.has(goal.id)}
          goal={goal}
          key={goal.id}
          me={me}
          members={members}
          onToggle={toggle.toggle}
          state={toggle.view(goal.id, states[goal.id])}
        />
      ))}
    </div>
  );
}
