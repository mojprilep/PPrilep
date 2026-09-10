"use client";

/**
 * ЗборЧе right-column panel — the player's on-device scoreboard.
 *
 * Reads the local stats (see lib/zborche/stats) and shows played / win% /
 * current & max streak plus a guess-distribution bar chart, matching the
 * mobile app's Статистика sheet. It re-reads on the game's STATS_EVENT (same
 * tab, fired when a game finishes) and on the native `storage` event (the game
 * open in another tab), so the numbers update the moment a puzzle is solved.
 */

import { useEffect, useState } from "react";
import ZborcheLogo from "./ZborcheLogo";
import ZborcheLeaderboard from "./ZborcheLeaderboard";
import { loadStats, winPct, STATS_EVENT, type Stats } from "../../lib/zborche/stats";

export default function ZborcheRightPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const read = () => setStats(loadStats());
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "zborche:stats") read();
    };
    window.addEventListener(STATS_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STATS_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className="space-y-4 lg:p-3">
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <ZborcheLogo height={22} />
          <span className="text-sm font-semibold text-slate-800">Статистика</span>
        </div>

        {!stats || stats.played === 0 ? (
          <p className="text-[13px] leading-relaxed text-slate-500">
            Немаш одиграно уште. Погоди го денешниот збор и следи ги своите резултати овде! 🟩
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <Stat value={stats.played} label="Играни" />
              <Stat value={winPct(stats)} label="% Победи" />
              <Stat value={stats.curStreak} label="Серија" />
              <Stat value={stats.maxStreak} label="Најдолга" />
            </div>

            <Distribution stats={stats} />
          </>
        )}
      </section>

      <ZborcheLeaderboard />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold leading-none text-slate-800">{value}</div>
      <div className="mt-1 text-[10px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

function Distribution({ stats }: { stats: Stats }) {
  const keys = Object.keys(stats.dist).map(Number);
  const maxRow = Math.max(6, ...(keys.length ? keys : [0]));
  const maxCount = Math.max(1, ...Object.values(stats.dist));

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold text-slate-700">Погодоци по обид</p>
      <div className="space-y-1.5">
        {Array.from({ length: maxRow }).map((_, i) => {
          const n = i + 1;
          const count = stats.dist[n] ?? 0;
          const width = Math.max(8, Math.round((count / maxCount) * 100));
          return (
            <div key={n} className="flex items-center gap-2">
              <span className="w-3 text-right text-[11px] font-bold text-slate-600">{n}</span>
              <div className="flex-1">
                <div
                  className="flex items-center justify-end rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white"
                  style={{ width: `${width}%` }}
                >
                  {count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
