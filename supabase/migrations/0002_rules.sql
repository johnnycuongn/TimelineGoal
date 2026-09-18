-- Invariants from the spec, enforced where the data lives. Trigger functions
-- are security definer so they can read sibling rows regardless of RLS.

create or replace function public.members_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.members where couple_id = new.couple_id) >= 2 then
    raise exception 'This den already has two people in it.';
  end if;
  if exists (
    select 1 from public.members
    where couple_id = new.couple_id and color = new.color and user_id <> new.user_id
  ) then
    raise exception 'Your partner already has that colour.';
  end if;
  return new;
end
$$;
create trigger members_limit before insert or update on public.members
  for each row execute function public.members_limit();

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
    -- A habit links to the parent that contains today (UTC, with a day of grace for time zones).
    if new.horizon = 'day'
       and not (public.period_range(parent.period) @> current_date or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for this month.';
    end if;
  end if;
  return new;
end
$$;
create trigger goals_validate before insert or update on public.goals
  for each row execute function public.goals_validate();

-- Creating a shared goal records the creator's seal.
create or replace function public.goals_autoseal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    insert into public.goal_seals (goal_id, user_id, couple_id)
    values (new.id, new.created_by, new.couple_id)
    on conflict do nothing;
  end if;
  return new;
end
$$;
create trigger goals_autoseal after insert on public.goals
  for each row execute function public.goals_autoseal();

create or replace function public.goal_seals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
begin
  select * into g from public.goals where id = new.goal_id;
  if g.id is null or g.owner_id is not null then
    raise exception 'Only shared goals get a seal.';
  end if;
  if not exists (select 1 from public.members where user_id = new.user_id and couple_id = g.couple_id) then
    raise exception 'Only the two of you can seal this.';
  end if;
  new.couple_id := g.couple_id;
  return new;
end
$$;
create trigger goal_seals_validate before insert on public.goal_seals
  for each row execute function public.goal_seals_validate();

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
  if g.horizon <> 'day' then
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
create trigger checkins_validate before insert on public.checkins
  for each row execute function public.checkins_validate();

create or replace function public.reactions_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.checkins;
begin
  select * into c from public.checkins where id = new.checkin_id;
  if c.id is null or not exists (select 1 from public.members where user_id = new.user_id and couple_id = c.couple_id) then
    raise exception 'You are not in this den.';
  end if;
  if c.user_id = new.user_id then
    raise exception 'You can only heart your partner''s paw prints.';
  end if;
  new.couple_id := c.couple_id;
  return new;
end
$$;
create trigger reactions_validate before insert on public.reactions
  for each row execute function public.reactions_validate();
