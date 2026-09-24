/**
 * Movie polls (Кино анкети) — suggest a film, vote for one.
 *
 * The poll is a Sanity `moviePoll` document; Supabase holds only the suggested
 * films and the votes (supabase/add_movie_polls.sql). Nothing here can create a
 * poll — that requires the Studio, which is the intended gate. Serves the
 * website (cookie session) and the app (Bearer), exactly like
 * /api/events/poll.
 *
 * Identity is hybrid for voting and strict for suggesting, which is the whole
 * product rule: a signed-out visitor votes with a client `visitorId`, but
 * adding a film to the list needs a real account — that is where the abuse
 * risk sits, not in the voting.
 *
 *   GET  ?pollId=…&visitorId=…   → { poll, options[], total, mine }
 *        (pollId omitted → the newest open poll)
 *   GET  ?pollId=…&shared=1      → same, minus anything personal (mine: null,
 *        own: false), CDN-cached 30s for everyone. Clients use it for viewers
 *        who are signed out and have not voted in this poll — most page views —
 *        and fall back to the personal GET for everyone else.
 *   POST { pollId, action: "vote"|"remove"|"suggest", optionId?, title?, visitorId }
 */

import { NextResponse } from "next/server";
import { getRequestUser } from "../../../lib/supabase/request-user";
import { createAdminClient } from "../../../lib/supabase/admin";
import { isLive, loadPoll } from "../../../lib/sanity/moviePoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same reasoning as the event poll: a vote must be visible to its own voter on
// the very next load, so nothing here is shared-cached.
const NO_STORE = { "Cache-Control": "no-store" };
// The shared (identity-free) view: other people's votes may lag by up to 30s.
const SHARED_CACHE = {
  "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
  "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
};

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Longest film title we will store — long enough for a subtitle, short enough
 * that the list stays readable and nobody pastes an essay.
 */
const MAX_TITLE = 90;
/**
 * The poll's options with their vote counts, plus which one belongs to the
 * caller. Counting in JS rather than SQL keeps this to two queries; the poll's
 * own maxSuggestions is what keeps the list short.
 */
async function stateFor(
  admin: Admin,
  pollId: string,
  actor: { userId?: string; visitorId?: string },
) {
  const [optionsRes, votesRes] = await Promise.all([
    admin
      .from("movie_poll_options")
      .select("id, title, created_at, created_by")
      .eq("poll_id", pollId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true }),
    admin
      .from("movie_poll_votes")
      .select("option_id, user_id, visitor_id")
      .eq("poll_id", pollId),
  ]);

  const votes = (votesRes.data ?? []) as {
    option_id: number;
    user_id: string | null;
    visitor_id: string | null;
  }[];

  const counts = new Map<number, number>();
  let mine: number | null = null;
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
    // The signed-in identity wins: someone who voted anonymously and then
    // logged in should see the vote their account holds.
    if (actor.userId && v.user_id === actor.userId) mine = v.option_id;
    else if (!actor.userId && actor.visitorId && v.visitor_id === actor.visitorId) {
      mine = v.option_id;
    }
  }

  const options = (
    (optionsRes.data ?? []) as { id: number; title: string; created_by: string | null }[]
  )
    .map((o) => ({
      id: o.id,
      title: o.title,
      votes: counts.get(o.id) ?? 0,
      // Whether the caller added this film, so the UI can offer edit/delete
      // without a second request. Never true for a signed-out visitor:
      // suggestions always carry an account.
      own: !!actor.userId && o.created_by === actor.userId,
    }))
    // Most votes first. Ties keep insertion order, so a brand-new film sits at
    // the bottom instead of jumping around as votes trickle in.
    .sort((a, b) => b.votes - a.votes);

  return { options, total: votes.length, mine };
}

const EMPTY = { poll: null, options: [], total: 0, mine: null };

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // A Sanity document id — an opaque string, not a number.
  const pollId = params.get("pollId")?.trim().slice(0, 100) || null;
  const visitorId = params.get("visitorId")?.trim().slice(0, 100) || undefined;
  const shared = params.get("shared") === "1";

  try {
    const admin = createAdminClient();
    // Shared mode never looks at who is asking, so one cached copy fits all.
    const user = shared ? null : await getRequestUser(req);
    const poll = await loadPoll(pollId);
    if (!poll) {
      return NextResponse.json(EMPTY, { headers: shared ? SHARED_CACHE : NO_STORE });
    }

    const state = await stateFor(
      admin,
      poll.id,
      shared ? {} : { userId: user?.id, visitorId },
    );
    return NextResponse.json(
      { poll: { ...poll, live: isLive(poll) }, ...state },
      { headers: shared ? SHARED_CACHE : NO_STORE },
    );
  } catch (err) {
    console.error("[movie-poll] GET failed", err);
    return NextResponse.json(EMPTY, { headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  let body: {
    pollId?: unknown;
    action?: unknown;
    optionId?: unknown;
    title?: unknown;
    visitorId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const pollId = typeof body.pollId === "string" ? body.pollId.trim().slice(0, 100) : "";
  const ACTIONS = ["vote", "remove", "suggest", "edit", "delete"] as const;
  const action = (ACTIONS as readonly string[]).includes(body.action as string)
    ? (body.action as (typeof ACTIONS)[number])
    : "vote";
  const optionId = Number(body.optionId);
  const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim().slice(0, 100) : "";

  if (!pollId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const user = await getRequestUser(req);
  if (!user && !visitorId) {
    return NextResponse.json({ error: "No identity" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const poll = await loadPoll(pollId);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isLive(poll)) {
      return NextResponse.json({ error: "Анкетата е затворена." }, { status: 409 });
    }

    if (action === "suggest") {
      // The one place an account is required.
      if (!user) {
        return NextResponse.json({ error: "Најавете се за да предложите филм." }, { status: 401 });
      }
      if (!poll.allow_suggestions) {
        return NextResponse.json({ error: "Листата е затворена за нови предлози." }, { status: 409 });
      }
      if (title.length < 2 || title.length > MAX_TITLE) {
        return NextResponse.json({ error: "Внесете име на филм." }, { status: 400 });
      }

      // Two ceilings from the Studio document: how long the list may get, and
      // how much of it one person may be responsible for. Both are counted
      // including hidden rows — a moderated suggestion should not hand its
      // author a fresh slot to repeat it with.
      const [{ count: total }, { count: byUser }] = await Promise.all([
        admin
          .from("movie_poll_options")
          .select("id", { count: "exact", head: true })
          .eq("poll_id", pollId),
        admin
          .from("movie_poll_options")
          .select("id", { count: "exact", head: true })
          .eq("poll_id", pollId)
          .eq("created_by", user.id),
      ]);
      if ((total ?? 0) >= poll.max_suggestions) {
        return NextResponse.json({ error: "Листата е полна." }, { status: 409 });
      }
      if ((byUser ?? 0) >= poll.max_per_user) {
        return NextResponse.json(
          {
            error: `Може да предложите најмногу ${poll.max_per_user} ${
              poll.max_per_user === 1 ? "филм" : "филма"
            }.`,
          },
          { status: 409 },
        );
      }

      const { data: created, error } = await admin
        .from("movie_poll_options")
        .insert({ poll_id: pollId, title, created_by: user.id })
        .select("id")
        .single();

      let newOptionId = (created?.id as number | undefined) ?? undefined;
      if (error) {
        // 23505 = this film is already on the list (the norm_title index). That
        // is not a failure from the user's point of view — find the row they
        // collided with and vote for it, which is what they meant to do.
        if (error.code !== "23505") throw error;
        const { data: existing } = await admin
          .from("movie_poll_options")
          .select("id")
          .eq("poll_id", pollId)
          .eq("is_hidden", false)
          .ilike("title", title)
          .maybeSingle();
        newOptionId = (existing?.id as number | undefined) ?? undefined;
      }

      // Suggesting a film counts as voting for it: nobody proposes a film they
      // would not want to watch, and making them tap twice reads as a bug. Only
      // when they hold no vote yet, though — with maxPerUser above 1, a second
      // suggestion would otherwise silently move the vote off their first pick.
      const before = await stateFor(admin, pollId, { userId: user.id, visitorId });
      if (newOptionId && before.mine === null) {
        await castVote(admin, pollId, newOptionId, user.id, visitorId);
      }

      const state = await stateFor(admin, pollId, { userId: user.id, visitorId });
      return NextResponse.json({ pollId, ...state }, { headers: NO_STORE });
    }

    if (action === "edit" || action === "delete") {
      if (!user) {
        return NextResponse.json({ error: "Најавете се." }, { status: 401 });
      }
      if (!Number.isInteger(optionId) || optionId <= 0) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
      }

      const { data: own } = await admin
        .from("movie_poll_options")
        .select("id, created_by")
        .eq("id", optionId)
        .eq("poll_id", pollId)
        .maybeSingle();
      if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (own.created_by !== user.id) {
        return NextResponse.json(
          { error: "Може да го смените само вашиот предлог." },
          { status: 403 },
        );
      }

      // Once other people have backed a film, its author no longer owns it
      // alone: renaming it would change what they voted for, and deleting it
      // would throw their votes away. Their own vote does not count as such.
      const { data: otherVotes } = await admin
        .from("movie_poll_votes")
        .select("id")
        .eq("option_id", optionId)
        // `neq` alone would drop the anonymous rows: in SQL `null <> value` is
        // null, not true, so visitor votes would silently not count as "other
        // people".
        .or(`user_id.is.null,user_id.neq.${user.id}`)
        .limit(1);
      if ((otherVotes?.length ?? 0) > 0) {
        return NextResponse.json(
          { error: "Веќе гласале други за овој филм, па не може да се менува." },
          { status: 409 },
        );
      }

      if (action === "delete") {
        // The votes on it go with it — the cascade in the schema.
        const { error } = await admin.from("movie_poll_options").delete().eq("id", optionId);
        if (error) throw error;
      } else {
        if (title.length < 2 || title.length > MAX_TITLE) {
          return NextResponse.json({ error: "Внесете име на филм." }, { status: 400 });
        }
        const { error } = await admin
          .from("movie_poll_options")
          .update({ title })
          .eq("id", optionId);
        if (error) {
          if (error.code !== "23505") throw error;
          return NextResponse.json(
            { error: "Тој филм е веќе на листата." },
            { status: 409 },
          );
        }
      }

      const state = await stateFor(admin, pollId, { userId: user.id, visitorId });
      return NextResponse.json({ pollId, ...state }, { headers: NO_STORE });
    }

    if (action === "vote") {
      if (!Number.isInteger(optionId) || optionId <= 0) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
      }
      // Confirm the option belongs to this poll — otherwise a crafted request
      // could park a vote for one poll on another poll's option.
      const { data: opt } = await admin
        .from("movie_poll_options")
        .select("id")
        .eq("id", optionId)
        .eq("poll_id", pollId)
        .eq("is_hidden", false)
        .maybeSingle();
      if (!opt) return NextResponse.json({ error: "Not found" }, { status: 404 });

      await castVote(admin, pollId, optionId, user?.id ?? null, visitorId);
    } else {
      await clearVote(admin, pollId, user?.id ?? null, visitorId);
    }

    const state = await stateFor(admin, pollId, { userId: user?.id, visitorId });
    return NextResponse.json({ pollId, ...state }, { headers: NO_STORE });
  } catch (err) {
    // Logged, not returned: the caller gets a generic message, but a 500 with
    // no trace anywhere is undiagnosable — which is exactly what a bigint/text
    // mismatch on poll_id looked like.
    console.error("[movie-poll] POST failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Drop whichever rows this actor holds on the poll. Both identities are cleared
 * so a visitor who signs in mid-poll cannot end up counted twice.
 */
async function clearVote(
  admin: Admin,
  pollId: string,
  userId: string | null,
  visitorId: string,
) {
  if (userId) {
    await admin.from("movie_poll_votes").delete().eq("poll_id", pollId).eq("user_id", userId);
  }
  if (visitorId) {
    await admin.from("movie_poll_votes").delete().eq("poll_id", pollId).eq("visitor_id", visitorId);
  }
}

/** Single-choice: clear first, then insert. */
async function castVote(
  admin: Admin,
  pollId: string,
  optionId: number,
  userId: string | null,
  visitorId: string,
) {
  await clearVote(admin, pollId, userId, visitorId);
  const row = userId
    ? { poll_id: pollId, option_id: optionId, user_id: userId }
    : { poll_id: pollId, option_id: optionId, visitor_id: visitorId };
  const { error } = await admin.from("movie_poll_votes").insert(row);
  // A racing double-tap trips the unique index; the row it kept is this same
  // actor on this same poll, so the end state is already correct.
  if (error && error.code !== "23505") throw error;
}
