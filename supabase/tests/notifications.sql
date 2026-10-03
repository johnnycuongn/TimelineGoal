-- Notification scenarios against the real schema. Run the whole file in one
-- execute_sql call: it ends in rollback, so nothing persists. Each assert aborts with
-- its message on failure. Ari = a…a, Mia = b…b. `now()` is fixed for a transaction,
-- so "30 seconds later" is exactly now() + 30 s.
begin;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'ari.notify-test@example.invalid'),
  ('b0000000-0000-4000-8000-00000000000b', 'mia.notify-test@example.invalid');

-- Ari makes a den, alone: nobody to tell.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select * from public.create_den('Ari', 'rose');
reset role;
select set_config('test.couple', (select couple_id::text from public.members where user_id = 'a0000000-0000-4000-8000-00000000000a'), true);
select set_config('test.code', (select invite_code from public.couples where id = current_setting('test.couple')::uuid), true);
do $$ begin
  assert (select count(*) from public.notification_outbox where couple_id = current_setting('test.couple')::uuid) = 0,
    'a den of one queues nothing';
end $$;

-- Mia joins: Ari hears about it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.join_den(current_setting('test.code'), 'Mia', 'teal');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'partner_joined' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and actor_id = 'b0000000-0000-4000-8000-00000000000b' and send_after = now()) = 1,
    'Ari hears that Mia joined, straight away';
end $$;

-- Ari adds five goals. Mia hears about each; Ari's own autoseal is not news.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.goals (id, couple_id, title, charm, horizon, owner_id, period, target_units, created_by) values
  ('c1000000-0000-4000-8000-000000000001', public.my_couple_id(), 'Morning run', '🏃', 'day', null, null, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000002', public.my_couple_id(), 'Read 20 pages', '📚', 'day', 'a0000000-0000-4000-8000-00000000000a', null, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000003', public.my_couple_id(), 'Save $500', null, 'month', null, to_char(current_date, 'YYYY-MM'), 2, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000004', public.my_couple_id(), 'Call the vet', null, 'day', null, current_date::text, null, 'a0000000-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000005', public.my_couple_id(), 'Pack', null, 'day', null, (current_date + 1)::text, null, 'a0000000-0000-4000-8000-00000000000a');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'goal_added' and recipient_id = 'b0000000-0000-4000-8000-00000000000b') = 5,
    'Mia hears about five new goals';
  assert (select count(*) from public.notification_outbox
          where kind = 'seal' and couple_id = current_setting('test.couple')::uuid) = 0,
    'the creator''s automatic seal is not news';
end $$;

-- Mia seals the run: Ari hears.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.goal_seals (goal_id, user_id, couple_id)
  values ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', public.my_couple_id());

-- Mia paws the shared run, then thinks better of it.
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000001', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', current_date, 'day');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'seal' and recipient_id = 'a0000000-0000-4000-8000-00000000000a') = 1,
    'Ari hears that Mia sealed the run';
  assert (select count(*) from public.notification_outbox
          where kind = 'paw_shared' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and checkin_id = 'd1000000-0000-4000-8000-000000000001'
            and send_after = now() + interval '30 seconds') = 1,
    'a shared paw waits 30 seconds';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
delete from public.checkins where id = 'd1000000-0000-4000-8000-000000000001';
reset role;
do $$ begin
  assert (select cancelled_at from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000001') is not null,
    'undoing the paw cancels its notification';
end $$;

-- Ari paws his own book: Mia hears it as an own paw.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000002', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', current_date, 'day');
-- Milestone, target 2: Ari's paw is the first.
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000003', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', current_date, 'month');
reset role;
do $$ begin
  assert (select kind from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000002') = 'paw_own',
    'a paw on your own goal is paw_own';
  assert (select count(*) from public.notification_outbox
          where kind = 'milestone_done' and couple_id = current_setting('test.couple')::uuid) = 0,
    'one of two paws is not a finish';
end $$;

-- Mia's paw reaches the target: Ari gets a paw and a celebration on the same check-in.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.checkins (id, couple_id, goal_id, user_id, day, horizon) values
  ('d1000000-0000-4000-8000-000000000004', public.my_couple_id(), 'c1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b', current_date, 'month');
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000004'
            and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and kind in ('paw_shared', 'milestone_done')) = 2,
    'the finishing paw queues a paw and a milestone';
end $$;

-- Ari hearts Mia's finishing paw: Mia hears.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.reactions (checkin_id, user_id, couple_id)
  values ('d1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', public.my_couple_id());
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where kind = 'heart' and recipient_id = 'b0000000-0000-4000-8000-00000000000b'
            and goal_id = 'c1000000-0000-4000-8000-000000000003') = 1,
    'Mia hears about the heart';
end $$;

-- Mia undoes the finishing paw: both its paw and its celebration are cancelled.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
delete from public.checkins where id = 'd1000000-0000-4000-8000-000000000004';
-- Mia tucks tomorrow's packing away: Ari hears, after the same 30 s an undo gets.
update public.goals set archived_at = now() where id = 'c1000000-0000-4000-8000-000000000005';
-- Mia tucks the vet away, then taps "Bring it back": Ari never hears about it.
update public.goals set archived_at = now() where id = 'c1000000-0000-4000-8000-000000000004';
update public.goals set archived_at = null where id = 'c1000000-0000-4000-8000-000000000004';
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox
          where checkin_id = 'd1000000-0000-4000-8000-000000000004' and cancelled_at is null
            and kind in ('paw_shared', 'milestone_done')) = 0,
    'undoing the finishing paw cancels the celebration too';
  assert (select count(*) from public.notification_outbox
          where kind = 'goal_archived' and recipient_id = 'a0000000-0000-4000-8000-00000000000a'
            and actor_id = 'b0000000-0000-4000-8000-00000000000b'
            and goal_id = 'c1000000-0000-4000-8000-000000000005' and cancelled_at is null
            and send_after = now() + interval '30 seconds') = 1,
    'Ari hears that Mia tucked a goal away, after 30 seconds';
  assert (select count(*) from public.notification_outbox
          where kind = 'goal_archived' and goal_id = 'c1000000-0000-4000-8000-000000000004'
            and cancelled_at is not null) = 1
     and (select count(*) from public.notification_outbox
          where kind = 'goal_archived' and goal_id = 'c1000000-0000-4000-8000-000000000004'
            and cancelled_at is null) = 0,
    'bringing a goal back cancels its tuck-away news';
end $$;

-- Open goals today. Ari: run (open), book (pawed), vet (today, open) = 2.
-- Mia: run (paw undone, open), vet (open); Ari's book is not hers = 2.
-- Tomorrow for Ari: run and book are both daily habits, and today's paw on book only
-- covers today, so both are still untouched for tomorrow; vet is today's only and
-- packing is archived = 2.
do $$ begin
  assert public.open_goals_for('a0000000-0000-4000-8000-00000000000a', current_date) = 2, 'Ari has 2 open';
  assert public.open_goals_for('b0000000-0000-4000-8000-00000000000b', current_date) = 2, 'Mia has 2 open';
  assert public.open_goals_for('a0000000-0000-4000-8000-00000000000a', current_date + 1) = 2, 'Ari has 2 open tomorrow';
end $$;

-- Claiming: every due row in this den once (paws and tuck-aways wait 30 s, so they are
-- not due yet).
create temporary table claimed on commit drop as
  select * from public.claim_due_notifications(1000) where couple_id = current_setting('test.couple')::uuid;
do $$ begin
  assert (select count(*) from claimed) = (
    select count(*) from public.notification_outbox
    where couple_id = current_setting('test.couple')::uuid and cancelled_at is null and send_after <= now()),
    'every due row is claimed';
  assert not exists (select 1 from claimed
                     where kind in ('paw_shared', 'paw_own', 'milestone_done', 'goal_archived')),
    'paws and tuck-aways are not due inside their 30 seconds';
  assert (select bool_and(attempts = 1 and claimed_at = now()) from claimed), 'claiming counts an attempt';
  assert (select count(*) from public.claim_due_notifications(1000)
          where couple_id = current_setting('test.couple')::uuid) = 0,
    'a claimed row is not claimed twice';
end $$;

-- Reminders. Ari has a phone and lives in Sydney; Mia has no phone. Counts are read
-- from this den's rows, never from enqueue_reminders' return value, so real members
-- with notifications on can't disturb the result.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('a0000000-0000-4000-8000-00000000000a', 'https://push.example.invalid/ari', 'k', 'a');
insert into public.notification_prefs (user_id, timezone, remind_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'Australia/Sydney', '20:00'),
  ('b0000000-0000-4000-8000-00000000000b', 'Australia/Sydney', '20:00');
create function pg_temp.reminders() returns bigint language sql as $f$
  select count(*) from public.notification_outbox
   where kind = 'reminder' and couple_id = current_setting('test.couple')::uuid
$f$;
do $$ begin
  perform public.enqueue_reminders('2030-01-15 19:55 Australia/Sydney');
  assert pg_temp.reminders() = 0, 'not before remind_at';
  perform public.enqueue_reminders('2030-01-15 20:05 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'reminded at 20:05';
  assert (select recipient_id from public.notification_outbox
          where kind = 'reminder' and couple_id = current_setting('test.couple')::uuid)
    = 'a0000000-0000-4000-8000-00000000000a', 'only Ari: Mia has no phone';
  assert (select last_reminded_on from public.notification_prefs
          where user_id = 'a0000000-0000-4000-8000-00000000000a') = '2030-01-15', 'Sydney''s date is recorded';
  perform public.enqueue_reminders('2030-01-15 20:20 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'once a day';
  perform public.enqueue_reminders('2030-01-16 22:30 Australia/Sydney');
  assert pg_temp.reminders() = 1, 'not after the two-hour window';
end $$;
update public.notification_prefs set remind_at = '23:00' where user_id = 'a0000000-0000-4000-8000-00000000000a';
do $$ begin
  perform public.enqueue_reminders('2030-01-17 23:30 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'a late reminder fires at 23:30';
  perform public.enqueue_reminders('2030-01-18 00:30 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'and not again after midnight';
end $$;
update public.notification_prefs set muted = '{reminder}' where user_id = 'a0000000-0000-4000-8000-00000000000a';
do $$ begin
  perform public.enqueue_reminders('2030-01-19 23:05 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'a muted reminder never queues';
end $$;
-- A reminder in the last quarter hour of the day: no tick falls between 23:50 and
-- midnight, so it fires on the 00:00 tick, counted against the day it was for.
update public.notification_prefs set muted = '{}', remind_at = '23:50'
 where user_id = 'a0000000-0000-4000-8000-00000000000a';
do $$ begin
  perform public.enqueue_reminders('2030-01-20 23:45 Australia/Sydney');
  assert pg_temp.reminders() = 2, 'not before a 23:50 remind_at';
  perform public.enqueue_reminders('2030-01-21 00:00 Australia/Sydney');
  assert pg_temp.reminders() = 3, 'a 23:50 reminder fires on the midnight tick';
  assert (select last_reminded_on from public.notification_prefs
          where user_id = 'a0000000-0000-4000-8000-00000000000a') = '2030-01-20',
    'the midnight reminder counts for the day before';
  perform public.enqueue_reminders('2030-01-21 00:15 Australia/Sydney');
  assert pg_temp.reminders() = 3, 'and fires once';
end $$;

-- Clients may not run the server's functions.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  perform public.claim_due_notifications(1);
  raise exception 'a client could claim notifications';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.enqueue_notification(public.my_couple_id(), auth.uid(), 'heart', null, null, interval '0');
  raise exception 'a client could enqueue a notification';
exception when insufficient_privilege then null;
end $$;
reset role;

-- A push endpoint is a short URL; a longer one is either a bug or abuse, and would
-- otherwise surface as a raw index-size error.
do $$ begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('a0000000-0000-4000-8000-00000000000a', 'https://push.example.invalid/' || repeat('x', 1000), 'k', 'a');
  raise exception 'an overlong endpoint was accepted';
exception when check_violation then null;
end $$;

select 'all good' as result;
rollback;
