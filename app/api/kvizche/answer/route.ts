/**
 * КвизЧе — check and time an answer.
 *
 *   POST { questionId, answer, clientMs }   (web cookie or app Bearer session optional)
 *   → { result: KvizcheResult }
 *
 * answer: choice → the shown option index · timeline → shown positions, earliest first.
 *
 * Signed in: the question must have been started (/start); the time is the
 * server's started_at → now, or the client's own stopwatch when that is
 * plausible (see countedTime). One answer per question: the update only lands
 * on an unanswered attempt, so a double tap or a replay returns the first result.
 * Logged out: checked and timed by the client's stopwatch, nothing stored.
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../../lib/supabase/request-user";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { checkAnswer, countedTime, pointsFor, type KvizcheQuestion } from "../../../../lib/kvizche";
import { answeredResult, loadAttempts, loadCurrentWeek, resultOf } from "../../../../lib/kvizche-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A logged-out stopwatch is capped so nonsense values never reach the UI.
const MAX_ANON_MS = 60 * 60_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const questionId = Number(body.questionId);
  const clientMs = typeof body.clientMs === "number" ? body.clientMs : null;
  if (!Number.isInteger(questionId)) return NextResponse.json({ error: "Неважечко прашање." }, { status: 400 });

  const admin = createAdminClient();
  const user = await getRequestUser(req);
  const noStore = { headers: { "Cache-Control": "no-store" } };

  if (!user) {
    // Logged out: only today's question, nothing stored.
    const cur = await loadCurrentWeek(admin);
    const q = cur.questions.find((x) => x.id === questionId && x.day === cur.day);
    if (!q) return NextResponse.json({ error: "Прашањето веќе не е активно." }, { status: 404 });
    const checked = checkAnswer(q, body.answer);
    if (!checked) return NextResponse.json({ error: "Неважечки одговор." }, { status: 400 });
    const time_ms = Math.min(MAX_ANON_MS, Math.max(0, Math.round(clientMs ?? 0)));
    const points = pointsFor(q.day, q.kind, checked.correct, time_ms);
    return NextResponse.json({ result: resultOf(q, { ...checked, time_ms, points }) }, noStore);
  }

  // Signed in: the started attempt is the ticket (so an answer sent just after
  // midnight for a question opened before it still counts).
  const { data: qRow } = await admin
    .from("kvizche_questions")
    .select("id, week_id, day, kind, prompt, options, correct_index, explanation, image_url, kvizche_weeks!inner(published)")
    .eq("id", questionId)
    .eq("kvizche_weeks.published", true)
    .maybeSingle();
  if (!qRow) return NextResponse.json({ error: "Неважечко прашање." }, { status: 404 });
  const q = qRow as unknown as KvizcheQuestion;

  const [attempt] = await loadAttempts(admin, user.id, [q.id]);
  if (!attempt) return NextResponse.json({ error: "Прво отвори го прашањето." }, { status: 409 });
  const already = answeredResult(q, attempt);
  if (already) return NextResponse.json({ result: already }, noStore);

  const checked = checkAnswer(q, body.answer);
  if (!checked) return NextResponse.json({ error: "Неважечки одговор." }, { status: 400 });

  const now = new Date();
  const time_ms = countedTime(now.getTime() - new Date(attempt.started_at).getTime(), clientMs);
  const points = pointsFor(q.day, q.kind, checked.correct, time_ms);

  const { data: saved, error } = await admin
    .from("kvizche_attempts")
    .update({ answered_at: now.toISOString(), answer: checked.answer, correct: checked.correct, time_ms, points })
    .eq("user_id", user.id)
    .eq("question_id", q.id)
    .is("answered_at", null)
    .select("question_id");
  if (error) {
    console.error("[kvizche/answer]", error.message);
    return NextResponse.json({ error: "Грешка. Пробај повторно." }, { status: 500 });
  }
  if (!saved?.length) {
    // Lost a race with a parallel answer — return the one that landed.
    const [winner] = await loadAttempts(admin, user.id, [q.id]);
    const result = answeredResult(q, winner);
    if (result) return NextResponse.json({ result }, noStore);
  }
  return NextResponse.json({ result: resultOf(q, { ...checked, time_ms, points }) }, noStore);
}
