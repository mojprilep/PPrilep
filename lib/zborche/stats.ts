/**
 * ЗборЧе — on-device play statistics (the "scoreboard"), web edition.
 *
 * Mirrors the mobile app's lib/zborcheStats.ts: everything lives in
 * localStorage, per browser, nothing hits the backend. One result is counted
 * per date (guarded by `recorded`) so reloading a finished day never double-
 * counts. A later Supabase leaderboard can layer on top of this for logged-in
 * users without changing the local numbers.
 *
 * Writing stats dispatches a `STATS_EVENT` on window so a panel rendered in a
 * separate React tree (the right column, injected via RightPanelContext) can
 * refresh immediately — the native `storage` event only fires in *other* tabs.
 */

const KEY = "zborche:stats";

/** Fired on window whenever the stats change in this tab. */
export const STATS_EVENT = "zborche:stats-changed";

export type Stats = {
  played: number;
  wins: number;
  curStreak: number;
  maxStreak: number;
  /** attempts (1..N) -> number of wins in that many guesses */
  dist: Record<number, number>;
  /** date (YYYY-MM-DD) -> already counted */
  recorded: Record<string, boolean>;
};

export function emptyStats(): Stats {
  return { played: 0, wins: 0, curStreak: 0, maxStreak: 0, dist: {}, recorded: {} };
}

export function loadStats(): Stats {
  if (typeof window === "undefined") return emptyStats();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw);
    return { ...emptyStats(), ...p, dist: p?.dist ?? {}, recorded: p?.recorded ?? {} };
  } catch {
    return emptyStats();
  }
}

/** Fold one finished game into the stats. Idempotent per date. */
export function recordResult(date: string, won: boolean, attempts: number): Stats {
  const s = loadStats();
  if (s.recorded[date]) return s;
  s.recorded[date] = true;
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.curStreak += 1;
    if (s.curStreak > s.maxStreak) s.maxStreak = s.curStreak;
    s.dist[attempts] = (s.dist[attempts] ?? 0) + 1;
  } else {
    s.curStreak = 0;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(STATS_EVENT));
  } catch {
    // Stats just won't persist — the game itself is unaffected.
  }
  return s;
}

export function winPct(s: Stats): number {
  return s.played ? Math.round((s.wins / s.played) * 100) : 0;
}
