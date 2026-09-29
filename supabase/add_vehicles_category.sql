-- ════════════════════════════════════════════════════════════════════════════
--  New issue category: 'vehicles' — Хаварисани возила (wrecked/abandoned cars)
--
--  1. Allow the value in the issues.category check constraint.
--  2. Route it to the municipality (Општина Прилеп), like 'negligent'.
--
--  Run ONCE in the Supabase SQL editor, BEFORE the web/app code that offers the
--  category goes live — otherwise those reports fail the check constraint.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.issues drop constraint if exists issues_category_check;
alter table public.issues add constraint issues_category_check
  check (category in (
    'road','water','power','garbage','park','negligent',
    'transport','parking','vehicles','admin','other'
  ));

insert into public.agency_categories (agency_id, category)
values ('municipality', 'vehicles')
on conflict do nothing;
