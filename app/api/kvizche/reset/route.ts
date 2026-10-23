/**
 * КвизЧе — wipe the caller's own answers for this week, so a tester can play
 * the days again. Site admins only; temporary, while the quiz is being tested.
 *
 *   POST   (web cookie or app Bearer session)
 *   → { ok: true, removed }
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../../lib/supabase/request-user";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isQuizTester, loadCurrentWeek } from "../../../../lib/kvizche-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const [user, cur] = await Promise.all([getRequestUser(req), loadCurrentWeek(admin)]);
  if (!user || !(await isQuizTester(admin, user))) {
    return NextResponse.json({ error: "Само за администратори." }, { status: 403 });
  }
  const ids = cur.questions.map((q) => q.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, removed: 0 });

  const { data, error } = await admin
    .from("kvizche_attempts")
    .delete()
    .eq("user_id", user.id)
    .in("question_id", ids)
    .select("question_id");
  if (error) {
    console.error("[kvizche/reset]", error.message);
    return NextResponse.json({ error: "Грешка. Пробај повторно." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, removed: data?.length ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
