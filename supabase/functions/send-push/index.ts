// Called by pg_cron (via pg_net) when the outbox has something due. Claims rows, plans
// deliveries, sends Web Push, and records what happened. The service key comes from the
// environment Supabase injects; nothing secret lives in this file.
// biome-ignore-all assist/source/organizeImports: the @deno-types pragma must stay directly above the webpush import it types
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type Delivery,
  failurePatch,
  isGone,
  isPushServiceEndpoint,
  localDay,
  type OutboxRow,
  type PlanContext,
  planDeliveries,
  settle,
} from "./plan.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>).default ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const DISPATCH_SECRET = Deno.env.get("DISPATCH_SECRET") ?? "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return expected.length > 0 && diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadContext(db: SupabaseClient, rows: OutboxRow[], now: Date): Promise<PlanContext> {
  const people = [...new Set(rows.flatMap((r) => [r.recipient_id, r.actor_id ?? ""]))].filter(
    Boolean,
  );
  const goalIds = [...new Set(rows.map((r) => r.goal_id).filter((g): g is string => !!g))];
  const recipients = [...new Set(rows.map((r) => r.recipient_id))];
  const [members, goals, prefs] = await Promise.all([
    db.from("members").select("user_id, display_name").in("user_id", people),
    goalIds.length
      ? db.from("goals").select("id, title, charm, owner_id").in("id", goalIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("notification_prefs").select("user_id, timezone, muted").in("user_id", recipients),
  ]);
  for (const res of [members, goals, prefs]) {
    if (res.error) {
      throw res.error;
    }
  }
  const ctx: PlanContext = {
    names: new Map((members.data ?? []).map((m) => [m.user_id, m.display_name])),
    goals: new Map(
      (goals.data ?? []).map((g) => [
        g.id,
        { title: g.title, charm: g.charm, owner_id: g.owner_id },
      ]),
    ),
    prefs: new Map(
      (prefs.data ?? []).map((p) => [p.user_id, { timezone: p.timezone, muted: p.muted }]),
    ),
    openGoals: new Map(),
    now,
  };
  const reminded = [
    ...new Set(rows.filter((r) => r.kind === "reminder").map((r) => r.recipient_id)),
  ];
  for (const user of reminded) {
    const day = localDay(ctx.prefs.get(user)?.timezone ?? "UTC", now);
    const { data, error } = await db.rpc("open_goals_for", { p_user: user, p_day: day });
    if (error) {
      throw error;
    }
    ctx.openGoals.set(user, data as number);
  }
  return ctx;
}

async function deliver(db: SupabaseClient, d: Delivery, attempts: number): Promise<boolean> {
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", d.recipientId);
  if (error) {
    throw error;
  }
  const statuses: number[] = [];
  let lastError: string | null = null;
  for (const sub of subs ?? []) {
    if (!isPushServiceEndpoint(sub.endpoint)) {
      // A forged or stale subscription row aiming somewhere other than a real push
      // service. Don't send to it — treat it exactly like a gone device.
      statuses.push(410);
      lastError = "subscription endpoint is not a known push service";
      await db.from("push_subscriptions").delete().eq("id", sub.id);
      continue;
    }
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(d.message),
        { TTL: d.ttlSeconds, urgency: "normal" },
      );
      statuses.push(res.statusCode);
      await db
        .from("push_subscriptions")
        .update({ last_ok_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      statuses.push(status);
      lastError = `${status} ${(err as Error).message}`.slice(0, 500);
      if (isGone(status)) {
        await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  const outcome = settle(statuses, attempts);
  const at = new Date().toISOString();
  const patch =
    outcome === "sent"
      ? { sent_at: at, last_error: null }
      : outcome === "no-devices"
        ? { sent_at: at, last_error: "no devices" }
        : outcome === "give-up"
          ? { cancelled_at: at, last_error: lastError }
          : { last_error: lastError };
  await db.from("notification_outbox").update(patch).in("id", d.rowIds);
  return outcome === "sent";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }
  if (!sameSecret(req.headers.get("x-dispatch-secret") ?? "", DISPATCH_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("claim_due_notifications", { p_limit: 100 });
  if (error) {
    return json({ error: error.message }, 500);
  }
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return json({ claimed: 0, sent: 0, skipped: 0 });
  }
  const now = new Date();
  let ctx: PlanContext;
  try {
    ctx = await loadContext(db, rows, now);
  } catch (err) {
    // claim_due_notifications already bumped attempts and set claimed_at on every one of these
    // rows, so a thrown error here must still settle them — otherwise they're re-claimed every
    // 2 minutes forever, climbing past MAX_ATTEMPTS with no cancelled_at.
    const at = now.toISOString();
    for (const row of rows) {
      await db
        .from("notification_outbox")
        .update(failurePatch(err, row.attempts, at))
        .eq("id", row.id);
    }
    return json({ error: failurePatch(err, 0, at).last_error }, 500);
  }
  const { deliveries, skips } = planDeliveries(rows, ctx);
  for (const skip of skips) {
    await db
      .from("notification_outbox")
      .update({ cancelled_at: now.toISOString(), last_error: skip.reason })
      .eq("id", skip.id);
  }
  const attemptsOf = new Map(rows.map((r) => [r.id, r.attempts]));
  let sent = 0;
  for (const d of deliveries) {
    const attempts = Math.max(...d.rowIds.map((id) => attemptsOf.get(id) ?? 1));
    try {
      if (await deliver(db, d, attempts)) {
        sent++;
      }
    } catch (err) {
      // A delivery that threw before it could call settle() (e.g. the push_subscriptions
      // select itself failed) must not strand its rows, and must not strand the rest of the
      // batch either — record the failure and keep going.
      await db
        .from("notification_outbox")
        .update(failurePatch(err, attempts, new Date().toISOString()))
        .in("id", d.rowIds);
    }
  }
  return json({ claimed: rows.length, sent, skipped: skips.length });
});
