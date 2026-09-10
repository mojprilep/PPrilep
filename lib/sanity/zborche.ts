/**
 * ЗборЧе — today's puzzle, read from Sanity.
 *
 * The word for a given day is a `zborche` document authored in the Studio. This
 * is the ONLY place a word is chosen, and only today's is ever exposed to a
 * client (through /api/zborche), so the future schedule stays private. No
 * Supabase, no votes — a player's progress lives on their own device.
 */

import { sanityClient } from "./client";

export type DailyWord = {
  /** Sanity document _id, so the client can key its per-day storage stably. */
  id: string;
  /** The day this word is live, "YYYY-MM-DD" in Prilep's timezone. */
  date: string;
  /** Uppercase Macedonian Cyrillic. */
  word: string;
  hint: string | null;
  length: number;
};

type SanityZborche = {
  _id: string;
  word: string;
  date: string;
  hint?: string;
};

/**
 * Today's date in Prilep, as "YYYY-MM-DD". The server may run in any timezone;
 * en-CA formats as ISO date, and Europe/Skopje pins the day boundary to local
 * midnight so the word flips at midnight in Prilep, not UTC.
 */
export function skopjeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * The puzzle scheduled for today, or null when nothing is set for the day.
 * Exact date match on purpose: a gap in the schedule is a real "no word today"
 * rather than silently replaying an old one (which would also let people who
 * already solved it see the answer again).
 */
export async function fetchDailyWord(): Promise<DailyWord | null> {
  try {
    const today = skopjeToday();
    const doc = await sanityClient.fetch<SanityZborche | null>(
      `*[_type == "zborche" && date == $today][0]{_id, word, date, hint}`,
      { today },
    );
    if (!doc?.word) return null;
    const word = doc.word.trim().toUpperCase();
    return {
      id: doc._id,
      date: doc.date,
      word,
      hint: doc.hint?.trim() || null,
      length: word.length,
    };
  } catch {
    return null;
  }
}
