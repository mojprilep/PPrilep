-- Месна заедница → Урбана заедница: "МЗ - Центар" → "УЗ - Центар".
-- The app (OTA 2026-10-03+) recognises both prefixes.
update public.chat_groups
   set name = 'УЗ - ' || substr(name, 6)
 where kind = 'custom' and name like 'МЗ - %';

-- Check: 10 rows, "УЗ - Бончејца" … "УЗ - Чачорица".
select name from public.chat_groups where name like 'УЗ - %' order by name;
