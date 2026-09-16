-- ЗборЧе daily "you haven't played yet" nudge — per-day, per-device send log.
--
-- The cron at /api/cron/zborche-nudge pushes a reminder to every device that
-- hasn't played the day's word. This table is its dedupe ledger: one row per
-- (puzzle_date, expo_token) marks that device as already nudged today, so the
-- every-15-min sweep sends at most once per device per day even though it runs
-- many times. Written only by the service-role cron; RLS on with no policy keeps
-- it private (the service role bypasses RLS).
--
-- Idempotent — safe to run more than once.

create table if not exists public.zborche_nudge_log (
  puzzle_date date not null,
  expo_token  text not null,
  sent_at     timestamptz not null default now(),
  primary key (puzzle_date, expo_token)
);

alter table public.zborche_nudge_log enable row level security;
