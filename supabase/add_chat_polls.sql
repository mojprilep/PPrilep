-- Polls inside group chats (Муабети). 2026-10-12.
--
-- A poll is an ordinary chat message (body = "📊 <question>", so the list
-- preview, the push and older app builds all read naturally) that points at a
-- chat_polls row via chat_messages.poll_id. Any member who may write can create
-- one: 2–6 options, single choice, one vote per person, changeable.
--
-- RUN THIS BEFORE shipping the app update that reads poll_id.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.chat_polls (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  question   text not null check (char_length(btrim(question)) between 1 and 200),
  options    text[] not null check (cardinality(options) between 2 and 6),
  created_at timestamptz not null default now()
);
create index if not exists chat_polls_group_idx on public.chat_polls (group_id);

alter table public.chat_messages
  add column if not exists poll_id bigint references public.chat_polls(id) on delete set null;

-- group_id is denormalised so Realtime can filter vote changes per group.
create table if not exists public.chat_poll_votes (
  poll_id    bigint not null references public.chat_polls(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  option_idx smallint not null check (option_idx between 0 and 5),
  voted_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index if not exists chat_poll_votes_group_idx on public.chat_poll_votes (group_id);

-- ── Grants (required for new tables from 2026-10-30; RLS still applies) ─────
-- Read-only for clients; every write goes through the RPCs below.

grant select on public.chat_polls, public.chat_poll_votes to authenticated;
grant select, insert, update, delete on public.chat_polls, public.chat_poll_votes to service_role;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.chat_polls      enable row level security;
alter table public.chat_poll_votes enable row level security;

drop policy if exists "chat polls visible to members" on public.chat_polls;
create policy "chat polls visible to members" on public.chat_polls for select to authenticated
  using (public.chat_is_member(group_id) or public.is_admin());

drop policy if exists "chat poll votes visible to members" on public.chat_poll_votes;
create policy "chat poll votes visible to members" on public.chat_poll_votes for select to authenticated
  using (public.chat_is_member(group_id) or public.is_admin());

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Create a poll and its message in one go. Same gate as sending a message:
-- member, not banned, group not locked. Returns the new message row.
create or replace function public.chat_create_poll(p_group uuid, p_question text, p_options text[])
returns public.chat_messages language plpgsql security definer set search_path = public as $$
declare
  q    text := btrim(coalesce(p_question, ''));
  opts text[];
  pid  bigint;
  msg  public.chat_messages;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not public.chat_is_member(p_group) or public.chat_is_banned()
     or exists (select 1 from public.chat_groups where id = p_group and locked) then
    raise exception 'not_allowed';
  end if;

  select coalesce(array_agg(left(btrim(o), 80) order by ord), '{}')
    into opts
    from unnest(p_options) with ordinality as t(o, ord)
   where btrim(coalesce(o, '')) <> '';

  if char_length(q) = 0 or char_length(q) > 200 or cardinality(opts) < 2 or cardinality(opts) > 6 then
    raise exception 'bad_poll';
  end if;

  insert into public.chat_polls (group_id, created_by, question, options)
  values (p_group, auth.uid(), q, opts)
  returning id into pid;

  -- Fires the usual triggers: flood guard, list preview, push webhook.
  insert into public.chat_messages (group_id, user_id, body, poll_id)
  values (p_group, auth.uid(), '📊 ' || q, pid)
  returning * into msg;

  return msg;
end;
$$;

-- Vote, or change your vote. Same gate as writing: a locked (read-only) group
-- or a deleted poll message closes voting.
create or replace function public.chat_vote_poll(p_poll bigint, p_option int)
returns void language plpgsql security definer set search_path = public as $$
declare p public.chat_polls;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into p from public.chat_polls where id = p_poll;
  if not found then raise exception 'not_found'; end if;
  if not public.chat_is_member(p.group_id) or public.chat_is_banned()
     or exists (select 1 from public.chat_groups where id = p.group_id and locked) then
    raise exception 'not_allowed';
  end if;
  if p_option < 0 or p_option >= cardinality(p.options) then raise exception 'bad_poll'; end if;
  -- A deleted poll message closes the poll.
  if exists (select 1 from public.chat_messages where poll_id = p_poll and deleted_at is not null) then
    raise exception 'not_allowed';
  end if;

  insert into public.chat_poll_votes (poll_id, user_id, group_id, option_idx)
  values (p_poll, auth.uid(), p.group_id, p_option)
  on conflict (poll_id, user_id)
  do update set option_idx = excluded.option_idx, voted_at = now();
end;
$$;

revoke execute on function public.chat_create_poll(uuid, text, text[]) from public, anon;
revoke execute on function public.chat_vote_poll(bigint, int) from public, anon;
grant execute on function
  public.chat_create_poll(uuid, text, text[]), public.chat_vote_poll(bigint, int)
  to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Live result bars: members get vote inserts/updates for their open chat.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_poll_votes'
  ) then
    alter publication supabase_realtime add table public.chat_poll_votes;
  end if;
end $$;
