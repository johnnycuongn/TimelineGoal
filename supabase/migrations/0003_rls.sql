-- `with check` runs after `before` row triggers, so the `couple_id` the
-- triggers fill in is what the policy sees.

alter table public.couples enable row level security;
alter table public.members enable row level security;
alter table public.goals enable row level security;
alter table public.goal_seals enable row level security;
alter table public.checkins enable row level security;
alter table public.reactions enable row level security;
alter table public.keepalive enable row level security;

-- couples: members read; members may edit pup_name and anniversary only; rows are created by RPC.
create policy "members read their couple" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "members update their couple" on public.couples
  for update to authenticated using (id = public.my_couple_id()) with check (id = public.my_couple_id());
revoke insert, update, delete on public.couples from authenticated, anon;
grant update (pup_name, anniversary) on public.couples to authenticated;

-- members: read your den; edit your own name and colour; joining happens via RPC.
create policy "members read their den" on public.members
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members edit themselves" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke insert, update, delete on public.members from authenticated, anon;
grant update (display_name, color) on public.members to authenticated;

-- goals: both partners see and edit every goal in the den; nothing is deleted (archive instead).
create policy "members read goals" on public.goals
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members create goals" on public.goals
  for insert to authenticated with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy "members update goals" on public.goals
  for update to authenticated using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
revoke delete on public.goals from authenticated, anon;

-- seals: read; press your own; never removed.
create policy "members read seals" on public.goal_seals
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members press their seal" on public.goal_seals
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke update, delete on public.goal_seals from authenticated, anon;

-- checkins: read; stamp as yourself; undo your own (habits: today only, with the same day of grace).
create policy "members read checkins" on public.checkins
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members stamp as themselves" on public.checkins
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy "members undo their own" on public.checkins
  for delete to authenticated using (user_id = auth.uid() and (horizon <> 'day' or day >= current_date - 1));
revoke update on public.checkins from authenticated, anon;

-- reactions: read; heart as yourself; hearts are forever.
create policy "members read reactions" on public.reactions
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members heart as themselves" on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke update, delete on public.reactions from authenticated, anon;

-- keepalive: anyone may ping.
create policy "anyone can ping" on public.keepalive
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.keepalive from authenticated, anon;
