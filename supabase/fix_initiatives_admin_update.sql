-- Lets admins save edits to someone else's initiative (e.g. changing its
-- category). Without this, the update matches zero rows under RLS and the web
-- edit form fails with "Cannot coerce the result to a single JSON object".
-- Same policy as add_admin_moderation.sql, but touches nothing else there
-- (public.is_admin() already exists and is used by many other policies).
--
-- Run once in the Supabase SQL editor.

drop policy if exists "Own update initiative"          on public.initiatives;
drop policy if exists "Own or admin update initiative" on public.initiatives;
create policy "Own or admin update initiative" on public.initiatives
  for update using (auth.uid() = user_id or public.is_admin());

-- Verify: should list exactly one UPDATE policy, "Own or admin update
-- initiative", with is_admin() in its qual.
select policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'initiatives'
order by cmd, policyname;
