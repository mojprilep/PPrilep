// POST /api/push/notify
//
// Bridge: turns an in-app `notifications` row into a push to the recipient's
// devices. Intended to be called by a Supabase **Database Webhook** on INSERT
// into public.notifications, so every civic notification the app already
// creates (issue status change → reporter, comments, agency alerts, etc.) also
// arrives as a push — no per-feature wiring.
//
// Supabase Database Webhook setup (user, one-time):
//   Table: public.notifications · Events: INSERT · Type: HTTP Request
//   URL: https://www.mojprilep.mk/api/push/notify
//   HTTP header:  x-webhook-secret: <CRON_SECRET>
//
// Webhook body shape: { type: "INSERT", record: { recipient_user_id, title,
// body, link, ... } }. We look up that user's enabled Expo tokens and send.

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { sendExpoPush, type PushMessage } from "../../../../lib/push/expo";
import { wantsCategory } from "../../../../lib/push/prefs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NotificationRecord = {
  recipient_user_id?: string;
  title?: string;
  body?: string;
  link?: string;
  type?: string;
};

// Links that point at web-only destinations the mobile app has no screen for.
// A push carrying one of these can't open anything on the phone — tapping it
// just brings the app up on the home screen — so it's noise on mobile even
// though it's a useful clickable row in the in-app bell (where the admin reads
// it on desktop). `/studio` is the Sanity CMS: the "нов настан за преглед"
// review ping (events/submit → notifyAdmins) is the main offender, and because
// it fires to admins on submit while broadcastNewEvent fires to everyone on
// publish, an admin otherwise gets TWO pushes per event — one of them dead.
const MOBILE_DEAD_LINKS = new Set(["/studio"]);

// Notification types that must still reach the phone even though their link is
// web-only. The admin reviews in Studio on desktop, but the *alert* — "a club
// applied" — is worth a push regardless; we just strip the dead link below so
// tapping opens the app rather than dangling on a screen it doesn't have.
// Unlike `event_submission`, a club submission has no matching publish-time
// broadcast, so this is the ONLY chance to notify — there is no double-push to
// avoid here.
const ALWAYS_ALERT_TYPES = new Set(["sport_submission"]);

// Notification types that count as "utility" (комуналии) — municipal/agency
// outage-style alerts (EVN electricity, water, etc.). Only these are gated by
// the device's `utility` preference; personal civic notifications (issue
// updates, comments, help offers) always reach their recipient regardless.
const UTILITY_TYPES = new Set(["agency_post", "agency_alert"]);

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  // Supabase webhooks can't send an Authorization header cleanly, so we use a
  // custom header. Accept either for flexibility.
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as {
    record?: NotificationRecord;
    type?: string;
  };
  const rec = payload.record;
  if (!rec?.recipient_user_id || !rec.title) {
    return NextResponse.json({ ok: true, skipped: "no recipient/title" });
  }

  // A web-only link (e.g. the `/studio` review queue) normally means no push —
  // it could only ever open the app on its home screen. The exception is an
  // always-alert type, which still pushes but with the dead link dropped so the
  // tap just opens the app; the row keeps its link for the desktop in-app bell.
  const alwaysAlert = rec.type ? ALWAYS_ALERT_TYPES.has(rec.type) : false;
  const mobileLink = rec.link && MOBILE_DEAD_LINKS.has(rec.link) ? undefined : rec.link;
  if (rec.link && MOBILE_DEAD_LINKS.has(rec.link) && !alwaysAlert) {
    return NextResponse.json({ ok: true, skipped: "web-only link" });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("expo_token, notif_prefs")
    .eq("enabled", true)
    .eq("user_id", rec.recipient_user_id);

  if (error) {
    console.error("[push/notify] tokens", error);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }

  // Utility/agency alerts respect the device's `utility` preference; every other
  // notification type is personal and always delivered.
  const isUtility = rec.type ? UTILITY_TYPES.has(rec.type) : false;
  const tokens = (rows ?? [])
    .filter((r) =>
      isUtility ? wantsCategory(r.notif_prefs as Record<string, unknown> | null, "utility") : true,
    )
    .map((r) => r.expo_token as string)
    .filter(Boolean);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // The recipient's current unread count, so the push carries an iOS app-icon
  // badge that's correct even when the app is fully closed. The just-inserted
  // row is already in the table when this webhook fires, so it's included. A
  // failed count simply omits the badge rather than blocking the push.
  const { count: unread } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", rec.recipient_user_id)
    .is("read_at", null);
  const badge = typeof unread === "number" ? unread : undefined;

  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title: rec.title as string,
    body: rec.body ?? "",
    data: mobileLink ? { link: mobileLink } : {},
    channelId: "default",
    ...(badge !== undefined ? { badge } : {}),
  }));

  const tickets = await sendExpoPush(messages);

  // Prune dead tokens.
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    const code = (t.details as { error?: string } | undefined)?.error;
    if (t.status === "error" && code === "DeviceNotRegistered") dead.push(tokens[i]);
  });
  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("expo_token", dead);
  }

  return NextResponse.json({ ok: true, sent: tokens.length, pruned: dead.length });
}
