-- ════════════════════════════════════════════════════════════════════════════
--  Еко угостители — cafés, restaurants, bars and hotels that sort their
--  glass / cans with ПАКОМАК, promoted on /recycle/eko-ugostiteli (web + app).
--
--  Venues don't sign up or use the app: the admin enters them from ПАКОМАК's
--  data (admin page /admin/recycle: form + paste/CSV import). Venues that
--  want in are pointed to ПАКОМАК directly.
--
--  The table is admin-only (it also holds ЕДБ, ПАКОМАК ref, contact person
--  and notes). Everyone reads the public columns through the view
--  green_venues_public, active venues only.
--
--  Reuses public.is_admin() from add_admin_moderation.sql.
--  Run ONCE in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.green_venues (
  id             bigint generated always as identity primary key,
  name           text not null,
  kind           text not null default 'cafe'
                   check (kind in ('cafe','restaurant','bar','hotel','other')),
  address        text,
  lat            double precision,
  lng            double precision,
  phone          text,                    -- public business phone
  website        text,                    -- site / Instagram / Facebook
  glass          boolean not null default true,   -- sorts glass
  cans           boolean not null default false,  -- sorts metal cans
  partner_since  date,                    -- with ПАКОМАК since
  -- admin-only below
  edb            text,                    -- даночен број (ЕДБ)
  pakomak_ref    text,                    -- id/ref from ПАКОМАК's table
  contact_name   text,
  contact_phone  text,
  email          text,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists green_venues_name_idx on public.green_venues(name);

alter table public.green_venues enable row level security;

drop policy if exists "Admin manages green venues" on public.green_venues;
create policy "Admin manages green venues"
  on public.green_venues for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Explicit grants — new tables get none by default on this project's Data API.
grant select, insert, update, delete on public.green_venues to authenticated;
grant all on public.green_venues to service_role;

-- Public read: only the promotable columns of active venues. The view runs
-- with its owner's rights (deliberately not security_invoker), so it can read
-- past the admin-only RLS while exposing nothing private.
create or replace view public.green_venues_public as
  select id, name, kind, address, lat, lng, phone, website,
         glass, cans, partner_since
  from public.green_venues
  where active;

grant select on public.green_venues_public to anon, authenticated;

notify pgrst, 'reload schema';
