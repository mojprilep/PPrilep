// POST /api/chat/notify
//
// Push for new group-chat messages. Two callers:
//   - the app, right after it sends a message: `Authorization: Bearer <user JWT>`
//     + `{ messageId }`. Only the message's own author, only within a few
//     minutes of sending. This is the live path (since 2026-10-13).
//   - a Supabase Database Webhook (`x-webhook-secret: <CRON_SECRET>` +
//     `{ record }`). It was never firing in prod; DON'T create one now, or every
//     message pushes twice.
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
import { tokensFor } from "../../../../lib/push/prefs";
import { getRequestUser } from "../../../../lib/supabase/request-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THROTTLE_MS = 2 * 60_000;
// The app only asks for a push right after sending; older ids are replays.
const APP_TRIGGER_MAX_AGE_MS = 5 * 60_000;

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
  const provided = req.headers.get("x-webhook-secret");
  const body = (await req.json().catch(() => ({}))) as {
    record?: MessageRecord;
    messageId?: number;
  };
  const admin = createAdminClient();

  let rec: MessageRecord | undefined;
  if (secret && provided === secret) {
    rec = body.record;
  } else {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (typeof body.messageId !== "number") {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }
    const { data } = await admin
      .from("chat_messages")
      .select("id, group_id, user_id, body, image_url, created_at")
      .eq("id", body.messageId)
      .maybeSingle();
    if (!data || data.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (Date.now() - new Date(data.created_at as string).getTime() > APP_TRIGGER_MAX_AGE_MS) {
      return NextResponse.json({ ok: true, skipped: "stale" });
    }
    rec = data as MessageRecord;
  }

  if (!rec?.id || !rec.group_id || !rec.user_id) {
    return NextResponse.json({ ok: true, skipped: "bad record" });
  }

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
    .select("expo_token, notif_prefs")
    .eq("enabled", true)
    .in("user_id", recipients);
  if (error) {
    console.error("[chat/notify] tokens", error);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }
  // Devices that switched off "Муабети" in the app's notification panel.
  const tokens = [...new Set(tokensFor(rows, "chat"))];
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
