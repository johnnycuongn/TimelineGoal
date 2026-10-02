-- Weeks, and a goal climbing toward any longer stretch of time rather than only the one
-- just above it: a habit or a one-off may feed a week, month, quarter or year; a week a
-- month, quarter or year; a month a quarter or year.
--
-- A week key is an ISO week, 'YYYY-Www', Monday to Sunday. Weeks ignore month lines, so a
-- week is linked to any parent it overlaps. Everything else still sits inside its parent.

-- The Monday an ISO week starts on: 4 January is always in week 1.
create or replace function public.week_start(p text)
returns date
language sql immutable
set search_path = ''
as $$
  select make_date(left(p, 4)::int, 1, 4)
    - (extract(isodow from make_date(left(p, 4)::int, 1, 4))::int - 1)
    + (right(p, 2)::int - 1) * 7
$$;
revoke execute on function public.week_start(text) from public, anon;

-- A week key that names a week that exists. Week 53 only does in some years, and
-- week_start would quietly roll it into the next year's week 1, so round-trip it.
create or replace function public.is_week_key(p text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if p is null or p !~ '^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' then
    return false;
  end if;
  return extract(isoyear from public.week_start(p))::int = left(p, 4)::int;
exception when others then
  return false;
end
$$;
revoke execute on function public.is_week_key(text) from public, anon;

create or replace function public.period_horizon(p text)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case
    when p ~ '^\d{4}$' then 'year'::public.horizon
    when p ~ '^\d{4}-Q[1-4]$' then 'quarter'::public.horizon
    when p ~ '^\d{4}-(0[1-9]|1[0-2])$' then 'month'::public.horizon
    when public.is_week_key(p) then 'week'::public.horizon
    when public.is_day_key(p) then 'day'::public.horizon
  end
$$;

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
  elsif public.is_week_key(p) then
    first_day := public.week_start(p);
    return daterange(first_day, first_day + 6, '[]');
  elsif public.is_day_key(p) then
    return daterange(p::date, p::date, '[]');
  end if;
  raise exception 'Invalid period %', p;
end
$$;

-- 0008's function. The horizon rule becomes "longer than mine" (the enum is in length
-- order), a week only has to overlap its parent, and the habit's grace message no longer
-- assumes the parent is a month.
create or replace function public.goals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  parent public.goals;
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
    if parent.id is null or parent.couple_id <> new.couple_id or parent.archived_at is not null then
      raise exception 'That bigger goal is not in this den.';
    end if;
    -- 'day' is the shortest horizon, so past this check the parent is a milestone and
    -- always has a period for the range checks below.
    if parent.horizon <= new.horizon then
      raise exception 'A goal can only climb toward a longer stretch of time.';
    end if;
    -- A week shares at least a day with its parent; anything else with a period of its
    -- own -- a milestone or a one-off -- sits inside the parent's stretch of time.
    if new.horizon = 'week'
       and not (public.period_range(parent.period) && public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    if new.horizon <> 'week' and new.period is not null
       and not (public.period_range(parent.period) @> public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    -- A habit has no period, so it links to a parent that holds today, with a day of
    -- grace on both sides so neither a user ahead of UTC nor one behind it is locked out.
    if new.period is null
       and not (public.period_range(parent.period) @> (current_date - 1)
             or public.period_range(parent.period) @> current_date
             or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for now.';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.goals_validate() from public, anon, authenticated;

-- Nothing asks for "the one horizon above" any more.
drop function if exists public.parent_horizon(public.horizon);
