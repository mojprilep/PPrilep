-- МЗ groups: no per-group description. The explanation lives once, in the app's
-- "Месни заедници" section heading (and the chat's top bar), so the list rows
-- show just the member count instead of the same sentence 10 times.
update public.chat_groups
   set description = null
 where kind = 'custom' and name like 'МЗ - %';

select name, description from public.chat_groups where name like 'МЗ - %' order by name;
