-- Pairing. All three run as the function owner (security definer) because
-- authenticated users have no insert grant on couples or members.

create or replace function public.gen_share_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return code;
end
$$;

create or replace function public.fresh_share_code()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  code text;
  tries int := 0;
begin
  loop
    code := public.gen_share_code();
    exit when not exists (select 1 from public.couples where invite_code = code);
    tries := tries + 1;
    if tries > 20 then
      raise exception 'Could not mint a code, try again.';
    end if;
  end loop;
  return code;
end
$$;
revoke execute on function public.gen_share_code() from public, anon, authenticated;
revoke execute on function public.fresh_share_code() from public, anon, authenticated;

create or replace function public.create_den(p_display_name text, p_color text)
returns table (couple_id uuid, invite_code text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception 'You already have a den.';
  end if;
  code := public.fresh_share_code();
  insert into public.couples (invite_code, created_by) values (code, uid) returning id into cid;
  insert into public.members (user_id, couple_id, display_name, color) values (uid, cid, p_display_name, p_color);
  return query select cid, code;
end
$$;

create or replace function public.join_den(p_code text, p_display_name text, p_color text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  taken text;
  chosen text := p_color;
  palette constant text[] := array['rose', 'teal', 'blueberry', 'tangerine', 'grape', 'lime', 'sky'];
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception 'You already have a den.';
  end if;
  -- Atomic: the row lock on the update means two joiners cannot both consume one code.
  update public.couples
     set invite_code = null
   where invite_code = upper(regexp_replace(p_code, '[\s-]', '', 'g'))
     and (select count(*) from public.members m where m.couple_id = public.couples.id) = 1
  returning id into cid;
  if cid is null then
    raise exception 'That code isn''t waiting for anyone. Ask your partner for a fresh one.';
  end if;
  select color into taken from public.members where couple_id = cid limit 1;
  if chosen = taken then
    select c into chosen from unnest(palette) with ordinality as t (c, ord) where c <> taken order by ord limit 1;
  end if;
  insert into public.members (user_id, couple_id, display_name, color) values (uid, cid, p_display_name, chosen);
  return cid;
end
$$;

create or replace function public.mint_invite_code()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
begin
  select couple_id into cid from public.members where user_id = uid;
  if cid is null then
    raise exception 'You are not in a den yet.';
  end if;
  if (select count(*) from public.members where couple_id = cid) >= 2 then
    raise exception 'Your den is already full, no code needed.';
  end if;
  code := public.fresh_share_code();
  update public.couples set invite_code = code where id = cid;
  return code;
end
$$;

revoke execute on function public.create_den(text, text) from public, anon;
revoke execute on function public.join_den(text, text, text) from public, anon;
revoke execute on function public.mint_invite_code() from public, anon;
grant execute on function public.create_den(text, text) to authenticated;
grant execute on function public.join_den(text, text, text) to authenticated;
grant execute on function public.mint_invite_code() to authenticated;
