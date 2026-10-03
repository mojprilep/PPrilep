-- Fix: reporting a chat message failed ("Нешто тргна наопаку").
-- notifications.actor_user_id is NOT NULL, but the report trigger inserted null,
-- which aborted the whole chat_reports insert. Actor = the reported author
-- (keeps the reporter anonymous to group admins).

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
