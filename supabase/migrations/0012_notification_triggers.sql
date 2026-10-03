-- Push notifications, part 2: triggers fill the outbox; the server claims from it.
-- Every trigger is `after`, so a write that fails validation never queues anything.

-- Queues one row for the other member of the couple. A den of one has nobody to tell;
-- a null actor (no auth.uid()) matches nobody, so server-side writes stay quiet.
create or replace function public.enqueue_notification(
  p_couple uuid, p_actor uuid, p_kind public.notification_kind,
  p_goal uuid, p_checkin uuid, p_delay interval
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox
    (couple_id, recipient_id, actor_id, kind, goal_id, checkin_id, send_after)
  select p_couple, m.user_id, p_actor, p_kind, p_goal, p_checkin, now() + p_delay
    from public.members m
   where m.couple_id = p_couple and m.user_id <> p_actor;
end
$$;
revoke execute on function public.enqueue_notification(uuid, uuid, public.notification_kind, uuid, uuid, interval)
  from public, anon, authenticated;

-- A paw waits 30 s so an undo can cancel it. The paw that brings a milestone's count in
-- its period to exactly target_units also queues the celebration, on the same check-in,
-- so undoing that paw cancels both. The count matches checkins_validate: both partners.
create or replace function public.notify_checkin_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
  stamped int;
begin
  select * into g from public.goals where id = new.goal_id;
  perform public.enqueue_notification(
    new.couple_id, new.user_id,
    case when g.owner_id is null then 'paw_shared' else 'paw_own' end::public.notification_kind,
    new.goal_id, new.id, interval '30 seconds');
  if g.horizon <> 'day' then
    select count(*) into stamped
      from public.checkins
     where goal_id = g.id and public.period_range(g.period) @> day;
    if stamped = g.target_units then
      perform public.enqueue_notification(
        new.couple_id, new.user_id, 'milestone_done', new.goal_id, new.id, interval '30 seconds');
    end if;
  end if;
  return null;
end
$$;
create trigger notify_checkin_insert after insert on public.checkins
  for each row execute function public.notify_checkin_insert();

create or replace function public.notify_checkin_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
     set cancelled_at = now()
   where checkin_id = old.id and sent_at is null and cancelled_at is null;
  return null;
end
$$;
create trigger notify_checkin_delete after delete on public.checkins
  for each row execute function public.notify_checkin_delete();

-- reactions_validate already refuses a heart on your own paw; the check here is belt
-- and braces so a future rule change can't buzz someone about themselves.
create or replace function public.notify_reaction()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.checkins;
begin
  select * into c from public.checkins where id = new.checkin_id;
  if c.user_id is not null and c.user_id <> new.user_id then
    perform public.enqueue_notification(
      new.couple_id, new.user_id, 'heart', c.goal_id, new.checkin_id, interval '0');
  end if;
  return null;
end
$$;
create trigger notify_reaction after insert on public.reactions
  for each row execute function public.notify_reaction();

-- goals_autoseal seals for the creator; that is not news. Only a seal by the other
-- partner on a goal the recipient created is.
create or replace function public.notify_seal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  creator uuid;
begin
  select created_by into creator from public.goals where id = new.goal_id;
  if creator is not null and creator <> new.user_id then
    perform public.enqueue_notification(
      new.couple_id, new.user_id, 'seal', new.goal_id, null, interval '0');
  end if;
  return null;
end
$$;
create trigger notify_seal after insert on public.goal_seals
  for each row execute function public.notify_seal();

create or replace function public.notify_goal_added()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, new.created_by, 'goal_added', new.id, null, interval '0');
  return null;
end
$$;
create trigger notify_goal_added after insert on public.goals
  for each row execute function public.notify_goal_added();

create or replace function public.notify_goal_archived()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, auth.uid(), 'goal_archived', new.id, null, interval '0');
  return null;
end
$$;
create trigger notify_goal_archived after update of archived_at on public.goals
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function public.notify_goal_archived();

create or replace function public.notify_member_joined()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, new.user_id, 'partner_joined', null, null, interval '0');
  return null;
end
$$;
create trigger notify_member_joined after insert on public.members
  for each row execute function public.notify_member_joined();

revoke execute on function public.notify_checkin_insert() from public, anon, authenticated;
revoke execute on function public.notify_checkin_delete() from public, anon, authenticated;
revoke execute on function public.notify_reaction() from public, anon, authenticated;
revoke execute on function public.notify_seal() from public, anon, authenticated;
revoke execute on function public.notify_goal_added() from public, anon, authenticated;
revoke execute on function public.notify_goal_archived() from public, anon, authenticated;
revoke execute on function public.notify_member_joined() from public, anon, authenticated;

-- Day goals still waiting for p_user's paw on p_day: their own or shared, not archived,
-- a habit or a one-off for that day. Milestones never count.
create or replace function public.open_goals_for(p_user uuid, p_day date)
returns int
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int
    from public.goals g
    join public.members m on m.couple_id = g.couple_id and m.user_id = p_user
   where g.horizon = 'day'
     and g.archived_at is null
     and (g.owner_id is null or g.owner_id = p_user)
     and (g.period is null or g.period = p_day::text)
     and not exists (
       select 1 from public.checkins c
        where c.goal_id = g.id and c.user_id = p_user and c.day = p_day)
$$;
revoke execute on function public.open_goals_for(uuid, date) from public, anon, authenticated;
grant execute on function public.open_goals_for(uuid, date) to service_role;

-- Hands out due rows once. A row claimed over 2 minutes ago and still unsent (the
-- function died, or the push service asked us to retry) is due again.
create or replace function public.claim_due_notifications(p_limit int default 100)
returns setof public.notification_outbox
language sql volatile security definer
set search_path = ''
as $$
  update public.notification_outbox o
     set claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select id from public.notification_outbox
      where sent_at is null and cancelled_at is null and send_after <= now()
        and (claimed_at is null or claimed_at < now() - interval '2 minutes')
      order by send_after
      limit p_limit
      for update skip locked)
  returning o.*
$$;
revoke execute on function public.claim_due_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(int) to service_role;

-- Run every 15 minutes. A member is reminded once per local day, in the two hours after
-- their remind_at on that local day, if they have a phone, haven't muted it, and still
-- have a paw to give. The window never wraps past midnight: 00:30 is a new local day
-- whose remind_at hasn't come yet.
create or replace function public.enqueue_reminders(p_now timestamptz default now())
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  p record;
  local_now timestamp;
  local_day date;
  queued int := 0;
begin
  for p in
    select np.user_id, np.timezone, np.remind_at, np.last_reminded_on, m.couple_id
      from public.notification_prefs np
      join public.members m on m.user_id = np.user_id
     where not ('reminder' = any (np.muted))
       and exists (select 1 from public.push_subscriptions s where s.user_id = np.user_id)
  loop
    local_now := p_now at time zone p.timezone;
    local_day := local_now::date;
    continue when p.last_reminded_on is not null and p.last_reminded_on >= local_day;
    continue when local_now < local_day + p.remind_at
               or local_now >= local_day + p.remind_at + interval '2 hours';
    if public.open_goals_for(p.user_id, local_day) > 0 then
      insert into public.notification_outbox (couple_id, recipient_id, actor_id, kind, send_after)
      values (p.couple_id, p.user_id, null, 'reminder', p_now);
      queued := queued + 1;
    end if;
    update public.notification_prefs set last_reminded_on = local_day where user_id = p.user_id;
  end loop;
  return queued;
end
$$;
revoke execute on function public.enqueue_reminders(timestamptz) from public, anon, authenticated;

create or replace function public.prune_notifications()
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from public.notification_outbox where created_at < now() - interval '30 days';
  delete from public.push_subscriptions
   where coalesce(last_ok_at, created_at) < now() - interval '60 days';
$$;
revoke execute on function public.prune_notifications() from public, anon, authenticated;

-- A push endpoint is a short URL; a longer one is either a bug or abuse, and would
-- otherwise surface as a raw index-size error.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_length check (char_length(endpoint) <= 1000);
