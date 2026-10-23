"use server";

/**
 * Admin side of КвизЧе (/admin/kvizche): weekly themes and their seven
 * questions.
 *
 * Runs on the admin's own session, so RLS (public.is_admin()) is the real
 * gate; requireAdmin() just turns a non-admin into a clean error.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import {
  isoDay,
  OPTIONS_BY_DAY,
  TIMELINE_MAX,
  TIMELINE_MIN,
  type KvizcheQuestion,
  type KvizcheWeek,
  type QuestionKind,
} from "../../lib/kvizche";

type Result<T = undefined> = { data?: T; error?: string };

export type AdminKvizcheWeek = KvizcheWeek & {
  questions: (KvizcheQuestion & { answered: number; correct: number })[];
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Најавете се." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { supabase, error: "Само за администратори." };
  return { supabase, error: null };
}

function changed() {
  revalidatePath("/admin/kvizche");
}

function clean(v: unknown, max = 2000): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s === "" ? null : s;
}

/** Every week, newest first, with its questions and how they were answered. */
export async function fetchAdminKvizche(): Promise<Result<AdminKvizcheWeek[]>> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const { data: weeks, error: wErr } = await supabase
    .from("kvizche_weeks")
    .select("id, week_start, theme, intro, cover_url, published")
    .order("week_start", { ascending: false });
  if (wErr) return { error: wErr.message };
  if (!weeks?.length) return { data: [] };

  const { data: questions, error: qErr } = await supabase
    .from("kvizche_questions")
    .select("id, week_id, day, kind, prompt, options, correct_index, explanation, image_url")
    .in(
      "week_id",
      weeks.map((w) => w.id),
    )
    .order("day");
  if (qErr) return { error: qErr.message };

  const qIds = (questions ?? []).map((q) => q.id);
  const stats = new Map<number, { answered: number; correct: number }>();
  if (qIds.length) {
    const { data: attempts } = await supabase
      .from("kvizche_attempts")
      .select("question_id, correct")
      .in("question_id", qIds)
      .not("answered_at", "is", null);
    for (const a of attempts ?? []) {
      const s = stats.get(a.question_id) ?? { answered: 0, correct: 0 };
      s.answered++;
      if (a.correct) s.correct++;
      stats.set(a.question_id, s);
    }
  }

  return {
    data: weeks.map((w) => ({
      ...(w as KvizcheWeek),
      questions: (questions ?? [])
        .filter((q) => q.week_id === w.id)
        .map((q) => ({ ...(q as KvizcheQuestion), ...(stats.get(q.id) ?? { answered: 0, correct: 0 }) })),
    })),
  };
}

export interface WeekInput {
  id?: number | null;
  week_start: string;
  theme: string;
  intro?: string | null;
  cover_url?: string | null;
}

/** Create a week (as a draft) or edit one. */
export async function saveKvizcheWeek(input: WeekInput): Promise<Result<{ id: number }>> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const theme = clean(input.theme, 120);
  if (!theme) return { error: "Внесете тема." };
  const weekStart = clean(input.week_start, 10);
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || isoDay(weekStart) !== 1)
    return { error: "Неделата мора да почнува во понеделник." };
  const row = {
    week_start: weekStart,
    theme,
    intro: clean(input.intro, 2000),
    cover_url: clean(input.cover_url, 500),
  };

  if (input.id) {
    const { error: e } = await supabase.from("kvizche_weeks").update(row).eq("id", input.id);
    if (e) return { error: e.code === "23505" ? "Веќе има квиз за таа недела." : e.message };
    changed();
    return { data: { id: input.id } };
  }
  const { data, error: e } = await supabase.from("kvizche_weeks").insert(row).select("id").single();
  if (e) return { error: e.code === "23505" ? "Веќе има квиз за таа недела." : e.message };
  changed();
  return { data: { id: data.id } };
}

/** Publishing needs all seven days filled in. */
export async function setKvizcheWeekPublished(weekId: number, published: boolean): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  if (published) {
    const { count } = await supabase
      .from("kvizche_questions")
      .select("id", { count: "exact", head: true })
      .eq("week_id", weekId);
    if ((count ?? 0) < 7) return { error: "Пополнете ги сите 7 дена пред објавување." };
  }
  const { error: e } = await supabase.from("kvizche_weeks").update({ published }).eq("id", weekId);
  if (e) return { error: e.message };
  changed();
  return {};
}

export async function deleteKvizcheWeek(weekId: number): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const { error: e } = await supabase.from("kvizche_weeks").delete().eq("id", weekId);
  if (e) return { error: e.message };
  changed();
  return {};
}

export interface QuestionInput {
  prompt: string;
  /** choice: the options in display order · timeline: the events in the CORRECT order. */
  options: string[];
  correct_index?: number | null;
  explanation?: string | null;
  image_url?: string | null;
}

/**
 * Save the question for one day of a week (create or replace). The day decides
 * the shape: Mon–Sat a choice with OPTIONS_BY_DAY options, Sunday a timeline.
 */
export async function saveKvizcheQuestion(
  weekId: number,
  day: number,
  input: QuestionInput,
): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  if (!Number.isInteger(day) || day < 1 || day > 7) return { error: "Неважечки ден." };
  const prompt = clean(input.prompt, 500);
  if (!prompt) return { error: "Внесете прашање." };
  const options = (input.options ?? []).map((o) => clean(o, 200)).filter((o): o is string => !!o);
  const kind: QuestionKind = day === 7 ? "timeline" : "choice";

  let correct_index: number | null = null;
  if (kind === "choice") {
    if (options.length !== OPTIONS_BY_DAY[day - 1])
      return { error: `Овој ден има ${OPTIONS_BY_DAY[day - 1]} одговори.` };
    correct_index = Number(input.correct_index);
    if (!Number.isInteger(correct_index) || correct_index < 0 || correct_index >= options.length)
      return { error: "Означете го точниот одговор." };
  } else if (options.length < TIMELINE_MIN || options.length > TIMELINE_MAX) {
    return { error: `Хронологијата има ${TIMELINE_MIN}–${TIMELINE_MAX} настани.` };
  }
  if (new Set(options).size !== options.length) return { error: "Одговорите мора да се различни." };

  const row = {
    week_id: weekId,
    day,
    kind,
    prompt,
    options,
    correct_index,
    explanation: clean(input.explanation, 2000),
    image_url: clean(input.image_url, 500),
  };
  const { error: e } = await supabase.from("kvizche_questions").upsert(row, { onConflict: "week_id,day" });
  if (e) return { error: e.message };
  changed();
  return {};
}

export async function deleteKvizcheQuestion(questionId: number): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const { error: e } = await supabase.from("kvizche_questions").delete().eq("id", questionId);
  if (e) return { error: e.message };
  changed();
  return {};
}
