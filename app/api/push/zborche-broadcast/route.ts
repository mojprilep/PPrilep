/**
 * POST /api/push/zborche-broadcast — admin-only "new ЗборЧе word is live" nudge.
 *
 * Pushes a reminder to EVERY enabled device that a fresh daily word is waiting
 * in the app. Unlike the event broadcast this takes no subject — there is one
 * puzzle a day and the link always points at the game. Intentionally repeatable
 * (the admin decides when to fire it), and it never writes to the leaderboard or
 * any per-user state — it is purely a push.
 *
 * Auth: the site admin only — the web cookie session or a mobile Bearer token,
 * then profiles.is_admin / OWNER_EMAIL / ADMIN_EMAIL. Mirrors /api/push/broadcast.
 *
 *   POST {} → { ok, sent, pruned }
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../../lib/supabase/request-user";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { sendExpoPush, type PushMessage } from "@/lib/push/expo";
import { OWNER_EMAIL } from "@/lib/config/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Absolute: the link rides inside a push payload the phone opens, so a relative
// path has nothing to resolve against outside a browser.
const BASE_URL = "https://mojprilep.mk";

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Gate to the site admin: profiles.is_admin, or a configured owner/admin email.
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    Boolean(profile?.is_admin) ||
    user.email === OWNER_EMAIL ||
    (!!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("expo_token")
    .eq("enabled", true);
  if (error) {
    console.error("[push/zborche-broadcast] tokens", error);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }

  const tokens = (rows ?? []).map((r) => r.expo_token as string).filter(Boolean);
  if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const link = `${BASE_URL}/zborche`;
  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title: "ЗборЧе 🟩",
    body: "Нов збор те чека денес! Погоди го и продолжи ја серијата.",
    data: { link, type: "event" },
    channelId: "default",
  }));

  const tickets = await sendExpoPush(messages);
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    const code = (t.details as { error?: string } | undefined)?.error;
    if (t.status === "error" && code === "DeviceNotRegistered") dead.push(tokens[i]);
  });
  if (dead.length) await admin.from("push_subscriptions").delete().in("expo_token", dead);

  return NextResponse.json({ ok: true, sent: tokens.length, pruned: dead.length });
}
