/**
 * КвизЧе — server-side data access for the API routes. Uses the service role:
 * kvizche_questions (which holds the answers) has no public read policy, so
 * this is the only way a question reaches a player, and only without its answer
 * until it has been answered.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { OWNER_EMAIL } from "./config/owner";
import { skopjeToday } from "./sanity/zborche";
import {
  isoDay,
  mondayOf,
  shownOptions,
  solutionOf,
  type KvizcheQuestion,
  type KvizcheResult,
  type KvizcheWeek,
} from "./kvizche";

export type AttemptRow = {
  question_id: number;
  started_at: string;
  answered_at: string | null;
  answer: number | number[] | null;
  correct: boolean | null;
  time_ms: number | null;
  points: number | null;
};

export type CurrentWeek = {
  today: string;
  day: number;
  week: KvizcheWeek | null;
  questions: KvizcheQuestion[];
};

/** This week's published quiz (Skopje calendar) and its questions, all days. */
export async function loadCurrentWeek(admin: SupabaseClient): Promise<CurrentWeek> {
  const today = skopjeToday();
  const day = isoDay(today);
  const { data: week } = await admin
    .from("kvizche_weeks")
    .select("id, week_start, theme, intro, cover_url, published")
    .eq("week_start", mondayOf(today))
    .eq("published", true)
    .maybeSingle();
  if (!week) return { today, day, week: null, questions: [] };
  const { data: questions } = await admin
    .from("kvizche_questions")
    .select("id, week_id, day, kind, prompt, options, correct_index, explanation, image_url")
    .eq("week_id", week.id)
    .order("day");
  return { today, day, week: week as KvizcheWeek, questions: (questions ?? []) as KvizcheQuestion[] };
}

/**
 * Site admins test the quiz: they may open any day of the week (not just
 * today) and wipe their own answers. Temporary, while КвизЧе is being tested.
 */
export async function isQuizTester(admin: SupabaseClient, user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email === OWNER_EMAIL) return true;
  const { data } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
}

/** A question as handed out to play — no answer, no explanation. */
export function publicQuestion(q: KvizcheQuestion) {
  return {
    id: q.id,
    day: q.day,
    kind: q.kind,
    prompt: q.prompt,
    options: shownOptions(q),
    imageUrl: q.image_url,
  };
}

export function resultOf(
  q: KvizcheQuestion,
  a: { answer: number | number[]; correct: boolean; time_ms: number; points: number },
): KvizcheResult {
  return {
    questionId: q.id,
    day: q.day,
    kind: q.kind,
    prompt: q.prompt,
    options: shownOptions(q),
    answer: a.answer,
    correct: a.correct,
    solution: solutionOf(q),
    explanation: q.explanation,
    imageUrl: q.image_url,
    timeMs: a.time_ms,
    points: a.points,
  };
}

/** The signed-in player's attempts on these questions. */
export async function loadAttempts(
  admin: SupabaseClient,
  userId: string,
  questionIds: number[],
): Promise<AttemptRow[]> {
  if (questionIds.length === 0) return [];
  const { data } = await admin
    .from("kvizche_attempts")
    .select("question_id, started_at, answered_at, answer, correct, time_ms, points")
    .eq("user_id", userId)
    .in("question_id", questionIds);
  return (data ?? []) as AttemptRow[];
}

export function answeredResult(q: KvizcheQuestion, a: AttemptRow | undefined): KvizcheResult | null {
  if (!a?.answered_at || a.answer == null) return null;
  return resultOf(q, {
    answer: a.answer,
    correct: !!a.correct,
    time_ms: a.time_ms ?? 0,
    points: a.points ?? 0,
  });
}
