-- Push notifications, part 1: which devices to reach, what each person wants, and the
-- queue the triggers in 0012 fill. Clients never touch the queue.

create type public.notification_kind as enum (
  'paw_shared', 'paw_own', 'milestone_done', 'heart', 'seal',
  'goal_added', 'goal_archived', 'partner_joined', 'reminder'
);

-- One row per installed device. An endpoint belongs to whoever saved it last: a phone
-- that changes hands between partners must stop buzzing for the first one.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  remind_at time not null default '20:00',
  muted public.notification_kind[] not null default '{}',
  last_reminded_on date
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind public.notification_kind not null,
  goal_id uuid references public.goals (id) on delete set null,
  -- No foreign key: deleting a check-in cancels its rows (0012) instead of erasing them.
  checkin_id uuid,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index notification_outbox_due_idx on public.notification_outbox (send_after)
  where sent_at is null and cancelled_at is null;
create index notification_outbox_checkin_idx on public.notification_outbox (checkin_id)
  where checkin_id is not null;

-- A time zone the database cannot name would make every reminder query throw.
create or replace function public.notification_prefs_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'We don''t know that time zone.';
  end if;
  return new;
end
$$;
revoke execute on function public.notification_prefs_validate() from public, anon, authenticated;
create trigger notification_prefs_validate before insert or update of timezone
  on public.notification_prefs
  for each row execute function public.notification_prefs_validate();

alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_outbox enable row level security;

-- Devices: see and forget your own. Saving goes through save_push_subscription.
create policy "own devices read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own devices forget" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

-- Prefs: private to their owner. last_reminded_on is the server's alone.
create policy "own prefs read" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs update" on public.notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_prefs from anon;
revoke insert, update, delete on public.notification_prefs from authenticated;
grant update (timezone, remind_at, muted) on public.notification_prefs to authenticated;

-- The queue: no policies, no grants. Triggers, cron and send-push only.
revoke all on public.notification_outbox from anon, authenticated;

-- Upserts on endpoint and hands the device to the caller. Also makes sure the caller has
-- a prefs row, falling back to UTC for a zone the database doesn't know.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_timezone text
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  zone text;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' then
    raise exception 'This phone didn''t give us anywhere to send notifications. Try again?';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        last_ok_at = null;
  select name into zone from pg_catalog.pg_timezone_names where name = p_timezone;
  insert into public.notification_prefs (user_id, timezone)
  values (uid, coalesce(zone, 'UTC'))
  on conflict (user_id) do update set timezone = excluded.timezone;
end
$$;
revoke execute on function public.save_push_subscription(text, text, text, text, text)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text)
  to authenticated;
