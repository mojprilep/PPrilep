-- ════════════════════════════════════════════════════════════════════════════
--  ЗборЧе — "Денес" board + uncapped all-time board.
--
--  1. zborche_leaderboard(): the 200-row cap is gone. `p_limit` is kept only so
--     installed app versions that still pass 200 keep working, and it is
--     ignored: every player who has ever finished a game is returned.
--
--  2. zborche_today_board(): who solved TODAY's word (Europe/Skopje calendar
--     date), ranked by fewest guesses, then by who finished first. So a
--     first-time player who nails it in 2 tops the board, however long their
--     streak is. `played_today` (same on every row) is how many signed-in
--     players finished today, win or lose: the "N played today" header.
--     Same SECURITY DEFINER pattern as the all-time board: only public columns
--     (name, avatar, guess count, finish time) leave the function, never anyone's
--     guesses.
--
--  Run ONCE in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.zborche_leaderboard(p_limit int default null)
returns table (
  user_id       uuid,
  name          text,
  avatar_url    text,
  played        int,
  wins          int,
  win_pct       int,
  avg_attempts  numeric,
  best_attempts int,
  last_played   date
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Играч') as name,
    p.avatar_url,
    count(*)::int                                                as played,
    count(*) filter (where r.won)::int                           as wins,
    round(100.0 * count(*) filter (where r.won)
          / nullif(count(*), 0))::int                            as win_pct,
    round(avg(r.attempts) filter (where r.won), 2)               as avg_attempts,
    min(r.attempts) filter (where r.won)::int                    as best_attempts,
    max(r.puzzle_date)                                           as last_played
  from public.zborche_results r
  left join public.profiles p on p.id = r.user_id
  group by r.user_id, p.full_name, p.username, p.avatar_url
  order by wins desc, avg_attempts asc nulls last, played desc;
$$;

grant execute on function public.zborche_leaderboard(int) to anon, authenticated;

create or replace function public.zborche_today_board()
returns table (
  user_id      uuid,
  name         text,
  avatar_url   text,
  attempts     int,
  solved_at    timestamptz,
  played_today int
)
language sql
security definer
set search_path = public
stable
as $$
  with today as (
    select r.*
    from public.zborche_results r
    where r.puzzle_date = (now() at time zone 'Europe/Skopje')::date
  )
  select
    t.user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Играч') as name,
    p.avatar_url,
    t.attempts::int,
    t.created_at                                                 as solved_at,
    (select count(*) from today)::int                            as played_today
  from today t
  left join public.profiles p on p.id = t.user_id
  where t.won
  order by t.attempts asc, t.created_at asc;
$$;

grant execute on function public.zborche_today_board() to anon, authenticated;
