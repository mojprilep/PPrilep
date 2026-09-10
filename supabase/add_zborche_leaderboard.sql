-- ════════════════════════════════════════════════════════════════════════════
--  ЗборЧе leaderboard — one saved result per player per day, and a public board.
--
--  The daily word game is otherwise entirely on-device (localStorage / Async-
--  Storage). This table is the ONE place a logged-in player's finished games are
--  recorded on the server, so we can show a cross-user scoreboard. Anonymous /
--  logged-out players never write here — their stats stay purely local.
--
--  `zborche_results` holds exactly one row per (user, puzzle_date): the primary
--  key makes finishing idempotent, and there is deliberately NO update/delete
--  policy, so a player can't overwrite a day's result with a better score. RLS
--  scopes each row to its owner, so the mobile app's anon+JWT client can insert
--  a user's own result directly; the service role bypasses RLS.
--
--  The board itself is exposed through `zborche_leaderboard()` — a SECURITY
--  DEFINER function (same pattern as award_applause) that returns ONLY public
--  aggregates (name, avatar, counts), never anyone's per-day rows. It is granted
--  to anon + authenticated so the web panel and the app can both read it without
--  a service-role round-trip.
--
--  Run ONCE in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.zborche_results (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  puzzle_date  date        not null,
  won          boolean     not null,
  attempts     smallint,   -- guesses used when won; null on a loss
  created_at   timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);

-- Per-day boards and "played today" lookups scan by date.
create index if not exists zborche_results_date_idx
  on public.zborche_results (puzzle_date);

alter table public.zborche_results enable row level security;

-- A player may read and create only their own results. There is intentionally
-- no UPDATE or DELETE policy: a day's result is written once and frozen. The
-- service role bypasses all of this.
create policy "read own zborche results"
  on public.zborche_results for select
  using (auth.uid() = user_id);

create policy "insert own zborche result"
  on public.zborche_results for insert
  with check (auth.uid() = user_id);

-- ── Public leaderboard ──────────────────────────────────────────────────────
-- SECURITY DEFINER so it runs as the owner and can aggregate across every
-- player's rows, while exposing only public columns. `set search_path` pins the
-- schema (hardening, per fix_trigger_function_search_path). Ranked by wins, then
-- fewest average guesses, then most games played.
create or replace function public.zborche_leaderboard(p_limit int default 50)
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
  order by wins desc, avg_attempts asc nulls last, played desc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.zborche_leaderboard(int) to anon, authenticated;
