-- ════════════════════════════════════════════════════════════════════════════
--  КвизЧе — the weekly themed history quiz (Прилеп & Македонија).
--
--  One theme per week (Mon–Sun), ONE question per day, harder each day:
--  Mon 2 options · Tue 2 · Wed 3 · Thu 4 · Fri 5 · Sat 5 · Sun a timeline
--  (put the events in order). Scored on correctness + time.
--
--  The correct answers live in kvizche_questions, which has NO public read
--  policy at all: players only ever see a question through the web API
--  (service role), which hands it out without the answer, starts the timer
--  (kvizche_attempts.started_at) and checks + times the answer on the server.
--  Timeline events are stored IN THE CORRECT ORDER and shuffled on hand-out.
--  Admins (public.is_admin(), from add_admin_moderation.sql) manage everything
--  from /admin/kvizche.
--
--  The two boards are SECURITY DEFINER functions that return only public
--  columns (name, avatar, correct, time, points) — never anyone's answer.
--
--  Run ONCE in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.kvizche_weeks (
  id          bigint generated always as identity primary key,
  week_start  date        not null unique check (extract(isodow from week_start) = 1),  -- a Monday
  theme       text        not null,
  intro       text,
  cover_url   text,
  published   boolean     not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.kvizche_questions (
  id             bigint generated always as identity primary key,
  week_id        bigint   not null references public.kvizche_weeks (id) on delete cascade,
  day            smallint not null check (day between 1 and 7),          -- 1 = Monday … 7 = Sunday
  kind           text     not null check (kind in ('choice', 'timeline')),
  prompt         text     not null,
  options        text[]   not null,   -- choice: shown in this order · timeline: events in CORRECT order
  correct_index  smallint,            -- choice only (0-based)
  explanation    text,                -- the "Дали знаеше?" card, shown after answering
  image_url      text,
  unique (week_id, day),
  check (kind = 'timeline' or correct_index between 0 and coalesce(array_length(options, 1), 0) - 1)
);

-- One row per player per question: created when the question is handed out
-- (started_at), completed when answered. No client writes at all — only the
-- API (service role) writes here, so the timer can't be tampered with.
create table if not exists public.kvizche_attempts (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  question_id  bigint      not null references public.kvizche_questions (id) on delete cascade,
  started_at   timestamptz not null default now(),
  answered_at  timestamptz,
  answer       jsonb,      -- choice: option index · timeline: the submitted order (indexes into options)
  correct      boolean,
  time_ms      int,
  points       int,
  primary key (user_id, question_id)
);

create index if not exists kvizche_attempts_question_idx
  on public.kvizche_attempts (question_id) where answered_at is not null;

alter table public.kvizche_weeks     enable row level security;
alter table public.kvizche_questions enable row level security;
alter table public.kvizche_attempts  enable row level security;

create policy "Admins manage kvizche weeks" on public.kvizche_weeks
  for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage kvizche questions" on public.kvizche_questions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins read kvizche attempts" on public.kvizche_attempts
  for select using (public.is_admin());
create policy "Players read own kvizche attempts" on public.kvizche_attempts
  for select using (auth.uid() = user_id);

-- Explicit grants (new public tables don't get Data API access by default).
grant select, insert, update, delete on public.kvizche_weeks     to authenticated;
grant select, insert, update, delete on public.kvizche_questions to authenticated;
grant select                         on public.kvizche_attempts  to authenticated;
grant all on public.kvizche_weeks, public.kvizche_questions, public.kvizche_attempts to service_role;

-- ── Boards ──────────────────────────────────────────────────────────────────
-- "Today" and "this week" follow the Europe/Skopje calendar, like ЗборЧе.

-- Денес: everyone who answered today's question; right answers first, then the
-- fastest. played_today / correct_today (same on every row) feed the header.
create or replace function public.kvizche_today_board()
returns table (
  user_id        uuid,
  name           text,
  avatar_url     text,
  correct        boolean,
  time_ms        int,
  points         int,
  played_today   int,
  correct_today  int
)
language sql
security definer
set search_path = public
stable
as $$
  with d as (select (now() at time zone 'Europe/Skopje')::date as today),
  q as (
    select qu.id
    from public.kvizche_questions qu
    join public.kvizche_weeks w on w.id = qu.week_id, d
    where w.published
      and w.week_start = d.today - (extract(isodow from d.today)::int - 1)
      and qu.day = extract(isodow from d.today)::int
  ),
  a as (
    select at.* from public.kvizche_attempts at
    where at.question_id in (select id from q) and at.answered_at is not null
  )
  select
    a.user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Играч') as name,
    p.avatar_url,
    a.correct,
    a.time_ms,
    a.points,
    (select count(*) from a)::int                        as played_today,
    (select count(*) from a where a.correct)::int        as correct_today
  from a
  left join public.profiles p on p.id = a.user_id
  order by a.correct desc, a.time_ms asc;
$$;

-- Оваа недела: points summed over this week's answered questions; ties go to
-- whoever spent less time on their right answers.
create or replace function public.kvizche_week_board()
returns table (
  user_id     uuid,
  name        text,
  avatar_url  text,
  points      int,
  correct     int,
  answered    int,
  time_ms     int
)
language sql
security definer
set search_path = public
stable
as $$
  with d as (select (now() at time zone 'Europe/Skopje')::date as today),
  q as (
    select qu.id
    from public.kvizche_questions qu
    join public.kvizche_weeks w on w.id = qu.week_id, d
    where w.published
      and w.week_start = d.today - (extract(isodow from d.today)::int - 1)
  )
  select
    a.user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Играч') as name,
    p.avatar_url,
    sum(coalesce(a.points, 0))::int                         as points,
    count(*) filter (where a.correct)::int                  as correct,
    count(*)::int                                           as answered,
    coalesce(sum(a.time_ms) filter (where a.correct), 0)::int as time_ms
  from public.kvizche_attempts a
  left join public.profiles p on p.id = a.user_id
  where a.question_id in (select id from q) and a.answered_at is not null
  group by a.user_id, p.full_name, p.username, p.avatar_url
  order by points desc, time_ms asc;
$$;

grant execute on function public.kvizche_today_board() to anon, authenticated;
grant execute on function public.kvizche_week_board()  to anon, authenticated;
