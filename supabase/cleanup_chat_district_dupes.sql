-- One-off cleanup after add_chat_districts.sql ran in both versions (2026-10-03).
-- Removes only EMPTY duplicates (0 members, 0 messages, checked beforehand):
--   • the 10 kind='district' groups: the live app has no icon for that kind,
--     so they'd crash the admin "Сите групи" list;
--   • the auto-made "Месна заедница — Бончејца", which duplicates the
--     hand-made "Месна Заедница - Бончејца" (2 members, 1 message; kept).
-- The guards re-check emptiness, so nothing with a member or message is touched.

delete from public.chat_groups g
 where g.id in (
   '385411c2-019a-43a7-9226-7b59e29c2fce','ef3de3cf-8502-420c-afcf-71def738d8d6',
   '0cfc27fe-d14c-4312-9404-1809b902c14d','b2d7014e-a8d5-427e-80c0-208a7931fb1c',
   'fbde8b22-5a9e-44a0-9a28-d29f29a5e25c','7d31e544-83eb-4cac-bc10-3a87cc493e72',
   '7a17a145-8355-4b71-a633-e1806d4f9339','e2d0267c-e937-4cb3-95da-116ffa5c1120',
   '08a6e0d1-0acb-44d6-b7a0-2a98d20b6a1a','a90b7532-3a4b-4c35-a39c-f9c19209841c',
   'e7cc0823-3157-41ad-83ad-fa3337ac6380'
 )
   and not exists (select 1 from public.chat_members  m where m.group_id = g.id)
   and not exists (select 1 from public.chat_messages x where x.group_id = g.id);

-- Check: 10 rows, all kind 'custom' (your Бончејца + the 9 others).
select name, kind from public.chat_groups
 where name ilike 'Месна заедница%' order by name;
