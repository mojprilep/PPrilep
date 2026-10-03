-- ════════════════════════════════════════════════════════════════════════════
--  Group chats, part 3 (after add_chat_requests.sql): two kinds of ban.
--
--  • Everywhere (chat_bans, site admins only) — unchanged: can read, can't
--    write in any group.
--  • Group only (chat_group_bans, NEW) — the group's admins or site admins.
--    The person is removed from that one group and can't rejoin, be re-added,
--    read or write there until unbanned. Other groups are unaffected.
--
--  Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.chat_group_bans (
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  banned_by  uuid references public.profiles(id) on delete set null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists chat_group_bans_user_idx on public.chat_group_bans (user_id);

grant select on public.chat_group_bans to authenticated;
grant select, insert, update, delete on public.chat_group_bans to service_role;

alter table public.chat_group_bans enable row level security;
drop policy if exists "chat group bans admins or self" on public.chat_group_bans;
create policy "chat group bans admins or self" on public.chat_group_bans for select to authenticated
  using (user_id = auth.uid() or public.chat_is_group_admin(group_id));
-- Writes only through the functions below.

-- Is the caller banned from this group?
create or replace function public.chat_is_group_banned(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_group_bans
                  where group_id = p_group and user_id = auth.uid());
$$;
grant execute on function public.chat_is_group_banned(uuid) to authenticated;

-- Joining: same rules as before, but never for someone banned from the group.
create or replace function public.chat_can_join(p_group uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare g public.chat_groups;
begin
  select * into g from public.chat_groups where id = p_group;
  if not found then return false; end if;
  if public.is_admin() then return true; end if;
  if public.chat_is_group_banned(p_group) then return false; end if;
  if g.kind = 'custom' then return g.is_open; end if;
  if g.kind = 'initiative' then
    return exists (select 1 from public.initiatives
                    where id::text = g.ref and user_id = auth.uid())
        or exists (select 1 from public.initiative_votes
                    where initiative_id::text = g.ref and user_id = auth.uid());
  end if;
  if g.kind = 'club' then
    return public.user_owns_club(g.ref)
        or exists (select 1 from public.club_followers
                    where club_slug = g.ref and user_id = auth.uid());
  end if;
  return false;
end;
$$;

-- A clear error instead of a generic "not allowed" when a banned person tries.
create or replace function public.chat_join(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.chat_is_member(p_group) then return; end if;
  if public.chat_is_group_banned(p_group) and not public.is_admin() then
    raise exception 'banned_here';
  end if;
  if not public.chat_can_join(p_group) then raise exception 'not_allowed'; end if;
  insert into public.chat_members (group_id, user_id) values (p_group, auth.uid())
  on conflict do nothing;
end;
$$;

-- Initiative / club chats: same open-or-create as before, plus the ban check.
create or replace function public.chat_open_group(p_kind text, p_ref text, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text;
  v_role text := 'member';
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('initiative','club') or p_ref is null then raise exception 'bad_group'; end if;

  if p_kind = 'initiative' then
    select title, case when user_id = auth.uid() then 'admin' else 'member' end
      into v_name, v_role
      from public.initiatives where id::text = p_ref;
    if v_name is null then raise exception 'not_found'; end if;
  else
    v_name := coalesce(nullif(btrim(p_name), ''), p_ref);
    if p_ref = public.current_user_club() then v_role := 'admin'; end if;
  end if;

  select id into v_id from public.chat_groups where kind = p_kind and ref = p_ref;
  if v_id is null then
    insert into public.chat_groups (kind, ref, name, created_by)
    values (p_kind, p_ref, left(v_name, 80), auth.uid())
    on conflict (kind, ref) where ref is not null do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.chat_groups where kind = p_kind and ref = p_ref;
    end if;
  end if;

  if not public.chat_is_member(v_id) then
    if public.chat_is_group_banned(v_id) and not public.is_admin() then
      raise exception 'banned_here';
    end if;
    if not public.chat_can_join(v_id) then raise exception 'not_allowed'; end if;
    insert into public.chat_members (group_id, user_id, role)
    values (v_id, auth.uid(), v_role)
    on conflict do nothing;
  end if;
  return v_id;
end;
$$;

-- Admins can't add a banned person back by username — unban first.
create or replace function public.chat_add_member(p_group uuid, p_username text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  select id into v_user from public.profiles
   where lower(username) = lower(trim(both '@' from btrim(p_username)));
  if v_user is null then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.chat_group_bans where group_id = p_group and user_id = v_user) then
    raise exception 'user_banned_here';
  end if;
  insert into public.chat_members (group_id, user_id) values (p_group, v_user)
  on conflict do nothing;
  return v_user;
end;
$$;

-- Sending: also blocked by a group ban (belt and braces — they're not a member).
drop policy if exists "chat members send" on public.chat_messages;
create policy "chat members send" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and deleted_at is null
    and public.chat_is_member(group_id)
    and not public.chat_is_banned()
    and not public.chat_is_group_banned(group_id)
    and not exists (select 1 from public.chat_groups g where g.id = group_id and g.locked)
  );

-- Discover never offers a group you're banned from.
create or replace function public.chat_discover()
returns table (id uuid, name text, description text, member_count int, last_message_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.description,
         (select count(*)::int from public.chat_members y where y.group_id = g.id),
         g.last_message_at
    from public.chat_groups g
   where g.kind = 'custom' and g.is_open
     and not exists (select 1 from public.chat_members m
                      where m.group_id = g.id and m.user_id = auth.uid())
     and not exists (select 1 from public.chat_group_bans b
                      where b.group_id = g.id and b.user_id = auth.uid())
   order by coalesce(g.last_message_at, g.created_at) desc;
$$;

-- Ban from one group: group admins + site admins. Group admins can't ban a
-- site admin or a fellow group admin (only a site admin can).
create or replace function public.chat_group_ban(p_group uuid, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  if p_user = auth.uid() then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then
    raise exception 'not_allowed';
  end if;
  if not public.is_admin() and exists (
       select 1 from public.chat_members
        where group_id = p_group and user_id = p_user and role = 'admin') then
    raise exception 'not_allowed';
  end if;

  insert into public.chat_group_bans (group_id, user_id, banned_by, reason)
  values (p_group, p_user, auth.uid(), left(p_reason, 300))
  on conflict (group_id, user_id) do update
    set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();
  delete from public.chat_members where group_id = p_group and user_id = p_user;
end;
$$;

create or replace function public.chat_group_unban(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  delete from public.chat_group_bans where group_id = p_group and user_id = p_user;
end;
$$;

-- The group's ban list, for its admins.
create or replace function public.chat_group_banned(p_group uuid)
returns table (user_id uuid, name text, username text, avatar_url text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  return query
    select b.user_id,
           coalesce(nullif(btrim(p.full_name), ''), p.username, 'Корисник'),
           p.username, p.avatar_url, b.created_at
      from public.chat_group_bans b
      join public.profiles p on p.id = b.user_id
     where b.group_id = p_group
     order by b.created_at desc;
end;
$$;

grant execute on function
  public.chat_group_ban(uuid, uuid, text),
  public.chat_group_unban(uuid, uuid),
  public.chat_group_banned(uuid)
  to authenticated;

notify pgrst, 'reload schema';
