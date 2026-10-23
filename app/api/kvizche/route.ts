/**
 * КвизЧе — this week's quiz at a glance.
 *
 *   GET   (web cookie or app Bearer session optional)
 *   → { today, day, signedIn, week: { theme, intro, coverUrl, weekStart } | null,
 *       days: [{ day, kind, optionCount, status, result }] }
 *
 * status: "today" (playable now) · "answered" (result included) · "missed"
 * (a past day not answered) · "upcoming" · "none" (no question set that day).
 * tester (site admins, while testing): every unanswered day is "today".
 * Never contains an unanswered question's prompt or answer.
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../lib/supabase/request-user";
import { createAdminClient } from "../../../lib/supabase/admin";
import { answeredResult, isQuizTester, loadAttempts, loadCurrentWeek } from "../../../lib/kvizche-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = createAdminClient();
  const [user, cur] = await Promise.all([getRequestUser(req), loadCurrentWeek(admin)]);
  const [attempts, tester] = await Promise.all([
    user ? loadAttempts(admin, user.id, cur.questions.map((q) => q.id)) : [],
    isQuizTester(admin, user),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const q = cur.questions.find((x) => x.day === day);
    if (!q) return { day, kind: null, optionCount: 0, status: "none", result: null };
    const result = answeredResult(q, attempts.find((a) => a.question_id === q.id));
    const status = result ? "answered" : day === cur.day || tester ? "today" : day < cur.day ? "missed" : "upcoming";
    return { day, kind: q.kind, optionCount: q.options.length, status, result };
  });

  return NextResponse.json(
    {
      today: cur.today,
      day: cur.day,
      signedIn: !!user,
      tester,
      week: cur.week && {
        theme: cur.week.theme,
        intro: cur.week.intro,
        coverUrl: cur.week.cover_url,
        weekStart: cur.week.week_start,
      },
      days,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
