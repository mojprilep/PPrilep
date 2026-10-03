-- Маало groups: name "МЗ - Центар"; the description explains МЗ and is shown
-- as a banner at the top of the chat (and on the join screen).
-- Works on any earlier form: "Месна заедница — Центар", "Месна Заедница - Бончејца",
-- "МЗ Центар", "МЗ - Центар". [Зз] instead of case-insensitive matching:
-- Cyrillic case folding depends on the database locale.

with src as (
  select id,
         btrim(regexp_replace(name, '^(Месна [Зз]аедница|МЗ)\s*[—-]?\s*', '')) as maalo
    from public.chat_groups
   where kind = 'custom'
     and name ~ '^(Месна [Зз]аедница|МЗ)(\s|[—-])'
)
update public.chat_groups g
   set name = 'МЗ - ' || s.maalo,
       description = 'МЗ = месна заедница. Ова е муабетот на соседите од ' || s.maalo
                     || ': проблеми во маалото, идеи, договори и вести.'
  from src s
 where g.id = s.id;

-- Check: 10 rows, "МЗ - Бончејца" … "МЗ - Чачорица".
select name, description from public.chat_groups
 where name like 'МЗ - %' order by name;
