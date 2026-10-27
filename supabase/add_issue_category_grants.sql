-- ════════════════════════════════════════════════════════════════════════════
--  Per-person issue-category grants (after add_agencies.sql +
--  add_citizen_resolved_action.sql).
--
--  An agency account handles ALL of its institution's categories. A grant
--  lets one person handle a single category without becoming an agency
--  operator or a site admin — e.g. a traffic-light technician who manages
--  only "Семафори" (traffic_lights) issues while Општина keeps the rest.
--
--  A grant gives exactly what an agency operator gets for that category:
--    • user_handles_category() is true → status changes via the agency RPCs;
--    • a notification for every new issue in that category.
--
--  New table → explicit GRANTs below. Run ONCE in the Supabase SQL editor.
--  Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.issue_category_grants (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.issue_category_grants enable row level security;

-- People only see their own grants (the web issue page checks them).
-- Grants are managed by admins in the SQL editor; no client writes.
drop policy if exists "Own category grants" on public.issue_category_grants;
create policy "Own category grants" on public.issue_category_grants
  for select to authenticated using (user_id = auth.uid());

grant select on public.issue_category_grants to authenticated;
grant all on public.issue_category_grants to service_role;

-- ── Permission check: super-admin, the owning agency, or a personal grant ──
create or replace function public.user_handles_category(p_category text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (
        select 1 from public.agency_categories ac
        where ac.category = p_category
          and ac.agency_id = public.current_user_agency()
      )
      or exists (
        select 1 from public.issue_category_grants g
        where g.category = p_category
          and g.user_id = auth.uid()
      );
$$;
grant execute on function public.user_handles_category(text) to authenticated;

-- ── New-issue notification: agency operators + personal grant holders ──────
create or replace function public.notify_agency_on_new_issue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency   text;
  v_resolved boolean := new.status = 'resolved' and new.resolved_by is not null;
begin
  if new.reported_by is null then
    return new;
  end if;

  v_agency := public.agency_for_category(new.category::text);

  insert into public.notifications
    (recipient_user_id, actor_user_id, type, title, body, link)
  select p.id,
         new.reported_by,
         case when v_resolved then 'issue_resolved_by_citizen'
              else 'issue_for_agency' end,
         new.title,
         case when v_resolved then 'Граѓанин веќе реши проблем во ваша надлежност 👏'
              else 'Нова пријава во ваша надлежност' end,
         public.make_issue_path(new.id, new.title)
  from public.profiles p
  where p.id <> new.reported_by
    and ((v_agency is not null and p.agency_id = v_agency)
         or exists (select 1 from public.issue_category_grants g
                     where g.user_id = p.id
                       and g.category = new.category::text));

  return new;
end;
$$;

notify pgrst, 'reload schema';

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Семафори → filipgeorgieski@yahoo.com (2026-10-27).
insert into public.issue_category_grants (user_id, category)
select u.id, 'traffic_lights'
  from auth.users u
 where lower(u.email) = 'filipgeorgieski@yahoo.com'
on conflict do nothing;

-- Check: one row, traffic_lights.
select u.email, g.category, g.created_at
  from public.issue_category_grants g
  join auth.users u on u.id = g.user_id;
