/**
 * КвизЧе — hand out today's question and start the clock.
 *
 *   POST   (web cookie or app Bearer session optional)
 *   → { question: { id, day, kind, prompt, options, imageUrl }, startedAt }
 *   → { result }   when today's question was already answered
 *
 * For a signed-in player the first call records started_at; later calls keep
 * it (insert … on conflict do nothing), so closing and reopening the question
 * does not restart the clock. A tester (site admin) may pass { day } to open
 * any day of the week. A logged-out player gets the question without
 * any record — they play for fun, unranked.
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../../lib/supabase/request-user";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { answeredResult, isQuizTester, loadAttempts, loadCurrentWeek, publicQuestion } from "../../../../lib/kvizche-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as { day?: unknown };
  const [user, cur] = await Promise.all([getRequestUser(req), loadCurrentWeek(admin)]);
  const asked = Number(body.day);
  const day = Number.isInteger(asked) && asked !== cur.day && (await isQuizTester(admin, user)) ? asked : cur.day;
  const q = cur.questions.find((x) => x.day === day);
  if (!q) return NextResponse.json({ error: "Денес нема прашање." }, { status: 404 });

  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (!user) return NextResponse.json({ question: publicQuestion(q), startedAt: null }, noStore);

  const { error } = await admin
    .from("kvizche_attempts")
    .upsert({ user_id: user.id, question_id: q.id }, { onConflict: "user_id,question_id", ignoreDuplicates: true });
  if (error) {
    console.error("[kvizche/start]", error.message);
    return NextResponse.json({ error: "Грешка. Пробај повторно." }, { status: 500 });
  }
  const [attempt] = await loadAttempts(admin, user.id, [q.id]);
  const result = answeredResult(q, attempt);
  if (result) return NextResponse.json({ result }, noStore);
  return NextResponse.json({ question: publicQuestion(q), startedAt: attempt?.started_at ?? null }, noStore);
}
