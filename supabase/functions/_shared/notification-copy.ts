// The words on the lock screen. Pure: no Deno, no Supabase, so vitest covers every line.
// Copy never genders anyone — the app is for any two people.

export type NotificationKind =
  | "paw_shared"
  | "paw_own"
  | "milestone_done"
  | "heart"
  | "seal"
  | "goal_added"
  | "goal_archived"
  | "partner_joined"
  | "reminder";

export interface GoalRef {
  title: string;
  charm: string | null;
  shared: boolean;
}

export type CopyInput =
  | { kind: "paws"; actor: string; goals: GoalRef[] }
  | { kind: "milestone_done"; actor: string; goal: GoalRef }
  | { kind: "heart"; actor: string; goal: GoalRef }
  | { kind: "seal"; actor: string; goal: GoalRef }
  | { kind: "goal_added"; actor: string; goal: GoalRef }
  | { kind: "goal_archived"; actor: string; goal: GoalRef }
  | { kind: "partner_joined"; actor: string }
  | { kind: "reminder"; open: number };

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const TITLE = "CoupleGoal";
const MAX_TITLE = 40;

function clip(title: string): string {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;
}

export function goalName(goal: GoalRef): string {
  return goal.charm ? `${goal.charm} ${clip(goal.title)}` : clip(goal.title);
}

function forBoth(goal: GoalRef): string {
  return goal.shared ? " for you both" : "";
}

function pawsBody(actor: string, goals: GoalRef[]): string {
  const [first, second, third] = goals;
  if (!first) {
    return `${actor} pawed a goal`;
  }
  if (!second) {
    return `${actor} pawed ${goalName(first)}${forBoth(first)}`;
  }
  const titles = goals.map((g) => clip(g.title));
  if (goals.length === 2) {
    return `${actor} pawed 2 goals: ${titles[0]} and ${titles[1]}`;
  }
  if (goals.length === 3 && third) {
    return `${actor} pawed 3 goals: ${titles[0]}, ${titles[1]} and ${titles[2]}`;
  }
  return `${actor} pawed ${goals.length} goals: ${titles[0]}, ${titles[1]} and ${goals.length - 2} more`;
}

export function notificationCopy(input: CopyInput, localDay: string): PushMessage {
  const message = (body: string, url: string, group: string): PushMessage => ({
    title: TITLE,
    body,
    url,
    tag: `${group}-${localDay}`,
  });
  switch (input.kind) {
    case "paws":
      return message(pawsBody(input.actor, input.goals), "/den", "paws");
    case "milestone_done":
      return message(
        input.goal.shared
          ? `You two finished ${goalName(input.goal)}! 🎉`
          : `${input.actor} finished ${goalName(input.goal)}! 🎉`,
        "/goals",
        input.kind,
      );
    case "heart":
      return message(`${input.actor} ❤️ your ${goalName(input.goal)} paw`, "/den", input.kind);
    case "seal":
      return message(`${input.actor} sealed ${goalName(input.goal)}`, "/goals", input.kind);
    case "goal_added":
      return message(
        `${input.actor} added ${goalName(input.goal)}${forBoth(input.goal)}`,
        "/goals",
        input.kind,
      );
    case "goal_archived":
      return message(`${input.actor} tucked away ${goalName(input.goal)}`, "/goals", input.kind);
    case "partner_joined":
      return message(`${input.actor} joined your den 🐶`, "/den", input.kind);
    case "reminder":
      return message(
        input.open === 1
          ? "Today's paw is waiting — 1 left"
          : `Today's paws are waiting — ${input.open} left`,
        "/den",
        input.kind,
      );
  }
}
