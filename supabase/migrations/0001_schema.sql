-- CoupleGoal schema. Every couple-scoped table carries couple_id so RLS and
-- Realtime filters are one column. Invariants live in 0002_rules.sql.
create extension if not exists pgcrypto;

create type public.horizon as enum ('day', 'month', 'quarter', 'year');

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  pup_name text check (pup_name is null or char_length(pup_name) between 1 and 24),
  anniversary date,
  invite_code text unique check (invite_code is null or invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null check (color in ('rose', 'teal', 'blueberry', 'tangerine', 'grape', 'lime', 'sky')),
  joined_at timestamptz not null default now()
);
create index members_couple_idx on public.members (couple_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  charm text check (charm is null or char_length(charm) between 1 and 16),
  horizon public.horizon not null,
  owner_id uuid references auth.users (id) on delete set null, -- null = shared
  period text,
  target_units int check (target_units is null or target_units between 1 and 20),
  parent_goal_id uuid references public.goals (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index goals_couple_idx on public.goals (couple_id, horizon, period);

create table public.goal_seals (
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  sealed_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);
create index goal_seals_couple_idx on public.goal_seals (couple_id);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  horizon public.horizon not null,
  at timestamptz not null default now()
);
-- One habit paw per partner per day; milestones may take several stamps a day.
create unique index checkins_one_paw_per_day on public.checkins (goal_id, user_id, day) where horizon = 'day';
create index checkins_couple_at_idx on public.checkins (couple_id, at desc);
create index checkins_goal_idx on public.checkins (goal_id);

create table public.reactions (
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  kind text not null default 'heart' check (kind = 'heart'),
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);
create index reactions_couple_idx on public.reactions (couple_id);

-- Pinged by the Vercel cron so the free project never pauses.
create table public.keepalive (id int primary key);
insert into public.keepalive (id) values (1);

-- Helpers -------------------------------------------------------------------

-- The caller's den. security definer so member policies can call it without recursing into themselves.
create or replace function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select couple_id from public.members where user_id = auth.uid()
$$;
revoke execute on function public.my_couple_id() from public, anon;
grant execute on function public.my_couple_id() to authenticated;

create or replace function public.period_horizon(p text)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case
    when p ~ '^\d{4}$' then 'year'::public.horizon
    when p ~ '^\d{4}-Q[1-4]$' then 'quarter'::public.horizon
    when p ~ '^\d{4}-(0[1-9]|1[0-2])$' then 'month'::public.horizon
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
  end if;
  raise exception 'Invalid period %', p;
end
$$;

create or replace function public.parent_horizon(h public.horizon)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case h
    when 'day' then 'month'::public.horizon
    when 'month' then 'quarter'::public.horizon
    when 'quarter' then 'year'::public.horizon
    else null
  end
$$;
