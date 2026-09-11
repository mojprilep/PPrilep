-- ════════════════════════════════════════════════════════════════════════════
--  ЗборЧе — store the finished board so a day syncs across devices.
--
--  zborche_results already records one frozen row per (user, puzzle_date) with
--  the outcome (won / attempts) for the public leaderboard. That was enough for
--  the scoreboard, but the *board itself* (which guesses were played) still lived
--  only on the device, so finishing on the phone left the website replayable.
--
--  This adds the actual guesses to the row. It is written once, at completion,
--  alongside won/attempts (the row stays frozen — no UPDATE policy). On load a
--  signed-in player reads today's row back and restores the exact board on any
--  device. Nullable + backfill-free: rows written before this migration simply
--  have null guesses and fall back to a "already played today" lock.
--
--  Run ONCE in the Supabase SQL editor, after add_zborche_leaderboard.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.zborche_results
  add column if not exists guesses text[];
