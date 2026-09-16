/**
 * Follower push — one notification to every follower of a club when that club
 * publishes a new post.
 *
 * The twin of broadcastNewEvent, but addressed rather than broadcast: instead of
 * every device, it fans out only to the devices of the users in `club_followers`
 * for this post's club. Runs from /api/revalidate on publish of a `sportPost`
 * (the Sanity plan's two webhook slots are both taken, so the revalidate hook is
 * where sport pushes live too).
 *
 * Idempotent: the post's id is claimed once in push_broadcasts (namespaced
 * `sportPost:<_id>` so it never collides with an event's bare id), so every later
 * edit of the same post is a no-op and nobody is notified twice.
 *
 * Deliberately does NOT insert into `notifications`: that table has a webhook
 * that would push a second time. This is a direct push, like the event broadcast.
 */
import { fetchSportPostFresh } from "@/lib/sanity/sport";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendExpoPush, type PushMessage } from "@/lib/push/expo";
import { tokensFor } from "@/lib/push/prefs";

const BASE_URL = "https://mojprilep.mk";

export type SportPostBroadcastResult =
  | { ok: true; sent: number; pruned: number }
  | { skipped: string }
  | { error: string };

export async function broadcastNewSportPost(
  id: string | undefined,
): Promise<SportPostBroadcastResult> {
  if (!id || id.startsWith("drafts.")) return { skipped: "not a published post" };

  const post = await fetchSportPostFresh(id);
  if (!post) return { skipped: "post not found" };
  if (!post.clubSlug) return { skipped: "post has no club" };

  // Scheduled posts publish with a future publishedAt; only announce once they
  // are actually live, matching the site's own `publishedAt <= now()` gate.
  if (post.publishedAt && post.publishedAt > new Date().toISOString()) {
    return { skipped: "post is scheduled" };
  }

  const admin = createAdminClient();

  // Claim the post — a namespaced id so it shares push_broadcasts with events
  // without ever colliding with an event's bare _id.
  const claimId = `sportPost:${post._id}`;
  const { error: claimErr } = await admin
    .from("push_broadcasts")
    .insert({ event_id: claimId });
  if (claimErr) {
    if (claimErr.code === "23505") return { skipped: "already broadcast" };
    console.error("[push/sportPost] claim", claimErr);
    return { error: "claim failed" };
  }

  // Who follows this club?
  const { data: follows, error: followErr } = await admin
    .from("club_followers")
    .select("user_id")
    .eq("club_slug", post.clubSlug);
  if (followErr) {
    console.error("[push/sportPost] followers", followErr);
    return { error: "Could not read followers" };
  }
  const userIds = [...new Set((follows ?? []).map((r) => r.user_id as string))].filter(Boolean);
  if (userIds.length === 0) return { ok: true, sent: 0, pruned: 0 };

  // Their enabled devices that haven't muted sport pushes.
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("expo_token, notif_prefs")
    .eq("enabled", true)
    .in("user_id", userIds);
  if (error) {
    console.error("[push/sportPost] tokens", error);
    return { error: "Could not read subscriptions" };
  }

  const tokens = tokensFor(rows, "sport");
  if (tokens.length === 0) return { ok: true, sent: 0, pruned: 0 };

  const link = `${BASE_URL}/sport/${post.clubSlug}`;
  const title = post.clubName ? `${post.clubName} 📣` : "Нова објава";
  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title,
    body: post.title,
    data: { link, type: "sportPost" },
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
