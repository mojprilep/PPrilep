-- ════════════════════════════════════════════════════════════════════════════
--  App version tracking + update prompt policy (mobile app).
--
--  app_version_policy  one row per platform:
--      latest_version  installs below it see a dismissible "new version" prompt
--      min_version     installs below it are BLOCKED until they update
--                      (keep at the oldest live version = nobody blocked)
--  app_installs        one row per install, refreshed on every app start, so we
--                      can see who is still on which version.
--  app_checkin()       the single call the app makes: records the install and
--                      returns that platform's policy.
--
--  Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.app_version_policy (
  platform       text primary key check (platform in ('ios', 'android')),
  latest_version text not null,
  min_version    text not null,
  updated_at     timestamptz not null default now()
);

alter table public.app_version_policy enable row level security;

drop policy if exists "app_version_policy readable" on public.app_version_policy;
create policy "app_version_policy readable" on public.app_version_policy
  for select using (true);

grant select on public.app_version_policy to anon, authenticated;

-- latest = what each store serves today. Raise it once a new build is LIVE in
-- that store, never before (the prompt would send people to the old version).
insert into public.app_version_policy (platform, latest_version, min_version) values
  ('ios',     '1.0.9', '1.0.8'),
  ('android', '1.0.9', '1.0.8')
on conflict (platform) do nothing;


create table if not exists public.app_installs (
  install_id    uuid primary key,
  platform      text not null check (platform in ('ios', 'android')),
  app_version   text not null,
  update_id     text,
  user_id       uuid references auth.users (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists app_installs_last_seen_idx on public.app_installs (last_seen_at);

-- No policies: only app_checkin() (security definer) and the service role touch it.
alter table public.app_installs enable row level security;
revoke all on public.app_installs from anon, authenticated;


create or replace function public.app_checkin(
  p_install_id uuid,
  p_platform   text,
  p_version    text,
  p_update_id  text default null
)
returns table (latest_version text, min_version text)
language plpgsql security definer set search_path = public as $$
begin
  if p_platform in ('ios', 'android') and p_version ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$' then
    insert into public.app_installs (install_id, platform, app_version, update_id, user_id)
    values (p_install_id, p_platform, p_version, left(p_update_id, 64), auth.uid())
    on conflict (install_id) do update set
      platform     = excluded.platform,
      app_version  = excluded.app_version,
      update_id    = excluded.update_id,
      -- Keep the last known user when the app starts signed out.
      user_id      = coalesce(excluded.user_id, app_installs.user_id),
      last_seen_at = now();
  end if;

  return query
    select p.latest_version, p.min_version
    from public.app_version_policy p
    where p.platform = p_platform;
end;
$$;

revoke all on function public.app_checkin(uuid, text, text, text) from public;
grant execute on function public.app_checkin(uuid, text, text, text) to anon, authenticated;


-- ── Handy queries ───────────────────────────────────────────────────────────
-- Who is on what (active in the last 30 days):
--   select platform, app_version, count(*)
--   from app_installs where last_seen_at > now() - interval '30 days'
--   group by 1, 2 order by 1, 2;
--
-- New build live in the stores → prompt everyone older:
--   update app_version_policy set latest_version = '1.0.10', updated_at = now() where platform = 'ios';
--
-- Block an old version (only once the newer one is live in that store):
--   update app_version_policy set min_version = '1.0.9', updated_at = now();
