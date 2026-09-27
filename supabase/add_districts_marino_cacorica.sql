-- Adds two naselbi: Марино Маало (MarinoMaalo) and Чачорица (Cacorica).
-- issues, ideas and initiatives may each pin `district` with a CHECK
-- constraint, so tagging a post with either new value fails until this runs.
-- Not every table has a `district` column in prod (the first version of this
-- script failed with 42703), so only tables that have one are touched.
--
-- Run once in the Supabase SQL editor, BEFORE deploying the app change.

do $$
declare
  t text;
begin
  foreach t in array array['issues', 'ideas', 'initiatives'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'district'
    ) then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_district_check');
      execute format(
        'alter table public.%I add constraint %I check (district in ('
        || '''Center'',''Varoš'',''Trizla'',''Točila'',''Rid'',''Tipski'',''Boncejca'',''KorzoMaalo'','
        || '''MarinoMaalo'',''Cacorica''))',
        t, t || '_district_check'
      );
      raise notice 'updated %', t;
    else
      raise notice 'skipped % (no district column)', t;
    end if;
  end loop;
end $$;

-- Verify: every table listed here should have a district column and a
-- constraint that includes MarinoMaalo and Cacorica.
select c.table_name,
       pg_get_constraintdef(k.oid) as district_check
from information_schema.columns c
left join pg_constraint k
  on k.conrelid = format('public.%I', c.table_name)::regclass
 and k.conname = c.table_name || '_district_check'
where c.table_schema = 'public'
  and c.column_name = 'district'
  and c.table_name in ('issues', 'ideas', 'initiatives');
