-- ════════════════════════════════════════════════════════════════════════════
--  Group chats, part 2 (after add_chat.sql):
--
--  1. mojpprilep@gmail.com becomes a site admin (sees + moderates every group
--     without being listed as a member).
--  2. Reporting a message notifies the site admins (→ reports queue) and that
--     group's own admins (→ the chat), once per message, via the existing
--     notifications table + push_notify webhook.
--  3. Any signed-in user can REQUEST a custom group. Site admins get a
--     notification, approve or reject it; on approval the group is created with
--     the requester as its admin, and the requester is notified either way.
--  4. chat_all_groups(): site admins' overview of every group.
--
--  Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Second admin ─────────────────────────────────────────────────────────

update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id and lower(u.email) = 'mojpprilep@gmail.com';

-- ── Notification types (same list as add_sport_submission_notification.sql + chat) ──

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'issue_comment','issue_affected','issue_helper','issue_help_comment',
    'issue_help_vote','idea_upvote','comment_like','comment_reply',
    'issue_in_district','issue_status','issue_for_agency','agency_post',
    'agency_alert','issue_resolved_by_citizen','event_submission',
    'sport_submission',
    'chat_report','chat_group_request','chat_group_decision'
  ));

-- ── 2. Report → notify ──────────────────────────────────────────────────────

create or replace function public.chat_reports_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m       public.chat_messages;
  v_group text;
  v_who   text;
  v_text  text;
begin
  -- Only the first report of a message alerts anyone; later ones just add up
  -- in the queue.
  if exists (select 1 from public.chat_reports r
              where r.message_id = new.message_id and r.id <> new.id) then
    return new;
  end if;

  select * into m from public.chat_messages where id = new.message_id;
  if not found then return new; end if;
  select name into v_group from public.chat_groups where id = m.group_id;
  select coalesce(nullif(btrim(full_name), ''), username, 'Корисник') into v_who
    from public.profiles where id = m.user_id;
  v_text := coalesce(left(nullif(btrim(m.body), ''), 120), '📷 Фотографија');

  -- Site admins → the reports queue (ban / delete / dismiss).
  insert into public.notifications (recipient_user_id, actor_user_id, type, title, body, link)
  select p.id, m.user_id, 'chat_report',
         '⚑ Пријавена порака · ' || v_group,
         v_who || ': ' || v_text || coalesce(' (' || new.reason || ')', ''),
         '/chat/reports'
    from public.profiles p
   where p.is_admin and p.id <> new.reporter_id;

  -- The group's own admins (initiative author, club owner, requester…) → the
  -- chat itself, where they can delete the message or remove the member.
  insert into public.notifications (recipient_user_id, actor_user_id, type, title, body, link)
  select cm.user_id, m.user_id, 'chat_report',
         '⚑ Пријавена порака · ' || v_group,
         v_who || ': ' || v_text || coalesce(' (' || new.reason || ')', ''),
         '/chat/' || m.group_id
    from public.chat_members cm
    join public.profiles p on p.id = cm.user_id
   where cm.group_id = m.group_id and cm.role = 'admin'
     and not p.is_admin                -- already notified above
     and cm.user_id <> new.reporter_id
     and cm.user_id <> m.user_id;      -- not the reported author themself

  return new;
end;
$$;

drop trigger if exists chat_reports_after_insert on public.chat_reports;
create trigger chat_reports_after_insert after insert on public.chat_reports
  for each row execute function public.chat_reports_after_insert();

-- ── 3. Group requests ───────────────────────────────────────────────────────

create table if not exists public.chat_group_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 300),
  is_open     boolean not null default true,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  group_id    uuid references public.chat_groups(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists chat_group_requests_pending_idx
  on public.chat_group_requests (created_at) where status = 'pending';
create index if not exists chat_group_requests_user_idx
  on public.chat_group_requests (user_id, created_at desc);

grant select on public.chat_group_requests to authenticated;
grant select, insert, update, delete on public.chat_group_requests to service_role;

alter table public.chat_group_requests enable row level security;
drop policy if exists "chat group requests read" on public.chat_group_requests;
create policy "chat group requests read" on public.chat_group_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies: writes go through the functions below.

-- A signed-in, non-banned user asks for a group. At most 2 waiting at once.
create or replace function public.chat_request_group(p_name text, p_description text, p_is_open boolean)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id   bigint;
  v_name text := btrim(coalesce(p_name, ''));
  v_who  text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.chat_is_banned() then raise exception 'not_allowed'; end if;
  if char_length(v_name) < 2 then raise exception 'name_too_short'; end if;
  if (select count(*) from public.chat_group_requests
       where user_id = auth.uid() and status = 'pending') >= 2 then
    raise exception 'too_many_requests';
  end if;

  insert into public.chat_group_requests (user_id, name, description, is_open)
  values (auth.uid(), left(v_name, 80),
          nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_is_open, true))
  returning id into v_id;

  select coalesce(nullif(btrim(full_name), ''), username, 'Корисник') into v_who
    from public.profiles where id = auth.uid();

  insert into public.notifications (recipient_user_id, actor_user_id, type, title, body, link)
  select p.id, auth.uid(), 'chat_group_request',
         '💬 Барање за нова група',
         v_who || ' бара група „' || left(v_name, 80) || '“',
         '/chat/requests'
    from public.profiles p
   where p.is_admin and p.id <> auth.uid();

  return v_id;
end;
$$;

-- Site admins: approve (creates the group, requester = its admin) or reject.
create or replace function public.chat_review_group_request(p_id bigint, p_approve boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r    public.chat_group_requests;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  select * into r from public.chat_group_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then return r.group_id; end if;

  if p_approve then
    insert into public.chat_groups (kind, name, description, is_open, created_by)
    values ('custom', r.name, r.description, r.is_open, r.user_id)
    returning id into v_id;
    insert into public.chat_members (group_id, user_id, role) values (v_id, r.user_id, 'admin');

    update public.chat_group_requests
       set status = 'approved', group_id = v_id, reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;

    insert into public.notifications (recipient_user_id, actor_user_id, type, title, body, link)
    values (r.user_id, auth.uid(), 'chat_group_decision',
            '✅ Групата е одобрена',
            '„' || r.name || '“ е отворена. Ти си нејзин администратор — додај членови.',
            '/chat/' || v_id);
  else
    update public.chat_group_requests
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;

    insert into public.notifications (recipient_user_id, actor_user_id, type, title, body, link)
    values (r.user_id, auth.uid(), 'chat_group_decision',
            'Барањето за група не е одобрено',
            '„' || r.name || '“ не беше одобрена.',
            '/chats');
  end if;

  return v_id;
end;
$$;

-- Site admins: the waiting requests with who asked.
create or replace function public.chat_pending_group_requests()
returns table (
  id bigint, user_id uuid, requester_name text, requester_username text,
  name text, description text, is_open boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select r.id, r.user_id,
           coalesce(nullif(btrim(p.full_name), ''), p.username, 'Корисник'),
           p.username, r.name, r.description, r.is_open, r.created_at
      from public.chat_group_requests r
      join public.profiles p on p.id = r.user_id
     where r.status = 'pending'
     order by r.created_at;
end;
$$;

-- ── 4. Admin overview of every group ───────────────────────────────────────

create or replace function public.chat_all_groups()
returns table (
  id uuid, kind text, name text, is_open boolean, locked boolean,
  member_count int, last_message_at timestamptz, last_message_preview text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select g.id, g.kind, g.name, g.is_open, g.locked,
           (select count(*)::int from public.chat_members y where y.group_id = g.id),
           g.last_message_at, g.last_message_preview
      from public.chat_groups g
     order by coalesce(g.last_message_at, g.created_at) desc;
end;
$$;

grant execute on function
  public.chat_request_group(text, text, boolean),
  public.chat_review_group_request(bigint, boolean),
  public.chat_pending_group_requests(),
  public.chat_all_groups()
  to authenticated;

notify pgrst, 'reload schema';
