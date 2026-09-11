"use client";

/**
 * ЗборЧе leaderboard — the server side of the otherwise on-device game.
 *
 * A logged-in player's finished game is written once to `zborche_results`
 * (see supabase/add_zborche_leaderboard.sql). Anonymous players never write —
 * their stats stay purely local (see lib/zborche/stats). The public board is
 * read through the `zborche_leaderboard()` RPC, which returns only aggregates,
 * so anon and authenticated clients alike can read it without a service role.
 */

import { createClient } from "../supabase/client";
import { STATS_EVENT } from "./stats";

export type LeaderRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  played: number;
  wins: number;
  win_pct: number;
  avg_attempts: number | null;
  best_attempts: number | null;
  last_played: string | null;
};

/** One player's own finished board for a given day, read back from the server. */
export type TodayResult = {
  won: boolean;
  attempts: number | null;
  /** The guesses played, when the row was written with them; null for rows
   *  saved before the board was stored server-side. */
  guesses: string[] | null;
};

/**
 * Record one finished game on the server for the signed-in player. No-op for
 * logged-out players. Idempotent: the table's primary key is (user_id, date)
 * and there is no UPDATE policy, so a day's result is frozen once written —
 * `ignoreDuplicates` turns a replay into a silent no-op instead of an error.
 * The finished `guesses` are stored too, so the exact board can be restored on
 * any device (see fetchTodayResult). Best-effort: any failure is swallowed, the
 * local game is never affected. On a successful write it re-fires STATS_EVENT so
 * a mounted board refreshes.
 */
export async function syncResult(
  date: string,
  won: boolean,
  attempts: number,
  guesses: string[],
): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("zborche_results").upsert(
      {
        user_id: user.id,
        puzzle_date: date,
        won,
        attempts: won ? attempts : null,
        guesses,
      },
      { onConflict: "user_id,puzzle_date", ignoreDuplicates: true },
    );

    if (!error && typeof window !== "undefined") {
      window.dispatchEvent(new Event(STATS_EVENT));
    }
  } catch {
    // Leaderboard sync is best-effort — the local game and stats are unaffected.
  }
}

/**
 * The signed-in player's own result for one day, or null (logged out, no row,
 * or any error). This is what makes a finished day follow the player across
 * devices: whoever solved it on the phone reads the board back on the web.
 */
export async function fetchTodayResult(date: string): Promise<TodayResult | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("zborche_results")
      .select("won, attempts, guesses")
      .eq("user_id", user.id)
      .eq("puzzle_date", date)
      .maybeSingle();
    if (error || !data) return null;

    return {
      won: data.won,
      attempts: data.attempts ?? null,
      guesses: (data.guesses as string[] | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** The public board, ranked (wins, then fewest average guesses, then games). */
export async function fetchLeaderboard(limit = 20): Promise<LeaderRow[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("zborche_leaderboard", { p_limit: limit });
    if (error || !data) return [];
    return data as LeaderRow[];
  } catch {
    return [];
  }
}
