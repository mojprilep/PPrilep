// GET /api/cron/zborche-nudge
//
// Daily "today's ЗборЧе is still waiting" nudge. Driven by the same every-15-min
// GitHub Action as the event reminders (.github/workflows/event-reminders.yml).
// It gates itself to 11:30 Europe/Skopje and dedupes per device per day via
// zborche_nudge_log, so the many runs collapse into one send per device.
//
// Targets every enabled device that hasn't played today:
//   • anonymous devices (no user_id) — always, since their play is on-device only
//     and the server can't know whether they've played;
//   • signed-in devices whose user has no zborche_results row for today.
// A signed-in user who already finished today is skipped precisely.
//
// Auth: `Authorization: Bearer <CRON_SECRET>`, same as the event-reminders cron.

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { fetchDailyWord } from "@/lib/sanity/zborche";
import { sendExpoPush, type PushMessage } from "@/lib/push/expo";
import { wantsCategory } from "@/lib/push/prefs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_URL = "https://mojprilep.mk";
const TZ = "Europe/Skopje";
const SEND_AT_MIN = 11 * 60 + 30; // 11:30 Skopje

/** Minutes since midnight in Europe/Skopje right now. */
function skopjeMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return (Number(get("hour")) % 24) * 60 + Number(get("minute"));
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Not yet the send time — a later run today will handle it.
  if (skopjeMinutes() < SEND_AT_MIN) {
    return NextResponse.json({ ok: true, skipped: "before send time" });
  }

  // No word scheduled today → nothing to nudge about.
  const puzzle = await fetchDailyWord();
  if (!puzzle) {
    return NextResponse.json({ ok: true, skipped: "no word today" });
  }
  const today = puzzle.date;

  const admin = createAdminClient();

  // Signed-in users who already finished today's word — skip them precisely.
  const { data: played, error: playedErr } = await admin
    .from("zborche_results")
    .select("user_id")
    .eq("puzzle_date", today);
  if (playedErr) {
    console.error("[cron/zborche-nudge] played", playedErr);
    return NextResponse.json({ error: "Could not read results" }, { status: 500 });
  }
  const playedSet = new Set((played ?? []).map((r) => r.user_id as string));

  // Every enabled device: anonymous ones always qualify; signed-in ones only if
  // their user hasn't finished today.
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("expo_token, user_id, notif_prefs")
    .eq("enabled", true);
  if (subsErr) {
    console.error("[cron/zborche-nudge] subs", subsErr);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }
  const candidates = [
    ...new Set(
      (subs ?? [])
        .filter((s) => wantsCategory(s.notif_prefs as Record<string, unknown> | null, "games"))
        .filter((s) => !s.user_id || !playedSet.has(s.user_id as string))
        .map((s) => s.expo_token as string)
        .filter(Boolean),
    ),
  ];

  // Drop devices already nudged today (the dedupe ledger).
  const { data: logged, error: logErr } = await admin
    .from("zborche_nudge_log")
    .select("expo_token")
    .eq("puzzle_date", today);
  if (logErr) {
    console.error("[cron/zborche-nudge] log", logErr);
    return NextResponse.json({ error: "Could not read nudge log" }, { status: 500 });
  }
  const nudgedSet = new Set((logged ?? []).map((r) => r.expo_token as string));
  const targets = candidates.filter((t) => !nudgedSet.has(t));
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const link = `${BASE_URL}/zborche`;
  const messages: PushMessage[] = targets.map((to) => ({
    to,
    title: "ЗборЧе 🟩",
    body: "Денешниот збор те чека! Погоди го и продолжи ја серијата.",
    data: { link, type: "event" },
    channelId: "default",
  }));

  const tickets = await sendExpoPush(messages);
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    const code = (t.details as { error?: string } | undefined)?.error;
    if (t.status === "error" && code === "DeviceNotRegistered") dead.push(targets[i]);
  });

  // Mark every target as nudged today (even the few that erred) so no device is
  // pinged twice — a stuck reminder retried is worse than one missed push, and
  // dead tokens are pruned below anyway.
  await admin
    .from("zborche_nudge_log")
    .upsert(
      targets.map((tok) => ({ puzzle_date: today, expo_token: tok })),
      { onConflict: "puzzle_date,expo_token", ignoreDuplicates: true },
    );

  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("expo_token", dead);
  }

  return NextResponse.json({ ok: true, sent: targets.length, pruned: dead.length });
}
