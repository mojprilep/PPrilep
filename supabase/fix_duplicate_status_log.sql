-- ════════════════════════════════════════════════════════════════════════════
--  Duplicate "Видено" rows in the status timeline.
--
--  agency_set_issue_status() skips a no-op (same status, no note), but read the
--  issue WITHOUT a row lock — so two calls arriving at once (the web issue page
--  mounts IssueDetail twice, desktop + mobile layout, and both auto-acknowledge)
--  both saw 'open', both passed the check, and both logged + notified.
--
--  1. Same function as harden_security_prelaunch.sql, but the issue row is read
--     `for update`: a concurrent second call waits, then sees the new status
--     and returns as a no-op.
--  2. Delete existing back-to-back duplicate rows (same issue + status, no note,
--     within 5 s of each other), keeping the first.
--
--  Run ONCE in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.agency_set_issue_status(
  p_issue_id bigint,
  p_status   text,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_issue   public.issues;
  v_agency  text;
  v_uid     uuid := auth.uid();
begin
  -- Must be logged in. This single guard closes the NULL-comparison hole:
  -- with no authenticated user there is no legitimate caller.
  if v_uid is null then
    raise exception 'Not authorised to change this status';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'Issue not found';
  end if;

  if p_status not in ('open','acknowledged','progress','pending','resolved') then
    raise exception 'Invalid status %', p_status;
  end if;

  -- Authorisation: admin, the issue owner, or the agency that handles the
  -- issue's category. coalesce() guards against any NULL short-circuit.
  if not (
       public.is_admin()
    or coalesce(v_issue.reported_by = v_uid, false)
    or public.user_handles_category(v_issue.category::text)
  ) then
    raise exception 'Not authorised to change this status';
  end if;

  -- No-op: same status and no note (prevents duplicate log rows).
  if v_issue.status = p_status
     and nullif(trim(coalesce(p_note,'')), '') is null then
    return;
  end if;

  v_agency := public.current_user_agency();

  update public.issues
     set status = p_status,
         resolved_by = case when p_status = 'resolved' then resolved_by else null end,
         updated_at = now()
   where id = p_issue_id;

  insert into public.issue_status_log (issue_id, status, note, changed_by, agency_id)
  values (p_issue_id, p_status, nullif(trim(coalesce(p_note,'')), ''), v_uid, v_agency);

  -- Notify the reporter (skip if they changed it themselves).
  if v_issue.reported_by is not null and v_issue.reported_by <> v_uid then
    insert into public.notifications
      (recipient_user_id, actor_user_id, type, title, body, link)
    values (
      v_issue.reported_by,
      v_uid,
      'issue_status',
      v_issue.title,
      'Статусот на твојата пријава е променет',
      public.make_issue_path(v_issue.id, v_issue.title)
    );
  end if;
end;
$$;

revoke execute on function public.agency_set_issue_status(bigint, text, text) from public;
revoke execute on function public.agency_set_issue_status(bigint, text, text) from anon;
grant  execute on function public.agency_set_issue_status(bigint, text, text) to authenticated;

-- ── 2. Clean up existing duplicates ──────────────────────────────────────────
delete from public.issue_status_log d
 using public.issue_status_log k
 where d.issue_id = k.issue_id
   and d.status   = k.status
   and d.note is null and k.note is null
   and d.id > k.id
   -- abs(): concurrent inserts can get ids and timestamps in opposite order.
   and abs(extract(epoch from d.created_at - k.created_at)) <= 5;
