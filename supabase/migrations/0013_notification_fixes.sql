-- Push notifications, review fixes: a late reminder still fires, and an undone
-- tuck-away doesn't buzz.

-- Run every 15 minutes. A member is reminded once per due day, in the two hours after
-- the most recent remind_at at or before their local now, if they have a phone, haven't
-- muted it, and still have a paw to give on that day. The window may run past local
-- midnight: a 23:50 reminder fires on the 00:00 tick, counted against the day it was
-- for, so every remind_at gets at least one tick inside its window.
create or replace function public.enqueue_reminders(p_now timestamptz default now())
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  p record;
  local_now timestamp;
  local_day date;
  due_day date;
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
    due_day := case when local_now >= local_day + p.remind_at then local_day else local_day - 1 end;
    continue when p.last_reminded_on is not null and p.last_reminded_on >= due_day;
    continue when local_now >= due_day + p.remind_at + interval '2 hours';
    if public.open_goals_for(p.user_id, due_day) > 0 then
      insert into public.notification_outbox (couple_id, recipient_id, actor_id, kind, send_after)
      values (p.couple_id, p.user_id, null, 'reminder', p_now);
      queued := queued + 1;
    end if;
    update public.notification_prefs set last_reminded_on = due_day where user_id = p.user_id;
  end loop;
  return queued;
end
$$;
revoke execute on function public.enqueue_reminders(timestamptz) from public, anon, authenticated;

-- A tuck-away waits 30 s, like a paw, because the timeline offers "Bring it back".
create or replace function public.notify_goal_archived()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.couple_id, auth.uid(), 'goal_archived', new.id, null, interval '30 seconds');
  return null;
end
$$;
revoke execute on function public.notify_goal_archived() from public, anon, authenticated;

-- Bringing a goal back cancels the tuck-away news that hasn't gone out yet.
create or replace function public.notify_goal_unarchived()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
     set cancelled_at = now()
   where goal_id = new.id and kind = 'goal_archived'
     and sent_at is null and cancelled_at is null;
  return null;
end
$$;
create trigger notify_goal_unarchived after update of archived_at on public.goals
  for each row when (old.archived_at is not null and new.archived_at is null)
  execute function public.notify_goal_unarchived();
revoke execute on function public.notify_goal_unarchived() from public, anon, authenticated;
