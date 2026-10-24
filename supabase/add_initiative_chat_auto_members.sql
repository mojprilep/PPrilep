-- ════════════════════════════════════════════════════════════════════════════
--  Initiative chats: supporters are members automatically
--  (after add_chat.sql + add_chat_group_bans.sql).
--
--  Before: an initiative's "Муабет" was created on first open and each
--  supporter had to tap in to join. Now:
--    • every initiative has its chat; the author is its admin;
--    • supporting an initiative (initiative_votes INSERT) adds you as a member;
--    • withdrawing support removes you (group admins stay);
--    • renaming the initiative renames its chat;
--    • people banned from that group are never re-added.
--  Existing initiatives and supporters are backfilled at the bottom.
--
--  No new tables, so no new GRANTs. Run ONCE in the Supabase SQL editor.
--  Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- Create (if missing) the chat of an initiative and make its author admin.
-- Internal: called from triggers and the backfill, not exposed to clients.
create or replace function public.chat_ensure_initiative_group(p_initiative uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_title  text;
  v_author uuid;
begin
  select title, user_id into v_title, v_author
    from public.initiatives where id = p_initiative;
  if v_title is null then return null; end if;

  select id into v_id from public.chat_groups
   where kind = 'initiative' and ref = p_initiative::text;
  if v_id is null then
    insert into public.chat_groups (kind, ref, name, created_by)
    values ('initiative', p_initiative::text, left(v_title, 80), v_author)
    on conflict (kind, ref) where ref is not null do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.chat_groups
       where kind = 'initiative' and ref = p_initiative::text;
    end if;
  end if;

  insert into public.chat_members (group_id, user_id, role)
  values (v_id, v_author, 'admin')
  on conflict (group_id, user_id) do update set role = 'admin';
  return v_id;
end;
$$;
revoke execute on function public.chat_ensure_initiative_group(uuid) from public, anon, authenticated;

-- New initiative → its chat, with the author as admin.
create or replace function public.initiatives_chat_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.chat_ensure_initiative_group(new.id);
  return null;
end;
$$;

drop trigger if exists trg_initiatives_chat_insert on public.initiatives;
create trigger trg_initiatives_chat_insert
  after insert on public.initiatives
  for each row execute function public.initiatives_chat_after_insert();

-- Renamed initiative → renamed chat.
create or replace function public.initiatives_chat_after_title()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_groups set name = left(new.title, 80)
   where kind = 'initiative' and ref = new.id::text;
  return null;
end;
$$;

drop trigger if exists trg_initiatives_chat_title on public.initiatives;
create trigger trg_initiatives_chat_title
  after update of title on public.initiatives
  for each row when (old.title is distinct from new.title)
  execute function public.initiatives_chat_after_title();

-- Support → join; withdraw support → leave (unless they moderate the group).
create or replace function public.initiative_votes_chat_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  if tg_op = 'INSERT' then
    v_group := public.chat_ensure_initiative_group(new.initiative_id);
    if v_group is not null and not exists (
         select 1 from public.chat_group_bans
          where group_id = v_group and user_id = new.user_id) then
      insert into public.chat_members (group_id, user_id)
      values (v_group, new.user_id)
      on conflict do nothing;
    end if;
  else
    delete from public.chat_members m
     using public.chat_groups g
     where g.id = m.group_id
       and g.kind = 'initiative' and g.ref = old.initiative_id::text
       and m.user_id = old.user_id
       and m.role = 'member';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_initiative_votes_chat on public.initiative_votes;
create trigger trg_initiative_votes_chat
  after insert or delete on public.initiative_votes
  for each row execute function public.initiative_votes_chat_sync();

-- ── Backfill: every initiative gets its chat, every supporter joins ─────────

select public.chat_ensure_initiative_group(id) from public.initiatives;

insert into public.chat_members (group_id, user_id)
select g.id, v.user_id
  from public.initiative_votes v
  join public.chat_groups g on g.kind = 'initiative' and g.ref = v.initiative_id::text
 where not exists (select 1 from public.chat_group_bans b
                    where b.group_id = g.id and b.user_id = v.user_id)
on conflict do nothing;

-- Check: groups and members per initiative.
select g.name, count(m.user_id) as members
  from public.chat_groups g
  left join public.chat_members m on m.group_id = g.id
 where g.kind = 'initiative'
 group by g.id, g.name
 order by members desc;
