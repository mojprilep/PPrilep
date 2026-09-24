/**
 * ЗборЧе — today's puzzle.
 *
 * Returns only the word scheduled for the current day (Prilep time), so the
 * future schedule stays in the Studio. No Supabase and nothing to write: the
 * game is entirely client-side, this route just hands out the day's word.
 *
 * Same response for everyone, so the CDN shares it — but never past Skopje
 * midnight (the word flips there), and at most 5 min so a Studio fix to the
 * day's word shows up quickly. No stale-while-revalidate: that could hand out
 * yesterday's answer just after the boundary.
 *
 *   GET → { date, id, word, hint, explanation, length }   (word null when none scheduled)
 */

import { NextResponse } from "next/server";
import { fetchDailyWord, skopjeToday } from "../../../lib/sanity/zborche";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TTL_S = 300;

/** Seconds until the next Europe/Skopje midnight (DST-correct). */
function secondsToSkopjeMidnight(d = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Skopje",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return 86400 - ((get("hour") % 24) * 3600 + get("minute") * 60 + get("second"));
}

function cacheHeaders(): Record<string, string> {
  const ttl = Math.min(MAX_TTL_S, secondsToSkopjeMidnight());
  // Too close to midnight to be worth caching — just serve it fresh.
  if (ttl < 5) return { "Cache-Control": "no-store" };
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${ttl}`,
    "CDN-Cache-Control": `public, s-maxage=${ttl}`,
  };
}

export async function GET() {
  const puzzle = await fetchDailyWord();
  if (!puzzle) {
    // Not cached: a word published late should appear on the very next load.
    return NextResponse.json(
      { date: skopjeToday(), word: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      date: puzzle.date,
      id: puzzle.id,
      word: puzzle.word,
      hint: puzzle.hint,
      explanation: puzzle.explanation,
      length: puzzle.length,
    },
    { headers: cacheHeaders() },
  );
}
