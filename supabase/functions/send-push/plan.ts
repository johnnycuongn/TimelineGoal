// Turns claimed outbox rows into deliveries. Pure, so vitest covers grouping, muting and
// retry rules without a database or a push service.
import {
  type CopyInput,
  type GoalRef,
  type NotificationKind,
  notificationCopy,
  type PushMessage,
} from "../_shared/notification-copy.ts";

export const MAX_ATTEMPTS = 5;
export const TTL_SECONDS = 43_200;
export const REMINDER_TTL_SECONDS = 7_200;

export interface OutboxRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  goal_id: string | null;
  attempts: number;
  /** When the row became due (ISO). A row older than its kind's TTL is dropped, not sent late. */
  send_after: string;
}

export interface PlanContext {
  names: Map<string, string>;
  goals: Map<string, { title: string; charm: string | null; owner_id: string | null }>;
  prefs: Map<string, { timezone: string; muted: NotificationKind[] }>;
  openGoals: Map<string, number>;
  now: Date;
}

export interface Delivery {
  recipientId: string;
  rowIds: string[];
  message: PushMessage;
  ttlSeconds: number;
}

export interface Skip {
  id: string;
  reason: "expired" | "muted" | "nothing open" | "missing goal";
}

export type Settlement = "sent" | "no-devices" | "retry" | "give-up";

const PAWS: NotificationKind[] = ["paw_shared", "paw_own"];

// The subset of NotificationKind that planDeliveries handles with a GoalRef lookup — every
// kind other than "reminder" and "partner_joined", which carry no goal.
type GoalKind = "milestone_done" | "heart" | "seal" | "goal_added" | "goal_archived";

function isGoalKind(kind: NotificationKind): kind is GoalKind {
  return (
    kind === "milestone_done" ||
    kind === "heart" ||
    kind === "seal" ||
    kind === "goal_added" ||
    kind === "goal_archived"
  );
}

function ttlFor(kind: NotificationKind): number {
  return kind === "reminder" ? REMINDER_TTL_SECONDS : TTL_SECONDS;
}

/** Past its TTL: after a sender outage, old news is dropped rather than sent in a burst. */
function isExpired(r: OutboxRow, now: Date): boolean {
  return (now.getTime() - Date.parse(r.send_after)) / 1000 > ttlFor(r.kind);
}

export function localDay(timezone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

const PUSH_HOSTS = [
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
];

/** True only for an https endpoint on a known push service, so a forged subscription can't aim our POSTs elsewhere. */
export function isPushServiceEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
}

/**
 * What to write to a batch of outbox rows when something threw instead of settling normally
 * (loadContext blew up, or a delivery's own query failed before it could call `settle`). Keeps
 * "retry vs. give up after an exception" exactly as pure and tested as the happy path.
 */
export function failurePatch(
  error: unknown,
  attempts: number,
  at: string,
): { last_error: string; cancelled_at?: string } {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  return attempts >= MAX_ATTEMPTS
    ? { last_error: message, cancelled_at: at }
    : { last_error: message };
}

export function settle(statuses: number[], attempts: number): Settlement {
  if (statuses.some((s) => s >= 200 && s < 300)) {
    return "sent";
  }
  if (statuses.every(isGone)) {
    return "no-devices";
  }
  return attempts >= MAX_ATTEMPTS ? "give-up" : "retry";
}

export function planDeliveries(
  rows: OutboxRow[],
  ctx: PlanContext,
): { deliveries: Delivery[]; skips: Skip[] } {
  const deliveries: Delivery[] = [];
  const skips: Skip[] = [];
  const paws = new Map<string, OutboxRow[]>();

  const goalRef = (id: string | null): GoalRef | null => {
    const goal = id ? ctx.goals.get(id) : undefined;
    return goal ? { title: goal.title, charm: goal.charm, shared: goal.owner_id === null } : null;
  };
  const actorName = (id: string | null) => (id && ctx.names.get(id)) || "Your partner";
  const dayFor = (recipient: string) =>
    localDay(ctx.prefs.get(recipient)?.timezone ?? "UTC", ctx.now);

  for (const r of rows) {
    if (isExpired(r, ctx.now)) {
      skips.push({ id: r.id, reason: "expired" });
      continue;
    }
    if (ctx.prefs.get(r.recipient_id)?.muted.includes(r.kind)) {
      skips.push({ id: r.id, reason: "muted" });
      continue;
    }
    if (PAWS.includes(r.kind)) {
      const list = paws.get(r.recipient_id) ?? [];
      list.push(r);
      paws.set(r.recipient_id, list);
      continue;
    }
    const day = dayFor(r.recipient_id);
    let input: CopyInput;
    if (r.kind === "reminder") {
      const open = ctx.openGoals.get(r.recipient_id) ?? 0;
      if (open === 0) {
        skips.push({ id: r.id, reason: "nothing open" });
        continue;
      }
      input = { kind: "reminder", open };
    } else if (r.kind === "partner_joined") {
      input = { kind: "partner_joined", actor: actorName(r.actor_id) };
    } else if (isGoalKind(r.kind)) {
      const goal = goalRef(r.goal_id);
      if (!goal) {
        skips.push({ id: r.id, reason: "missing goal" });
        continue;
      }
      input = { kind: r.kind, actor: actorName(r.actor_id), goal };
    } else {
      // Unreachable: every NotificationKind is either a paw (handled above), "reminder",
      // "partner_joined", or a GoalKind.
      continue;
    }
    deliveries.push({
      recipientId: r.recipient_id,
      rowIds: [r.id],
      message: notificationCopy(input, day),
      ttlSeconds: ttlFor(r.kind),
    });
  }

  for (const [recipient, list] of paws) {
    const seen = new Set<string>();
    const goals: GoalRef[] = [];
    for (const r of list) {
      const goal = goalRef(r.goal_id);
      if (goal && r.goal_id && !seen.has(r.goal_id)) {
        seen.add(r.goal_id);
        goals.push(goal);
      }
    }
    if (goals.length === 0) {
      for (const r of list) {
        skips.push({ id: r.id, reason: "missing goal" });
      }
      continue;
    }
    const first = list[0];
    deliveries.push({
      recipientId: recipient,
      rowIds: list.map((r) => r.id),
      message: notificationCopy(
        { kind: "paws", actor: actorName(first?.actor_id ?? null), goals },
        dayFor(recipient),
      ),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return { deliveries, skips };
}
