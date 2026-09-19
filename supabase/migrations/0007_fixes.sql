-- Fixes from the final whole-branch review. 0002 and 0005 are already applied, so
-- nothing there is edited in place; this migration supersedes them.

-- Correction to 0005_realtime.sql's comment, which is wrong: `replica identity full`
-- does NOT put couple_id on delete payloads. Supabase does not apply RLS to DELETE
-- events, and with RLS enabled the `old` record carries the primary key(s) alone, so a
-- `couple_id=eq.<id>` filter can never match a delete. The client therefore subscribes
-- to checkin deletes unfiltered (src/data/use-couple-data.ts); replica identity full is
-- kept for the update payloads, not for deletes.

-- M6: the habit -> parent grace was one-sided (current_date, current_date + 1), so a user
-- behind UTC creating a habit late on the last day of a month could not attach it to that
-- month's goal. current_date - 1 is now allowed too. Otherwise 0002's function verbatim.
create or replace function public.goals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  parent public.goals;
  up public.horizon;
  parent_changed boolean;
begin
  if new.horizon = 'day' then
    if new.period is not null or new.target_units is not null then
      raise exception 'Daily habits have no period or target.';
    end if;
  else
    if new.period is null or public.period_horizon(new.period) is distinct from new.horizon then
      raise exception 'That period does not match the horizon.';
    end if;
    if new.target_units is null then
      raise exception 'Milestones need a paw target.';
    end if;
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.members where user_id = new.owner_id and couple_id = new.couple_id
  ) then
    raise exception 'The owner must be in this den.';
  end if;

  parent_changed := tg_op = 'INSERT' or new.parent_goal_id is distinct from old.parent_goal_id
    or new.horizon is distinct from old.horizon or new.period is distinct from old.period;
  if new.parent_goal_id is not null and parent_changed then
    select * into parent from public.goals where id = new.parent_goal_id;
    up := public.parent_horizon(new.horizon);
    if parent.id is null or parent.couple_id <> new.couple_id or parent.archived_at is not null then
      raise exception 'That bigger goal is not in this den.';
    end if;
    if up is null or parent.horizon <> up then
      raise exception 'A goal can only climb toward the horizon just above it.';
    end if;
    if new.horizon <> 'day' and not (public.period_range(parent.period) @> public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    -- A habit links to the parent that contains today, with a day of grace on both sides
    -- so neither a user ahead of UTC nor one behind it is locked out at a month boundary.
    if new.horizon = 'day'
       and not (public.period_range(parent.period) @> (current_date - 1)
             or public.period_range(parent.period) @> current_date
             or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for this month.';
    end if;
  end if;
  return new;
end
$$;

-- 0006 revoked execute on this function. `create or replace` keeps the existing ACL, so
-- that revoke still stands; re-stated here so the guarantee does not depend on remembering
-- which migration granted what. Idempotent either way, and the trigger still fires.
revoke execute on function public.goals_validate() from public, anon, authenticated;

-- M8: "members update goals" constrains couple_id only, so a member could rewrite
-- created_by to any auth.users id. Column grants close it. The app updates exactly these
-- five columns: title, charm and target_units (edit), parent_goal_id (edit), archived_at
-- (tuck away, and null again from the undo toast). Nothing else -- horizon, period,
-- owner_id, couple_id, created_by and created_at are set once, at insert.
revoke update on public.goals from authenticated;
grant update (title, charm, target_units, parent_goal_id, archived_at) on public.goals to authenticated;
