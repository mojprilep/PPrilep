-- Emoji reactions on group-chat messages (Муабети). 2026-10-13.
--
-- Messenger-style: long-press a message, pick one of six emojis. One reaction
-- per person per message; picking another replaces it, picking the same one
-- again removes it. Removal sets emoji = NULL instead of deleting the row, so
-- Realtime (filtered by group_id) sees it as an UPDATE — filtered DELETE
-- events don't reach clients.
--
-- RUN THIS BEFORE shipping the app update that shows reactions.

create table if not exists public.chat_reactions (
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  emoji      text check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists chat_reactions_group_idx on public.chat_reactions (group_id);

-- ── Grants (required for new tables from 2026-10-30; RLS still applies) ─────
-- Read-only for clients; writes go through chat_react().

grant select on public.chat_reactions to authenticated;
grant select, insert, update, delete on public.chat_reactions to service_role;

alter table public.chat_reactions enable row level security;

drop policy if exists "chat reactions visible to members" on public.chat_reactions;
create policy "chat reactions visible to members" on public.chat_reactions for select to authenticated
  using (public.chat_is_member(group_id) or public.is_admin());

-- React, change your reaction, or remove it (p_emoji NULL). Same gate as
-- writing: member, not banned, group not locked, message not deleted.
create or replace function public.chat_react(p_message bigint, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.chat_messages;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from public.chat_messages where id = p_message;
  if not found or m.deleted_at is not null then raise exception 'not_found'; end if;
  if not public.chat_is_member(m.group_id) or public.chat_is_banned()
     or exists (select 1 from public.chat_groups where id = m.group_id and locked) then
    raise exception 'not_allowed';
  end if;
  if p_emoji is not null and p_emoji not in ('👍', '❤️', '😂', '😮', '😢', '🙏') then
    raise exception 'bad_reaction';
  end if;

  insert into public.chat_reactions (message_id, user_id, group_id, emoji)
  values (p_message, auth.uid(), m.group_id, p_emoji)
  on conflict (message_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now();
end;
$$;

revoke execute on function public.chat_react(bigint, text) from public, anon;
grant execute on function public.chat_react(bigint, text) to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reactions'
  ) then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;
