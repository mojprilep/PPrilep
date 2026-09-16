/**
 * "Нов настан" broadcast — one push to every registered device when a city
 * event is first published.
 *
 * Lives here rather than inside a route because it has TWO callers: the
 * dedicated /api/push/event webhook, and /api/revalidate — which is where it
 * actually runs today, since the Sanity plan only includes two webhooks and
 * both slots are taken. Folding it into the revalidate hook costs nothing: that
 * hook already fires on publish of exactly the document type we care about.
 *
 * Safe to call on every content change. It filters drafts, non-events, events
 * that already ended, and — via the unique `event_id` claim in push_broadcasts
 * — anything already announced, so an edit never re-notifies the city.
 */
import { fetchEventFresh } from "@/lib/sanity/queries";
import { eventPath } from "@/lib/data/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendExpoPush, type PushMessage } from "@/lib/push/expo";
import { tokensFor } from "@/lib/push/prefs";

const BASE_URL = "https://mojprilep.mk";

export type BroadcastResult =
  | { ok: true; sent: number; pruned: number }
  | { skipped: string }
  | { error: string };

export async function broadcastNewEvent(id: string | undefined): Promise<BroadcastResult> {
  if (!id || id.startsWith("drafts.")) return { skipped: "not a published event" };

  const ev = await fetchEventFresh(id);
  if (!ev) return { skipped: "event not found" };

  // Don't announce events that already ended.
  const today = new Date().toISOString().slice(0, 10);
  if ((ev.endDate ?? ev.startDate) < today) return { skipped: "event is in the past" };

  const admin = createAdminClient();

  // Claim the event — unique event_id is our once-only lock.
  const { error: claimErr } = await admin.from("push_broadcasts").insert({ event_id: ev._id });
  if (claimErr) {
    if (claimErr.code === "23505") return { skipped: "already broadcast" };
    console.error("[push/newEvent] claim", claimErr);
    return { error: "claim failed" };
  }

  // Fan out to every enabled device that hasn't muted city-event pushes.
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("expo_token, notif_prefs")
    .eq("enabled", true);
  if (error) {
    console.error("[push/newEvent] tokens", error);
    return { error: "Could not read subscriptions" };
  }

  const tokens = tokensFor(rows, "events");
  if (tokens.length === 0) return { ok: true, sent: 0, pruned: 0 };

  const link = `${BASE_URL}${eventPath(ev)}`;
  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title: "Нов настан во Прилеп 📅",
    body: ev.location ? `${ev.title} · ${ev.location}` : ev.title,
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

  return { ok: true, sent: tokens.length, pruned: dead.length };
}
