// GET /api/cron/event-reminders
//
// HOURLY cron — driven by GitHub Actions (.github/workflows/event-reminders.yml),
// NOT Vercel Cron: the Hobby plan rejects sub-daily schedules, and an hourly entry
// in vercel.json silently blocks every deploy. The Action curls this endpoint with
// CRON_SECRET at the top of every hour. Pushes
// "Потсети ме" reminders to every opted-in device for events happening TODAY at
// their intended lead time, then stamps notified_at so a device is reminded
// exactly once.
//
// Reminder time per event = 11:00 Skopje, OR 3 hours before the start when the
// event begins before 11:00 (so an early event still gets a real heads-up). An
// all-day event (no parseable time) reminds at 11:00. Each hourly run fires
// every reminder whose time has now arrived and whose event hasn't started yet,
// which is why an hourly schedule is required: a once-daily run couldn't honour
// "min(11:00, start − 3h)" without dropping events on the wrong side of its
// single firing.
//
// Auth: the caller sends `Authorization: Bearer <CRON_SECRET>` (the GitHub Action,
// or a manual run). Required, so the endpoint can't be triggered by the public.

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { fetchCityEvents } from "@/lib/sanity/queries";
import { eventPath } from "@/lib/data/events";
import { sendExpoPush, type PushMessage } from "@/lib/push/expo";
import { isLive, loadPoll } from "@/lib/sanity/moviePoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_URL = "https://mojprilep.mk";
const TZ = "Europe/Skopje";

// How long after an event's start a reminder may still go out. GitHub Actions can
// run this sweep late or drop a run, so the reminder occasionally arrives after the
// start — delivering it a little late ("it's starting") beats the previous hard
// cutoff that killed the reminder forever the instant the start passed. Past this
// grace the event is clearly underway/over, so we stay silent rather than push
// something stale. All-day events have no start to pass and just fire same-day.
const LATE_GRACE_MIN = 60;

/** Local Europe/Skopje "now" as { date: "YYYY-MM-DD", minutes: sinceMidnight }. */
function skopjeNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // en-CA formats the date as YYYY-MM-DD.
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // "24" can appear at midnight in some engines — normalise to 0.
  const h = Number(get("hour")) % 24;
  const m = Number(get("minute"));
  return { date, minutes: h * 60 + m };
}

/** First "HH:MM" in a free-text time field → minutes since midnight, or null. */
function parseStartMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Push one reminder to every device that opted in for `subjectId` and has not
 * been notified yet, then stamp them so it never goes out twice.
 *
 * Shared by the events sweep and the cinema screening below: both store their
 * opt-ins in the same `event_reminders` table keyed by a Sanity document id, so
 * the only thing that differs is the copy and the link.
 */
async function pushReminder(
  admin: ReturnType<typeof createAdminClient>,
  subjectId: string,
  message: { title: string; body: string; link: string },
): Promise<{ sent: number; pruned: number }> {
  const { data: rows, error } = await admin
    .from("event_reminders")
    .select("id, expo_token")
    .eq("event_id", subjectId)
    .is("notified_at", null);
  if (error) {
    console.error("[cron/event-reminders] reminders", error);
    return { sent: 0, pruned: 0 };
  }
  const pending = (rows ?? []) as { id: number; expo_token: string }[];
  if (pending.length === 0) return { sent: 0, pruned: 0 };

  const messages: PushMessage[] = pending.map((r) => ({
    to: r.expo_token,
    title: message.title,
    body: message.body,
    data: { link: message.link, type: "event" },
    channelId: "default",
  }));

  const tickets = await sendExpoPush(messages);

  const dead: string[] = [];
  tickets.forEach((t, i) => {
    const code = (t.details as { error?: string } | undefined)?.error;
    if (t.status === "error" && code === "DeviceNotRegistered") dead.push(pending[i].expo_token);
  });

  // Stamp as sent so they're never re-reminded. Do this for all pending rows
  // (even the few that erred) — a stuck reminder retried tomorrow, after the
  // event has passed, is worse than one missed push, and dead tokens are
  // pruned below anyway.
  await admin
    .from("event_reminders")
    .update({ notified_at: new Date().toISOString() })
    .in("id", pending.map((r) => r.id));

  if (dead.length) {
    await admin.from("event_reminders").delete().in("expo_token", dead);
    await admin.from("push_subscriptions").delete().in("expo_token", dead);
  }

  return { sent: pending.length, pruned: dead.length };
}

/** The Europe/Skopje calendar day and wall-clock minute of an ISO instant. */
function skopjeAt(iso: string): { date: string; minutes: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = skopjeNow();
  const admin = createAdminClient();

  let events;
  try {
    events = await fetchCityEvents();
  } catch (e) {
    console.error("[cron/event-reminders] sanity", e);
    return NextResponse.json({ error: "Could not read events" }, { status: 500 });
  }

  // Only today's events can be "due" right now.
  const todays = events.filter((ev) => ev.startDate === now.date);

  let totalSent = 0;
  let totalPruned = 0;
  const processed: { event: string; sent: number }[] = [];

  for (const ev of todays) {
    const startMin = parseStartMinutes(ev.time);

    // Remind at 11:00, or 3h before the start when it begins before 11:00.
    // All-day events (no parseable time) remind at 11:00.
    const reminderMin =
      startMin !== null && startMin < 660 ? Math.max(0, startMin - 180) : 660;

    // Not yet time for this event's reminder — a later run will catch it.
    if (now.minutes < reminderMin) continue;

    // Deliver even if the start just passed (a late/dropped run), but stay silent
    // once the event is clearly underway — LATE_GRACE_MIN past its start.
    if (startMin !== null && now.minutes >= startMin + LATE_GRACE_MIN) continue;

    const link = `${BASE_URL}${eventPath(ev)}`;
    const whenBits = [ev.time, ev.location].filter(Boolean).join(" · ");
    const res = await pushReminder(admin, ev._id, {
      title: "Наскоро започнува 📅",
      body: whenBits ? `${ev.title} — ${whenBits}` : ev.title,
      link,
    });
    if (!res.sent) continue;

    totalSent += res.sent;
    totalPruned += res.pruned;
    processed.push({ event: ev._id, sent: res.sent });
  }

  // The Кино анкета screening. It is a `moviePoll` document rather than a city
  // event, so the sweep above never sees it — but people opt in from the poll
  // exactly the way they opt in from an event, into the same table, so it gets
  // the same one-a-day treatment here.
  try {
    const poll = await loadPoll(null);
    const at = poll?.screening_at ? skopjeAt(poll.screening_at) : null;
    const pollReminderMin =
      at && at.minutes < 660 ? Math.max(0, at.minutes - 180) : 660;
    if (
      poll &&
      isLive(poll) &&
      at &&
      at.date === now.date &&
      now.minutes >= pollReminderMin &&
      now.minutes < at.minutes + LATE_GRACE_MIN
    ) {
      const hh = String(Math.floor(at.minutes / 60)).padStart(2, "0");
      const mm = String(at.minutes % 60).padStart(2, "0");
      const res = await pushReminder(admin, poll.id, {
        title: "Денес е проекцијата 🎬",
        body: `${poll.title} — ${hh}:${mm}`,
        link: `${BASE_URL}/kino`,
      });
      totalSent += res.sent;
      totalPruned += res.pruned;
      if (res.sent) processed.push({ event: poll.id, sent: res.sent });
    }
  } catch (e) {
    // A failure here must not lose the events sweep's result.
    console.error("[cron/event-reminders] movie poll", e);
  }

  return NextResponse.json({ ok: true, sent: totalSent, pruned: totalPruned, events: processed });
}
