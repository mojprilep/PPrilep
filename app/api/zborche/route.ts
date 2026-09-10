/**
 * ЗборЧе — today's puzzle.
 *
 * Returns only the word scheduled for the current day (Prilep time), so the
 * future schedule stays in the Studio. No Supabase and nothing to write: the
 * game is entirely client-side, this route just hands out the day's word.
 *
 * force-dynamic + no-store: the word flips at local midnight, and a shared cache
 * could serve yesterday's answer past the boundary.
 *
 *   GET → { date, id, word, hint, length }   (word null when none scheduled)
 */

import { NextResponse } from "next/server";
import { fetchDailyWord, skopjeToday } from "../../../lib/sanity/zborche";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const puzzle = await fetchDailyWord();
  if (!puzzle) {
    return NextResponse.json(
      { date: skopjeToday(), word: null },
      { headers: NO_STORE },
    );
  }
  return NextResponse.json(
    {
      date: puzzle.date,
      id: puzzle.id,
      word: puzzle.word,
      hint: puzzle.hint,
      length: puzzle.length,
    },
    { headers: NO_STORE },
  );
}
