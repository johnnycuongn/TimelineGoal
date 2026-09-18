-- Hardening from the Supabase advisors after the first apply.

-- Trigger functions are not RPCs: nobody calls them over the API. Triggers still fire.
revoke execute on function public.members_limit() from public, anon, authenticated;
revoke execute on function public.goals_validate() from public, anon, authenticated;
revoke execute on function public.goals_autoseal() from public, anon, authenticated;
revoke execute on function public.goal_seals_validate() from public, anon, authenticated;
revoke execute on function public.checkins_validate() from public, anon, authenticated;
revoke execute on function public.reactions_validate() from public, anon, authenticated;

-- auth.uid() evaluated once per statement instead of once per row.
drop policy "members edit themselves" on public.members;
create policy "members edit themselves" on public.members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and couple_id = public.my_couple_id());

drop policy "members create goals" on public.goals;
create policy "members create goals" on public.goals
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and created_by = (select auth.uid()));

drop policy "members press their seal" on public.goal_seals;
create policy "members press their seal" on public.goal_seals
  for insert to authenticated
  with check (user_id = (select auth.uid()) and couple_id = public.my_couple_id());

drop policy "members stamp as themselves" on public.checkins;
create policy "members stamp as themselves" on public.checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()) and couple_id = public.my_couple_id());

drop policy "members undo their own" on public.checkins;
create policy "members undo their own" on public.checkins
  for delete to authenticated
  using (user_id = (select auth.uid()) and (horizon <> 'day' or day >= current_date - 1));

drop policy "members heart as themselves" on public.reactions;
create policy "members heart as themselves" on public.reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and couple_id = public.my_couple_id());

-- Covering indexes for the remaining foreign keys.
create index checkins_user_idx on public.checkins (user_id);
create index goal_seals_user_idx on public.goal_seals (user_id);
create index reactions_user_idx on public.reactions (user_id);
create index goals_owner_idx on public.goals (owner_id);
create index goals_parent_idx on public.goals (parent_goal_id);
create index goals_created_by_idx on public.goals (created_by);
create index couples_created_by_idx on public.couples (created_by);
