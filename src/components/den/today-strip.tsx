import { Link } from "react-router";
import HabitCard from "@/components/goals/habit-card";
import TaskCard from "@/components/goals/task-card";
import StaggerItem from "@/components/stagger-item";
import type { HabitToggle } from "@/hooks/use-habit-toggle";
import type { Goal, Member } from "@/lib/domain";
import type { HabitState, TaskState } from "@/lib/ladder";

export default function TodayStrip({
  habits,
  states,
  tasks,
  taskStates,
  today,
  members,
  me,
  toggle,
}: {
  habits: Goal[];
  states: Record<string, HabitState>;
  /** One-offs dated today. They come first: a thing due today can't wait for tomorrow. */
  tasks: Goal[];
  taskStates: Record<string, TaskState>;
  today: string;
  members: Member[];
  me: string;
  toggle: HabitToggle;
}) {
  if (habits.length === 0 && tasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing for today yet.{" "}
        <Link className="focus-ring rounded-sm underline" to="/goals?h=day">
          Add something on the Timeline
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tasks.map((goal, index) => (
        <StaggerItem index={index} key={goal.id}>
          <TaskCard
            busy={toggle.busy.has(goal.id)}
            goal={goal}
            me={me}
            members={members}
            onToggle={toggle.toggle}
            state={taskStates[goal.id]}
            today={today}
          />
        </StaggerItem>
      ))}
      {habits.map((goal, index) => (
        <StaggerItem index={tasks.length + index} key={goal.id}>
          <HabitCard
            busy={toggle.busy.has(goal.id)}
            goal={goal}
            me={me}
            members={members}
            onToggle={toggle.toggle}
            state={toggle.view(goal.id, states[goal.id])}
          />
        </StaggerItem>
      ))}
    </div>
  );
}
