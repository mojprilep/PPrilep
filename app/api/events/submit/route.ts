/**
 * POST /api/events/submit
 *
 * Citizen event submissions go straight to Sanity as UNPUBLISHED drafts
 * (isSubmission: true). Editors review + publish from the
 * "📥 Настани за преглед" queue in Studio.
 *
 * Submissions are ALWAYS created with autoPost: false — a citizen can never
 * trigger an automatic Facebook/Instagram broadcast; the editor decides that
 * deliberately when publishing.
 *
 * Requires SANITY_WRITE_TOKEN with content-create permission (same token the
 * Позитива submission route uses).
 */

import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { getRequestUser } from "../../../../lib/supabase/request-user";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { slugify } from "../../../../lib/utils";

const PROJECT_ID  = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const DATASET     = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const WRITE_TOKEN = process.env.SANITY_WRITE_TOKEN;

function getSanityClient() {
  return createClient({
    projectId:  PROJECT_ID,
    dataset:    DATASET,
    apiVersion: "2024-01-01",
    useCdn:     false,
    token:      WRITE_TOKEN,
  });
}

// Valid event categories (must match sanity/schemas/cityEvent.ts).
const CATEGORIES = new Set([
  "concert", "festival", "sport", "exhibition", "theatre", "cinema", "family", "other",
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Abuse guards ──────────────────────────────────────────────────────────────
const MAX_TITLE     = 140;
const MAX_DESC      = 2000;
const MAX_FIELD     = 200;
const MAX_IMG_BYTES = 8 * 1024 * 1024; // 8 MB

// Durable per-user cap: how many of this user's submissions may sit unreviewed
// (still drafts) at once — enforced against Sanity itself so it survives
// serverless instance churn (see /api/positive/submit for the rationale).
const MAX_PENDING_DRAFTS = 5;

// Best-effort in-memory rate limit (per server instance).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 3;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now    = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_MAX;
}

// Ping every admin (profiles.is_admin) with a free in-app notification so they
// know a new event is waiting in the Studio review queue. Uses the service-role
// client (bypasses RLS to write notifications for another recipient).
async function notifyAdmins(actorUserId: string, title: string) {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  if (!admins?.length) return;
  // Insert directly (not via createNotification, which skips recipient===actor):
  // this is a review-queue alert, so admins should be notified about ANY new
  // submission — including one an admin sends through the form themselves.
  const rows = admins.map((a: { id: string }) => ({
    recipient_user_id: a.id,
    actor_user_id: actorUserId,
    type: "event_submission",
    title,
    body: "пријави нов настан за преглед",
    link: "/studio",
  }));
  const { error } = await admin.from("notifications").insert(rows);
  if (error) console.error("[events/submit] notify insert", error.message);
}

export async function POST(req: Request) {
  try {
    if (!WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Серверот не е конфигуриран. Контактирај не на mojpprilep@gmail.com." },
        { status: 503 },
      );
    }

    // ── Require an authenticated user (web cookie OR mobile Bearer token) ──────
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Мора да сте најавени за да пријавите настан." },
        { status: 401 },
      );
    }

    // ── Rate limit per authenticated user (best-effort, in-memory) ────────────
    if (rateLimited(user.id)) {
      return NextResponse.json(
        { error: "Премногу пораки. Почекај една минута и обиди се повторно." },
        { status: 429 },
      );
    }

    const sanity = getSanityClient();

    // ── Durable cap: too many of this user's events still awaiting review? ────
    try {
      const pending: number = await sanity.fetch(
        `count(*[_type == "cityEvent" && submittedBy.userId == $uid && isSubmission == true && reviewed != true && _id in path("drafts.**")])`,
        { uid: user.id },
      );
      if (typeof pending === "number" && pending >= MAX_PENDING_DRAFTS) {
        return NextResponse.json(
          {
            error:
              "Имаш премногу настани кои чекаат преглед. Почекај да бидат одобрени пред да пратиш нов.",
          },
          { status: 429 },
        );
      }
    } catch {
      // If the count query fails, don't block a legitimate submission — the
      // per-user rate limit above still applies.
    }

    const form = await req.formData();

    // Honeypot — real users never fill this. Bots do. Silently succeed.
    if ((form.get("website") as string)?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const title          = (form.get("title")          as string)?.trim().slice(0, MAX_TITLE);
    const categoryRaw    = (form.get("category")        as string)?.trim() || "other";
    const category       = CATEGORIES.has(categoryRaw) ? categoryRaw : "other";
    const startDate      = (form.get("startDate")       as string)?.trim();
    const endDateRaw     = (form.get("endDate")         as string)?.trim();
    const timeRaw        = (form.get("time")            as string)?.trim().slice(0, 20) || null;
    const location       = (form.get("location")        as string)?.trim().slice(0, MAX_FIELD);
    const description     = (form.get("description")     as string)?.trim().slice(0, MAX_DESC) || null;
    const sourceUrl      = (form.get("sourceUrl")       as string)?.trim().slice(0, 500) || null;
    const submitterName  = (form.get("submitterName")   as string)?.trim().slice(0, MAX_FIELD) || null;
    const submitterEmail = (form.get("submitterEmail")  as string)?.trim().slice(0, MAX_FIELD) || null;
    const phone          = (form.get("phone")           as string)?.trim().slice(0, 40) || null;

    if (!title || !startDate || !location) {
      return NextResponse.json(
        { error: "Наслов, датум и локација се задолжителни." },
        { status: 400 },
      );
    }
    if (!DATE_RE.test(startDate)) {
      return NextResponse.json({ error: "Неважечки датум." }, { status: 400 });
    }
    // Only keep endDate if it's a valid, later-or-equal date.
    const endDate =
      endDateRaw && DATE_RE.test(endDateRaw) && endDateRaw >= startDate ? endDateRaw : null;

    // ── Upload the optional cover image to Sanity Assets ──────────────────────
    let coverImageRef:
      | { _type: "image"; asset: { _type: "reference"; _ref: string }; alt: string }
      | undefined;

    const file = form.get("image") as File | null;
    if (file && file.size > 0) {
      if (file.size > MAX_IMG_BYTES) {
        return NextResponse.json(
          { error: "Сликата смее да биде најмногу 8 MB." },
          { status: 413 },
        );
      }
      if (file.type.startsWith("image/")) {
        const buffer   = Buffer.from(await file.arrayBuffer());
        const uploaded = await sanity.assets.upload("image", buffer, {
          filename:    file.name,
          contentType: file.type || "image/jpeg",
        });
        coverImageRef = {
          _type: "image",
          asset: { _type: "reference", _ref: uploaded._id },
          alt:   title,
        };
      }
    }

    const doc = {
      _type:        "cityEvent",
      title,
      slug:         { _type: "slug", current: `${slugify(title) || "nastan"}-${Date.now().toString(36).slice(-4)}` },
      category,
      startDate,
      location,
      autoPost:     false,   // citizen submissions never auto-broadcast
      isSubmission: true,
      reviewed:     false,
      ...(endDate       && { endDate }),
      ...(timeRaw       && { time: timeRaw }),
      ...(description   && { description }),
      ...(sourceUrl     && { sourceUrl }),
      ...(coverImageRef && { coverImage: coverImageRef }),
      submittedBy: {
        name:   submitterName  ?? user.user_metadata?.full_name ?? "",
        email:  submitterEmail ?? user.email ?? "",
        phone:  phone ?? "",
        userId: user.id,
      },
    };

    // Create as a DRAFT — never goes public until an editor publishes it.
    const created = await sanity.create({ ...doc, _id: `drafts.${crypto.randomUUID()}` });

    // Notify every admin IN-APP (free, unlike Resend). Fire-and-forget: the draft
    // is already saved, so a notification failure must never fail the submission.
    notifyAdmins(user.id, title).catch((e) =>
      console.error("[events/submit] notify failed", e),
    );

    return NextResponse.json({ ok: true, id: created._id });
  } catch (err) {
    console.error("[events/submit]", err);
    return NextResponse.json(
      { error: "Не можеме да го зачуваме настанот во моментов. Обиди се повторно подоцна." },
      { status: 500 },
    );
  }
}
