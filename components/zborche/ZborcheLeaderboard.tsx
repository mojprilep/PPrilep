"use client";

/**
 * ЗборЧе public leaderboard card — the cross-user scoreboard, shown to everyone
 * (anon included) in the game's right column beneath the player's own stats.
 *
 * Reads the `zborche_leaderboard()` RPC on mount and again on STATS_EVENT, so it
 * refreshes the moment the signed-in player's result is written to the server
 * (see lib/zborche/leaderboard.syncResult). Ranking comes straight from the RPC:
 * most wins, then fewest average guesses, then most games played.
 */

import { useEffect, useState } from "react";
import AvatarInitials from "../ui/AvatarInitials";
import { fetchLeaderboard, type LeaderRow } from "../../lib/zborche/leaderboard";
import { STATS_EVENT } from "../../lib/zborche/stats";

export default function ZborcheLeaderboard() {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchLeaderboard(20).then((r) => {
        if (alive) setRows(r);
      });
    };
    load();
    window.addEventListener(STATS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(STATS_EVENT, load);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e4ece8] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">🏆</span>
        <span className="text-sm font-semibold text-slate-800">Ранг листа</span>
      </div>

      {rows === null ? (
        <p className="text-[13px] leading-relaxed text-slate-400">Се вчитува…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-slate-500">
          Сè уште никој не е на листата. Најави се и биди прв! 🥇
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 odd:bg-[#f6faf8]"
            >
              <span className="w-5 shrink-0 text-right text-[13px] font-bold text-slate-500">
                {medal(i)}
              </span>
              <AvatarInitials name={r.name} avatarUrl={r.avatar_url} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                {r.name}
              </span>
              <span
                className="shrink-0 text-[13px] font-extrabold text-slate-800"
                title={`${r.wins} победи од ${r.played} игри`}
              >
                {r.wins}
              </span>
              {r.avg_attempts != null && (
                <span
                  className="shrink-0 text-[11px] text-slate-400"
                  title="Просечно обиди до победа"
                >
                  ⌀{r.avg_attempts}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Top three get a medal; the rest get their rank number. */
function medal(index: number): string {
  return index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1);
}
