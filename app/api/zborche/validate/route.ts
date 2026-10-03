/**
 * ЗборЧе — dictionary for guess validation.
 *
 * Returns every valid Macedonian word of a given length (uppercase Cyrillic), so
 * a client can reject non-words. The game is otherwise offline: the client
 * fetches this ONCE per puzzle length, caches it, and checks each guess locally —
 * there is no per-guess round-trip.
 *
 * The list depends only on `len` (a handful of values), never on the request or
 * any DB, so it is aggressively CDN-cached: after the first warm request Vercel
 * serves it from the edge, so this is effectively free and never touches Supabase.
 *
 *   GET /api/zborche/validate?len=6 → { len, count, words: string[] }
 *
 * Source: whoeverest/macedonian-words (MK-dict.txt), filtered to 4–7 letters and
 * uppercased at build time into lib/zborche/words/w<len>.json.
 */
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

const MIN_LEN = 4;
const MAX_LEN = 7;

// Parsed lists are cached per length for the lifetime of the (warm) function.
const cache = new Map<number, string[]>();

const WORDS_DIR = join(process.cwd(), "lib", "zborche", "words");

function wordsForLength(len: number): string[] {
  const hit = cache.get(len);
  if (hit) return hit;
  const base = JSON.parse(readFileSync(join(WORDS_DIR, `w${len}.json`), "utf8")) as string[];
  // extra.json: real words the source dictionary lacks (mostly puzzle answers,
  // e.g. ЗЕЛНИК) — add to it whenever a scheduled answer isn't in w<len>.json.
  const extra = (JSON.parse(readFileSync(join(WORDS_DIR, "extra.json"), "utf8")) as string[])
    .map((w) => w.toUpperCase())
    .filter((w) => [...w].length === len);
  const list = [...new Set([...base, ...extra])];
  cache.set(len, list);
  return list;
}

export async function GET(request: Request) {
  const len = Number(new URL(request.url).searchParams.get("len"));

  if (!Number.isInteger(len) || len < MIN_LEN || len > MAX_LEN) {
    // Unknown length → empty list. The client falls back to length-only checks,
    // so the game stays playable rather than blocking every guess.
    return NextResponse.json(
      { len, count: 0, words: [] as string[] },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  const words = wordsForLength(len);
  return NextResponse.json(
    { len, count: words.length, words },
    {
      headers: {
        // Changes only on deploy (extra.json): a day at the edge, refresh in the background.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    },
  );
}
