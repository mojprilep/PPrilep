-- ════════════════════════════════════════════════════════════════════════════
--  Security Advisor: "Security Definer View" on hunts_public,
--  hunt_clues_public and green_venues_public.
--
--  Those views ran with their owner's rights on purpose: the tables behind
--  them are admin-only, and the views expose only the safe columns/rows.
--  Same result, advisor-clean: the owner-rights part moves into a
--  SECURITY DEFINER function, and each view becomes a plain security_invoker
--  view over it. Column names/types are unchanged, so web and app queries
--  (filters, order, select lists) keep working as-is.
--
--  Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Treasure hunt ───────────────────────────────────────────────────────────
-- The spot and the winner's name appear only once the hunt is found.
create or replace function public.hunts_public_rows()
returns table (
  id bigint, title text, cover_url text, rules text, prize text,
  starts_at timestamptz, status text, found_at timestamptz,
  winner_name text, spot_lat double precision, spot_lng double precision
)
language sql stable security definer set search_path = public as $$
  select h.id, h.title, h.cover_url, h.rules, h.prize, h.starts_at, h.status,
         h.found_at,
         case when h.status = 'found' then coalesce(nullif(p.full_name, ''), p.username) end,
         case when h.status = 'found' then s.lat end,
         case when h.status = 'found' then s.lng end
  from public.hunts h
  left join public.hunt_secrets s on s.hunt_id = h.id
  left join public.hunt_winners w on w.hunt_id = h.id
  left join public.profiles p on p.id = w.user_id
  where h.status <> 'draft';
$$;

create or replace function public.hunt_clues_public_rows()
returns table (
  id bigint, hunt_id bigint, body text, photo_url text,
  lat double precision, lng double precision, published_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.hunt_id, c.body, c.photo_url, c.lat, c.lng, c.published_at
  from public.hunt_clues c
  join public.hunts h on h.id = c.hunt_id
  where h.status <> 'draft'
    and c.published_at is not null
    and c.published_at <= now();
$$;

create or replace view public.hunts_public with (security_invoker = on) as
  select * from public.hunts_public_rows();

create or replace view public.hunt_clues_public with (security_invoker = on) as
  select * from public.hunt_clues_public_rows();

-- ── Еко угостители ─────────────────────────────────────────────────────────
-- Only the promotable columns of active venues.
create or replace function public.green_venues_public_rows()
returns table (
  id bigint, name text, kind text, address text,
  lat double precision, lng double precision, phone text, website text,
  glass boolean, cans boolean, partner_since date
)
language sql stable security definer set search_path = public as $$
  select id, name, kind, address, lat, lng, phone, website,
         glass, cans, partner_since
  from public.green_venues
  where active;
$$;

create or replace view public.green_venues_public with (security_invoker = on) as
  select * from public.green_venues_public_rows();

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke execute on function
  public.hunts_public_rows(), public.hunt_clues_public_rows(),
  public.green_venues_public_rows()
  from public;
grant execute on function
  public.hunts_public_rows(), public.hunt_clues_public_rows(),
  public.green_venues_public_rows()
  to anon, authenticated, service_role;
grant select on public.hunts_public, public.hunt_clues_public,
  public.green_venues_public to anon, authenticated;

notify pgrst, 'reload schema';

-- Check: all three should say security_invoker=on, and anon should still read.
select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('hunts_public', 'hunt_clues_public', 'green_venues_public');

-- spatial_ref_sys (the 4th advisor item) stays flagged: it belongs to the
-- PostGIS extension, so RLS can't be enabled on it. fix_spatial_ref_sys_rls.sql
-- already took it off the API; this should return false / false:
select has_table_privilege('anon', 'public.spatial_ref_sys', 'select') as anon_reads,
       has_table_privilege('authenticated', 'public.spatial_ref_sys', 'select') as auth_reads;
