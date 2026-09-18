-- Realtime: the client subscribes to postgres_changes on these tables filtered by
-- couple_id (couples by id). replica identity full puts couple_id on delete payloads.
alter publication supabase_realtime add table
  public.couples, public.members, public.goals, public.goal_seals, public.checkins, public.reactions;
alter table public.couples replica identity full;
alter table public.members replica identity full;
alter table public.goals replica identity full;
alter table public.goal_seals replica identity full;
alter table public.checkins replica identity full;
alter table public.reactions replica identity full;
