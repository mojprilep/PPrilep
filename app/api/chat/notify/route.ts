// POST /api/chat/notify
//
// Push for new group-chat messages. Called by a Supabase **Database Webhook**
// on INSERT into public.chat_messages (schema: supabase/add_chat.sql).
//
// Supabase Database Webhook setup (user, one-time):
//   Table: public.chat_messages · Events: INSERT · Type: HTTP Request
//   URL: https://www.mojprilep.mk/api/chat/notify
//   HTTP header:  x-webhook-secret: <CRON_SECRET>
//
// Chat messages deliberately do NOT become `notifications` rows: a busy group
// would bury the civic feed. They only push, and only to members who:
//   - aren't the sender, haven't muted the group, haven't blocked the sender;
//   - aren't already mid-burst — if the previous message in the group arrived
//     under THROTTLE_MS ago and the member hasn't read it yet, they already
//     have a banner for this conversation, so we don't stack another.

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { sendExpoPush, type PushMessage } from "../../../../lib/push/expo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THROTTLE_MS = 2 * 60_000;

type MessageRecord = {
  id?: number;
  group_id?: string;
  user_id?: string;
  body?: string | null;
  image_url?: string | null;
  created_at?: string;
};

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as { record?: MessageRecord };
  const rec = payload.record;
  if (!rec?.id || !rec.group_id || !rec.user_id) {
    return NextResponse.json({ ok: true, skipped: "bad record" });
  }

  const admin = createAdminClient();

  const [{ data: group }, { data: sender }, { data: prev }, { data: members }] = await Promise.all([
    admin.from("chat_groups").select("name").eq("id", rec.group_id).maybeSingle(),
    admin.from("profiles").select("full_name, username").eq("id", rec.user_id).maybeSingle(),
    admin
      .from("chat_messages")
      .select("created_at")
      .eq("group_id", rec.group_id)
      .lt("id", rec.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("chat_members")
      .select("user_id, last_read_at")
      .eq("group_id", rec.group_id)
      .eq("muted", false)
      .neq("user_id", rec.user_id),
  ]);

  if (!group || !members?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const prevAt = prev?.created_at ? new Date(prev.created_at as string).getTime() : 0;
  const now = rec.created_at ? new Date(rec.created_at).getTime() : Date.now();
  const burst = prevAt > 0 && now - prevAt < THROTTLE_MS;

  let recipients = members
    .filter((m) => !burst || new Date(m.last_read_at as string).getTime() >= prevAt)
    .map((m) => m.user_id as string);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "throttled" });
  }

  // Members who blocked the sender never hear from them.
  const { data: blocks } = await admin
    .from("chat_blocks")
    .select("blocker_id")
    .eq("blocked_id", rec.user_id)
    .in("blocker_id", recipients);
  const blockedBy = new Set((blocks ?? []).map((b) => b.blocker_id as string));
  recipients = recipients.filter((u) => !blockedBy.has(u));
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("expo_token")
    .eq("enabled", true)
    .in("user_id", recipients);
  if (error) {
    console.error("[chat/notify] tokens", error);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }
  const tokens = [...new Set((rows ?? []).map((r) => r.expo_token as string).filter(Boolean))];
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const name = sender?.full_name?.trim() || sender?.username || "Некој";
  const text = rec.body?.trim()
    ? rec.body.trim().slice(0, 160)
    : rec.image_url
      ? "📷 Фотографија"
      : "Нова порака";

  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title: group.name as string,
    body: `${name}: ${text}`,
    data: { link: `/chat/${rec.group_id}`, chatGroupId: rec.group_id },
    channelId: "default",
  }));

  const tickets = await sendExpoPush(messages);

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
