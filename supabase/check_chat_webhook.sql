-- Diagnose: chat pushes never arrive (2026-10-12).
--
-- Verified from outside the DB: /api/chat/notify is live and accepts CRON_SECRET,
-- its recipient logic includes you for the latest message, and Expo/APNs accept
-- your device tokens. So the missing link is the Database Webhook on
-- chat_messages INSERT. Run these in the SQL editor, one at a time.

-- 1) Is there a webhook trigger on chat_messages at all?
--    Expect one row (the dashboard names it after the webhook) whose definition
--    calls supabase_functions.http_request('https://www.mojprilep.mk/api/chat/notify', ...).
select tgname, pg_get_triggerdef(oid) as def
from pg_trigger
where tgrelid = 'public.chat_messages'::regclass and not tgisinternal;

-- 2) What did recent webhook calls get back? (pg_net keeps ~6h of responses.)
--    401 = wrong secret header · 404/308 = wrong URL (must be https://www.…)
--    timed_out = webhook timeout too low (set it to 5000 ms).
select id, status_code, timed_out, error_msg, left(content, 120) as body, created
from net._http_response
order by created desc
limit 20;

-- 3) FIX if (1) returns nothing — create the trigger the dashboard would.
--    Replace <CRON_SECRET> with the value from Vercel/.env.local IN THE EDITOR
--    ONLY; never commit the secret into this file.
-- create trigger chat_notify
--   after insert on public.chat_messages
--   for each row execute function supabase_functions.http_request(
--     'https://www.mojprilep.mk/api/chat/notify',
--     'POST',
--     '{"Content-Type":"application/json","x-webhook-secret":"<CRON_SECRET>"}',
--     '{}',
--     '5000'
--   );
