-- Joining a partner's code from a den of one. Run the whole file in one execute_sql
-- call: it ends in rollback, so nothing persists. Each assert aborts with its message on
-- failure. Ari = a…a, Mia = b…b, Cy = c…c.
begin;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'ari.switch-test@example.invalid'),
  ('b0000000-0000-4000-8000-00000000000b', 'mia.switch-test@example.invalid'),
  ('c0000000-0000-4000-8000-00000000000c', 'cy.switch-test@example.invalid');

-- Ari and Mia both start a den. Mia adds a habit to hers before realising.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select * from public.create_den('Ari', 'rose');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select * from public.create_den('Mia', 'rose');
insert into public.goals (couple_id, title, horizon, created_by)
  values (public.my_couple_id(), 'Stretch', 'day', 'b0000000-0000-4000-8000-00000000000b');
reset role;
select set_config('test.ari_den', (select couple_id::text from public.members where user_id = 'a0000000-0000-4000-8000-00000000000a'), true);
select set_config('test.mia_den', (select couple_id::text from public.members where user_id = 'b0000000-0000-4000-8000-00000000000b'), true);
select set_config('test.ari_code', (select invite_code from public.couples where id = current_setting('test.ari_den')::uuid), true);
select set_config('test.mia_code', (select invite_code from public.couples where id = current_setting('test.mia_den')::uuid), true);

-- Mia types her own code by mistake: refused, nothing changes.
set local role authenticated;
do $$ begin
  perform public.join_den(lower(current_setting('test.mia_code')), 'Mia', 'rose');
  assert false, 'joining your own code must fail';
exception when raise_exception then
  assert sqlerrm like 'That''s your own code%', 'own code: ' || sqlerrm;
end $$;
reset role;
do $$ begin
  assert exists (select 1 from public.couples where id = current_setting('test.mia_den')::uuid
                 and invite_code = current_setting('test.mia_code')),
    'a refused join leaves Mia''s den and code alone';
end $$;

-- Mia joins Ari's code instead: her den of one closes, she lands in Ari's den.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.join_den(current_setting('test.ari_code'), 'Mia', 'rose');
reset role;
do $$ begin
  assert (select couple_id from public.members where user_id = 'b0000000-0000-4000-8000-00000000000b')
         = current_setting('test.ari_den')::uuid, 'Mia is in Ari''s den';
  assert (select color from public.members where user_id = 'b0000000-0000-4000-8000-00000000000b') <> 'rose',
    'Mia gets another colour when Ari has hers';
  assert not exists (select 1 from public.couples where id = current_setting('test.mia_den')::uuid),
    'Mia''s den of one is closed';
  assert not exists (select 1 from public.goals where couple_id = current_setting('test.mia_den')::uuid),
    'and its goals go with it';
  assert (select invite_code from public.couples where id = current_setting('test.ari_den')::uuid) is null,
    'Ari''s code is used up';
  assert (select count(*) from public.notification_outbox
          where kind = 'partner_joined' and recipient_id = 'a0000000-0000-4000-8000-00000000000a') = 1,
    'Ari hears that Mia joined';
end $$;

-- A full den cannot walk out: Ari tries Cy's fresh code.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select * from public.create_den('Cy', 'teal');
reset role;
select set_config('test.cy_code', (select invite_code from public.couples c join public.members m on m.couple_id = c.id
                                    where m.user_id = 'c0000000-0000-4000-8000-00000000000c'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  perform public.join_den(current_setting('test.cy_code'), 'Ari', 'rose');
  assert false, 'a paired partner must not join another den';
exception when raise_exception then
  assert sqlerrm = 'You already have a den.', 'paired: ' || sqlerrm;
end $$;

-- Cy, alone, tries a code that is already used: Cy keeps their own den.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  perform public.join_den(current_setting('test.ari_code'), 'Cy', 'teal');
  assert false, 'a used code must fail';
exception when raise_exception then
  assert sqlerrm like 'That code isn''t waiting%', 'used code: ' || sqlerrm;
end $$;
reset role;
do $$ begin
  assert exists (select 1 from public.members where user_id = 'c0000000-0000-4000-8000-00000000000c'),
    'a failed join leaves Cy in their own den';
end $$;

rollback;
