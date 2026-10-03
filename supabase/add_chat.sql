-- ════════════════════════════════════════════════════════════════════════════
--  Group chats (mobile app first).
--
--  Three kinds of group:
--    custom      — created by a site admin. `is_open` groups are listed for
--                  everyone to join; closed ones are invite-only (an admin adds
--                  members by username).
--    initiative  — one per initiative (ref = initiatives.id). The author and
--                  anyone who supported it (initiative_votes) may join; the
--                  author moderates.
--    club        — one per sport club (ref = Sanity sportClub slug). Followers
--                  (club_followers) and the club owner (profiles.club_id) may
--                  join; the owner moderates.
--  Site admins (profiles.is_admin) can read and moderate every group.
--
--  All writes except sending a message, reporting and blocking go through the
--  SECURITY DEFINER functions below, so nobody can promote themselves to group
--  admin or join a group they aren't eligible for by writing rows directly.
--
--  Push: a Supabase Database Webhook on INSERT into public.chat_messages →
--  https://www.mojprilep.mk/api/chat/notify with header
--  x-webhook-secret: <CRON_SECRET> (same as the notifications webhook).
--
--  Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.chat_groups (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('custom','initiative','club')),
  ref                  text,
  name                 text not null check (char_length(name) between 2 and 80),
  description          text check (description is null or char_length(description) <= 300),
  is_open              boolean not null default false,
  locked               boolean not null default false,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz,
  last_message_preview text,
  constraint chat_groups_ref_check check ((kind = 'custom') = (ref is null))
);
create unique index if not exists chat_groups_kind_ref_key
  on public.chat_groups (kind, ref) where ref is not null;

create table if not exists public.chat_members (
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('admin','member')),
  muted        boolean not null default false,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text check (body is null or char_length(body) <= 2000),
  image_url  text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  -- A live message needs text or a photo; a deleted one keeps neither.
  constraint chat_messages_content_check
    check (deleted_at is not null
           or nullif(btrim(coalesce(body, '')), '') is not null
           or image_url is not null)
);
create index if not exists chat_messages_group_created_idx
  on public.chat_messages (group_id, created_at desc);
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

create table if not exists public.chat_reports (
  id          bigint generated always as identity primary key,
  message_id  bigint not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique (message_id, reporter_id)
);

create table if not exists public.chat_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.chat_bans (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  banned_by  uuid references public.profiles(id) on delete set null,
  reason     text,
  created_at timestamptz not null default now()
);

-- ── Grants (required for new tables from 2026-10-30; RLS still applies) ─────

grant select, insert, update, delete on
  public.chat_groups, public.chat_members, public.chat_messages,
  public.chat_reports, public.chat_blocks, public.chat_bans
  to authenticated, service_role;

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.chat_is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_members
     where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function public.chat_is_group_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.chat_members
     where group_id = p_group and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.chat_is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_bans where user_id = auth.uid());
$$;

-- May the caller join this group? Initiative/club chats follow support/follow.
create or replace function public.chat_can_join(p_group uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare g public.chat_groups;
begin
  select * into g from public.chat_groups where id = p_group;
  if not found then return false; end if;
  if public.is_admin() then return true; end if;
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

grant execute on function
  public.chat_is_member(uuid), public.chat_is_group_admin(uuid),
  public.chat_is_banned(), public.chat_can_join(uuid)
  to authenticated;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.chat_groups   enable row level security;
alter table public.chat_members  enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports  enable row level security;
alter table public.chat_blocks   enable row level security;
alter table public.chat_bans     enable row level security;

-- Closed custom groups stay hidden from non-members; the rest are discoverable.
drop policy if exists "chat groups visible" on public.chat_groups;
create policy "chat groups visible" on public.chat_groups for select to authenticated
  using (is_open or kind <> 'custom' or public.chat_is_member(id) or public.is_admin());

drop policy if exists "chat members visible to members" on public.chat_members;
create policy "chat members visible to members" on public.chat_members for select to authenticated
  using (public.chat_is_member(group_id) or public.is_admin());

drop policy if exists "chat messages visible to members" on public.chat_messages;
create policy "chat messages visible to members" on public.chat_messages for select to authenticated
  using (public.chat_is_member(group_id) or public.is_admin());

drop policy if exists "chat members send" on public.chat_messages;
create policy "chat members send" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and deleted_at is null
    and public.chat_is_member(group_id)
    and not public.chat_is_banned()
    and not exists (select 1 from public.chat_groups g where g.id = group_id and g.locked)
  );

drop policy if exists "chat report own" on public.chat_reports;
create policy "chat report own" on public.chat_reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "chat reports admin read" on public.chat_reports;
create policy "chat reports admin read" on public.chat_reports for select to authenticated
  using (public.is_admin() or reporter_id = auth.uid());

drop policy if exists "chat blocks own read" on public.chat_blocks;
create policy "chat blocks own read" on public.chat_blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists "chat blocks own insert" on public.chat_blocks;
create policy "chat blocks own insert" on public.chat_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists "chat blocks own delete" on public.chat_blocks;
create policy "chat blocks own delete" on public.chat_blocks for delete to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "chat bans admin or self" on public.chat_bans;
create policy "chat bans admin or self" on public.chat_bans for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- ── Triggers ────────────────────────────────────────────────────────────────

-- Flood guard: at most 8 messages per 10 seconds per user.
create or replace function public.chat_messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.chat_messages
       where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 8 then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;
  new.body := nullif(btrim(new.body), '');
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert before insert on public.chat_messages
  for each row execute function public.chat_messages_before_insert();

-- Keep the group's list preview fresh; the sender has read their own message.
create or replace function public.chat_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_groups
     set last_message_at = new.created_at,
         last_message_preview = left(coalesce(new.body, '📷 Фотографија'), 140)
   where id = new.group_id;
  update public.chat_members
     set last_read_at = new.created_at
   where group_id = new.group_id and user_id = new.user_id;
  return new;
end;
$$;
drop trigger if exists chat_messages_after_insert on public.chat_messages;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function public.chat_messages_after_insert();

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Open (create on first use) the chat of an initiative or club and join it.
-- p_name is only used when the group doesn't exist yet (clubs live in Sanity,
-- so the app passes the club's name).
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
    if not public.chat_can_join(v_id) then raise exception 'not_allowed'; end if;
    insert into public.chat_members (group_id, user_id, role)
    values (v_id, auth.uid(), v_role)
    on conflict do nothing;
  end if;
  return v_id;
end;
$$;

-- Join an open custom group (or any group the caller is eligible for).
create or replace function public.chat_join(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.chat_is_member(p_group) then return; end if;
  if not public.chat_can_join(p_group) then raise exception 'not_allowed'; end if;
  insert into public.chat_members (group_id, user_id) values (p_group, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.chat_leave(p_group uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.chat_members where group_id = p_group and user_id = auth.uid();
$$;

-- Site admins create custom groups.
create or replace function public.chat_create_group(p_name text, p_description text, p_is_open boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  insert into public.chat_groups (kind, name, description, is_open, created_by)
  values ('custom', btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_is_open, false), auth.uid())
  returning id into v_id;
  insert into public.chat_members (group_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;

create or replace function public.chat_update_group(p_group uuid, p_name text, p_description text, p_is_open boolean, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  update public.chat_groups
     set name = coalesce(nullif(btrim(p_name), ''), name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         -- Only custom groups can be opened to everyone.
         is_open = case when kind = 'custom' then coalesce(p_is_open, is_open) else false end,
         locked = coalesce(p_locked, locked)
   where id = p_group;
end;
$$;

-- Group admins add someone by username (invite-only custom groups mostly).
create or replace function public.chat_add_member(p_group uuid, p_username text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  select id into v_user from public.profiles
   where lower(username) = lower(trim(both '@' from btrim(p_username)));
  if v_user is null then raise exception 'user_not_found'; end if;
  insert into public.chat_members (group_id, user_id) values (p_group, v_user)
  on conflict do nothing;
  return v_user;
end;
$$;

create or replace function public.chat_remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  delete from public.chat_members where group_id = p_group and user_id = p_user;
end;
$$;

create or replace function public.chat_set_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_group_admin(p_group) then raise exception 'not_allowed'; end if;
  if p_role not in ('admin','member') then raise exception 'bad_role'; end if;
  update public.chat_members set role = p_role where group_id = p_group and user_id = p_user;
end;
$$;

create or replace function public.chat_mark_read(p_group uuid)
returns void language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now()
   where group_id = p_group and user_id = auth.uid();
$$;

create or replace function public.chat_set_muted(p_group uuid, p_muted boolean)
returns void language sql security definer set search_path = public as $$
  update public.chat_members set muted = coalesce(p_muted, false)
   where group_id = p_group and user_id = auth.uid();
$$;

-- Soft delete: the sender, a group admin or a site admin.
create or replace function public.chat_delete_message(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_id;
  if not found or m.deleted_at is not null then return; end if;
  if m.user_id <> auth.uid() and not public.chat_is_group_admin(m.group_id) then
    raise exception 'not_allowed';
  end if;
  update public.chat_messages
     set deleted_at = now(), deleted_by = auth.uid(), body = null, image_url = null
   where id = p_id;
  update public.chat_reports set resolved_at = now(), resolved_by = auth.uid()
   where message_id = p_id and resolved_at is null;
  -- Don't leave the deleted text showing as the group's list preview.
  update public.chat_groups g
     set last_message_preview = 'Пораката е избришана'
   where g.id = m.group_id
     and not exists (select 1 from public.chat_messages x
                      where x.group_id = m.group_id and x.id > p_id);
end;
$$;

-- The caller's groups with unread counts, newest activity first.
create or replace function public.chat_my_groups()
returns table (
  id uuid, kind text, ref text, name text, description text, is_open boolean,
  locked boolean, role text, muted boolean, last_message_at timestamptz,
  last_message_preview text, unread int, member_count int
)
language sql stable security definer set search_path = public as $$
  select g.id, g.kind, g.ref, g.name, g.description, g.is_open, g.locked,
         m.role, m.muted, g.last_message_at, g.last_message_preview,
         (select count(*)::int from public.chat_messages x
           where x.group_id = g.id and x.created_at > m.last_read_at
             and x.user_id <> auth.uid() and x.deleted_at is null
             and not exists (select 1 from public.chat_blocks b
                              where b.blocker_id = auth.uid() and b.blocked_id = x.user_id)),
         (select count(*)::int from public.chat_members y where y.group_id = g.id)
    from public.chat_members m
    join public.chat_groups g on g.id = m.group_id
   where m.user_id = auth.uid()
   order by coalesce(g.last_message_at, g.created_at) desc;
$$;

-- Open custom groups the caller hasn't joined yet.
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
   order by coalesce(g.last_message_at, g.created_at) desc;
$$;

-- ── Moderation (site admins) ───────────────────────────────────────────────

create or replace function public.chat_ban_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  insert into public.chat_bans (user_id, banned_by, reason)
  values (p_user, auth.uid(), p_reason)
  on conflict (user_id) do update set banned_by = excluded.banned_by, reason = excluded.reason;
end;
$$;

create or replace function public.chat_unban_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  delete from public.chat_bans where user_id = p_user;
end;
$$;

create or replace function public.chat_dismiss_report(p_report bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.chat_reports set resolved_at = now(), resolved_by = auth.uid()
   where id = p_report;
end;
$$;

-- Open reports with the message and both people, for the admin screen.
create or replace function public.chat_open_reports()
returns table (
  report_id bigint, reason text, reported_at timestamptz,
  message_id bigint, body text, image_url text, message_at timestamptz,
  group_id uuid, group_name text,
  author_id uuid, author_name text, author_banned boolean,
  reporter_name text, report_count int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select r.id, r.reason, r.created_at,
         m.id, m.body, m.image_url, m.created_at,
         g.id, g.name,
         m.user_id, coalesce(a.full_name, a.username, 'Корисник'),
         exists (select 1 from public.chat_bans b where b.user_id = m.user_id),
         coalesce(rp.full_name, rp.username, 'Корисник'),
         (select count(*)::int from public.chat_reports z
           where z.message_id = m.id and z.resolved_at is null)
    from public.chat_reports r
    join public.chat_messages m on m.id = r.message_id
    join public.chat_groups g on g.id = m.group_id
    left join public.profiles a on a.id = m.user_id
    left join public.profiles rp on rp.id = r.reporter_id
   where r.resolved_at is null and m.deleted_at is null
   order by r.created_at desc;
end;
$$;

grant execute on function
  public.chat_open_group(text, text, text), public.chat_join(uuid), public.chat_leave(uuid),
  public.chat_create_group(text, text, boolean),
  public.chat_update_group(uuid, text, text, boolean, boolean),
  public.chat_add_member(uuid, text), public.chat_remove_member(uuid, uuid),
  public.chat_set_role(uuid, uuid, text), public.chat_mark_read(uuid),
  public.chat_set_muted(uuid, boolean), public.chat_delete_message(bigint),
  public.chat_my_groups(), public.chat_discover(),
  public.chat_ban_user(uuid, text), public.chat_unban_user(uuid),
  public.chat_dismiss_report(bigint), public.chat_open_reports()
  to authenticated;

-- ── Storage: chat photos ────────────────────────────────────────────────────
-- Public-read like issue/initiative photos (URLs are unguessable); only signed-in
-- users upload, into their own folder.

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read chat images" on storage.objects;
create policy "Public read chat images" on storage.objects
  for select using (bucket_id = 'chat-images');

drop policy if exists "Auth upload chat images" on storage.objects;
create policy "Auth upload chat images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Realtime ────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';
