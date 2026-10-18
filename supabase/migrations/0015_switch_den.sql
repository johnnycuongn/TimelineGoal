-- Two people who both tapped "Create den" can still end up together: someone alone in
-- their own den may join their partner's code. Their den of one is closed (and everything
-- in it goes with it) in the same transaction as the join, so they are never in two dens
-- and never in none. A den someone else has already joined is still refused.
create or replace function public.join_den(p_code text, p_display_name text, p_color text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mine uuid;
  cid uuid;
  taken text;
  chosen text := p_color;
  wanted text := upper(regexp_replace(p_code, '[\s-]', '', 'g'));
  palette constant text[] := array['rose', 'teal', 'blueberry', 'tangerine', 'grape', 'lime', 'sky'];
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  select couple_id into mine from public.members where user_id = uid;
  if mine is not null then
    -- Lock our own den first: a partner joining it takes this same row lock, so they and
    -- we cannot both win.
    perform 1 from public.couples where id = mine for update;
    if (select count(*) from public.members where couple_id = mine) > 1 then
      raise exception 'You already have a den.';
    end if;
    if exists (select 1 from public.couples where id = mine and invite_code = wanted) then
      raise exception 'That''s your own code. Send it to your partner, or enter theirs.';
    end if;
  end if;
  -- Atomic: the row lock on the update means two joiners cannot both consume one code.
  update public.couples
     set invite_code = null
   where invite_code = wanted
     and id is distinct from mine
     and (select count(*) from public.members m where m.couple_id = public.couples.id) = 1
  returning id into cid;
  if cid is null then
    raise exception 'That code isn''t waiting for anyone. Ask your partner for a fresh one.';
  end if;
  if mine is not null then
    delete from public.couples where id = mine;
  end if;
  select color into taken from public.members where couple_id = cid limit 1;
  if chosen = taken then
    select c into chosen from unnest(palette) with ordinality as t (c, ord) where c <> taken order by ord limit 1;
  end if;
  insert into public.members (user_id, couple_id, display_name, color) values (uid, cid, p_display_name, chosen);
  return cid;
end
$$;

revoke execute on function public.join_den(text, text, text) from public, anon;
grant execute on function public.join_den(text, text, text) to authenticated;
