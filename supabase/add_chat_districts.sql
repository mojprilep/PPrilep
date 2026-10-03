-- ════════════════════════════════════════════════════════════════════════════
-- Муабети — "Месна заедница": one open chat per маало.
--
-- Plain open custom groups (no new kind), so the app already live in the stores
-- lists them under "Отворени групи" with "Приклучи се" — no OTA needed.
-- Created by the first site admin; site admins moderate every group anyway.
-- Idempotent: re-running skips groups that already exist (matched by name).
-- ════════════════════════════════════════════════════════════════════════════

insert into public.chat_groups (kind, ref, name, description, is_open, created_by)
select 'custom', null, 'Месна заедница — ' || d.label,
       'Муабет за проблемите, идеите и вестите од ' || d.label || '.',
       true,
       (select id from public.profiles where is_admin order by created_at limit 1)
  from (values
    ('Центар'), ('Варош'), ('Тризла'), ('Точила'), ('Рид'),
    ('Типски'), ('Бончејца'), ('Корзо Маало'), ('Марино Маало'), ('Чачорица')
  ) as d(label)
 where not exists (
   select 1 from public.chat_groups g
    where g.kind = 'custom' and g.name = 'Месна заедница — ' || d.label
 );

-- Check: should list 10 rows.
select name, is_open, created_at from public.chat_groups
 where name like 'Месна заедница — %' order by name;
