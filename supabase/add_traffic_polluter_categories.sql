-- ════════════════════════════════════════════════════════════════════════════
--  New issue categories, all routed to the municipality (Општина Прилеп):
--    'polluters'      — Загадувачи
--    'traffic_lights' — Семафори
--    'traffic_signs'  — Сообраќајни знаци
--
--  1. Allow the values in the issues.category check constraint.
--  2. Route them to the municipality in agency_categories.
--
--  Run ONCE in the Supabase SQL editor, BEFORE the web/app code that offers the
--  categories goes live — otherwise those reports fail the check constraint.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.issues drop constraint if exists issues_category_check;
alter table public.issues add constraint issues_category_check
  check (category in (
    'road','water','power','garbage','park','negligent',
    'transport','parking','vehicles',
    'polluters','traffic_lights','traffic_signs',
    'admin','other'
  ));

insert into public.agency_categories (agency_id, category)
values
  ('municipality', 'polluters'),
  ('municipality', 'traffic_lights'),
  ('municipality', 'traffic_signs')
on conflict do nothing;
