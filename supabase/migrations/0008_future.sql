-- Goals in the future. Milestones needed nothing here: goals_validate never asked what
-- day it was, and checkins_validate's clock guard already makes a future goal plannable
-- but not stampable. This migration is entirely about the new shape of a `day` goal --
-- period null is still a habit, a day key is a one-off on that one day.

-- A day key that is also a real date. The regex alone would accept 2026-02-30, and
-- period_range would then raise a Postgres range error instead of one of our sentences.
create or replace function public.is_day_key(p text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  perform p::date;
  return true;
exception when others then
  return false;
end
$$;
revoke execute on function public.is_day_key(text) from public, anon;

-- A one-off's period is a day, and its horizon is 'day'.
create or replace function public.period_horizon(p text)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case
    when p ~ '^\d{4}$' then 'year'::public.horizon
    when p ~ '^\d{4}-Q[1-4]$' then 'quarter'::public.horizon
    when p ~ '^\d{4}-(0[1-9]|1[0-2])$' then 'month'::public.horizon
    when public.is_day_key(p) then 'day'::public.horizon
  end
$$;

-- A day key is the one-day range, so the parent containment check below needs no special
-- case: period_range(parent) @> period_range(one-off) just works.
create or replace function public.period_range(p text)
returns daterange
language plpgsql immutable
set search_path = ''
as $$
declare
  y int;
  m int;
  q int;
  first_day date;
begin
  if p ~ '^\d{4}$' then
    y := p::int;
    return daterange(make_date(y, 1, 1), make_date(y, 12, 31), '[]');
  elsif p ~ '^\d{4}-Q[1-4]$' then
    y := left(p, 4)::int;
    q := right(p, 1)::int;
    first_day := make_date(y, (q - 1) * 3 + 1, 1);
    return daterange(first_day, (first_day + interval '3 months' - interval '1 day')::date, '[]');
  elsif p ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    y := left(p, 4)::int;
    m := right(p, 2)::int;
    first_day := make_date(y, m, 1);
    return daterange(first_day, (first_day + interval '1 month' - interval '1 day')::date, '[]');
  elsif public.is_day_key(p) then
    return daterange(p::date, p::date, '[]');
  end if;
  raise exception 'Invalid period %', p;
end
$$;

-- 0007's function, with the day branch split into habit and one-off. A habit still links
-- to the parent holding today, a day of grace on both sides for time zones; a one-off
-- links to whatever covers its own day, by the same containment rule as a milestone.
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
    if new.target_units is not null then
      raise exception 'Habits and one-off goals have no paw target.';
    end if;
    if new.period is not null and not public.is_day_key(new.period) then
      raise exception 'A one-off goal needs a real date.';
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
    -- Anything with a period of its own -- a milestone or a one-off -- must sit inside
    -- the parent's stretch of time.
    if new.period is not null
       and not (public.period_range(parent.period) @> public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    -- A habit has no period, so it links to the parent that holds today, with a day of
    -- grace on both sides so neither a user ahead of UTC nor one behind it is locked out.
    if new.period is null
       and not (public.period_range(parent.period) @> (current_date - 1)
             or public.period_range(parent.period) @> current_date
             or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for this month.';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.goals_validate() from public, anon, authenticated;

-- A one-off's paw belongs on its own day. The clock guard above already refuses any day
-- outside current_date +/- 1, so together these are what stop a goal written down for
-- next March being stamped the afternoon it was dreamt up.
create or replace function public.checkins_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
  r daterange;
  stamped int;
begin
  select * into g from public.goals where id = new.goal_id;
  if g.id is null or g.archived_at is not null then
    raise exception 'That goal is tucked away.';
  end if;
  if not exists (select 1 from public.members where user_id = new.user_id and couple_id = g.couple_id) then
    raise exception 'You are not in this den.';
  end if;
  if g.owner_id is not null and g.owner_id <> new.user_id then
    raise exception 'Only the owner stamps this one.';
  end if;
  if new.day < current_date - 1 or new.day > current_date + 1 then
    raise exception 'Your clock and ours disagree. Reload and try again.';
  end if;
  new.couple_id := g.couple_id;
  new.horizon := g.horizon;
  if g.horizon = 'day' then
    if g.period is not null and g.period::date <> new.day then
      raise exception 'That one is for another day.';
    end if;
  else
    r := public.period_range(g.period);
    if not (r @> new.day) then
      raise exception 'That goal belongs to another stretch of time.';
    end if;
    select count(*) into stamped from public.checkins where goal_id = g.id and r @> day;
    if stamped >= g.target_units then
      raise exception 'Every paw is already on this one.';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.checkins_validate() from public, anon, authenticated;
