"use client";

/**
 * ЗборЧе public leaderboard card — the cross-user scoreboard, shown to everyone
 * (anon included) in the game's right column beneath the player's own stats.
 *
 * Two tabs:
 *  - "Денес": who solved today's word, fewest guesses first, then whoever
 *    finished first (`zborche_today_board()` RPC). A newcomer who nails it in two
 *    tops this board, however long anyone's streak is.
 *  - "Вкупно": the all-time board, every player, most wins first, then fewest
 *    average guesses, then most games (`zborche_leaderboard()` RPC).
 *
 * Both re-read on mount and on STATS_EVENT, so they refresh the moment the
 * signed-in player's result is written to the server (see
 * lib/zborche/leaderboard.syncResult). The signed-in player's row is highlighted,
 * and when it is below the preview it is pinned under it with its real rank, so
 * you always see where you stand.
 */

import { useEffect, useState, type ReactNode } from "react";
import AvatarInitials from "../ui/AvatarInitials";
import {
  fetchLeaderboard,
  fetchMyUserId,
  fetchTodayBoard,
  type LeaderRow,
  type TodayRow,
} from "../../lib/zborche/leaderboard";
import { STATS_EVENT } from "../../lib/zborche/stats";

// How many players show before the "see more" toggle. Beyond this the rest are
// revealed in a scrollable area — no cap on how many players can appear.
const PREVIEW_COUNT = 10;

type Tab = "today" | "all";

export default function ZborcheLeaderboard() {
  const [tab, setTab] = useState<Tab>("today");
  const [today, setToday] = useState<TodayRow[] | null>(null);
  const [all, setAll] = useState<LeaderRow[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchTodayBoard().then((r) => {
        if (alive) setToday(r);
      });
      fetchLeaderboard().then((r) => {
        if (alive) setAll(r);
      });
      fetchMyUserId().then((id) => {
        if (alive) setMe(id);
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

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-[#f1f6f4] p-1">
        <TabButton active={tab === "today"} onClick={() => setTab("today")}>
          Денес
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          Вкупно
        </TabButton>
      </div>

      {tab === "today" ? <TodayList rows={today} me={me} /> : <AllTimeList rows={all} me={me} />}
    </section>
  );
}

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md py-1.5 text-[13px] font-semibold transition ${
        active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function TodayList({ rows, me }: { rows: TodayRow[] | null; me: string | null }) {
  if (rows === null) return <p className="text-[13px] leading-relaxed text-slate-400">Се вчитува…</p>;
  if (rows.length === 0)
    return (
      <p className="text-[13px] leading-relaxed text-slate-500">
        Никој уште не го погодил денешниот збор. Најави се и биди прв! 🥇
      </p>
    );

  const played = rows[0].played_today;
  return (
    <>
      <p className="mb-2 text-[12px] text-slate-500">
        <span className="font-semibold text-slate-700">{rows.length}</span> го погодија ·{" "}
        {played} играа денес
      </p>
      <Expandable count={rows.length} meIndex={rows.findIndex((r) => r.user_id === me)}>
        {(i) => {
          const r = rows[i];
          return (
            <Row key={r.user_id} index={i} name={r.name} avatarUrl={r.avatar_url} isMe={r.user_id === me}>
              <span className="shrink-0 text-[11px] text-slate-400" title="Време на решавање">
                {skopjeTime(r.solved_at)}
              </span>
              <span
                className="shrink-0 text-[13px] font-extrabold text-slate-800"
                title={`Погодено од ${r.attempts}. обид`}
              >
                {r.attempts} {r.attempts === 1 ? "обид" : "обиди"}
              </span>
            </Row>
          );
        }}
      </Expandable>
    </>
  );
}

function AllTimeList({ rows, me }: { rows: LeaderRow[] | null; me: string | null }) {
  if (rows === null) return <p className="text-[13px] leading-relaxed text-slate-400">Се вчитува…</p>;
  if (rows.length === 0)
    return (
      <p className="text-[13px] leading-relaxed text-slate-500">
        Сè уште никој не е на листата. Најави се и биди прв! 🥇
      </p>
    );

  return (
    <Expandable count={rows.length} meIndex={rows.findIndex((r) => r.user_id === me)}>
      {(i) => {
        const r = rows[i];
        return (
          <Row key={r.user_id} index={i} name={r.name} avatarUrl={r.avatar_url} isMe={r.user_id === me}>
            <span
              className="shrink-0 text-[13px] font-extrabold text-slate-800"
              title={`${r.wins} победи од ${r.played} игри`}
            >
              {r.wins}
            </span>
            {r.avg_attempts != null && (
              <span className="shrink-0 text-[11px] text-slate-400" title="Просечно обиди до победа">
                ⌀{r.avg_attempts}
              </span>
            )}
          </Row>
        );
      }}
    </Expandable>
  );
}

/**
 * A ranked list that shows PREVIEW_COUNT rows, then a "see more" toggle. When
 * the signed-in player (meIndex) ranks below the preview, their row is pinned
 * under a "⋯" with its real rank.
 */
export function Expandable({
  count,
  meIndex,
  children,
}: {
  count: number;
  meIndex: number;
  children: (index: number) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = count > PREVIEW_COUNT;
  const shown = expanded ? count : Math.min(count, PREVIEW_COUNT);
  const pinMe = meIndex >= shown;
  return (
    <>
      <ol className={`space-y-1.5 ${expanded ? "max-h-[60vh] overflow-y-auto pr-1" : ""}`}>
        {Array.from({ length: shown }, (_, i) => children(i))}
        {pinMe && (
          <>
            <li className="text-center text-[13px] leading-none text-slate-400" aria-hidden>
              ⋯
            </li>
            {children(meIndex)}
          </>
        )}
      </ol>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-lg py-1.5 text-[13px] font-semibold text-[#2aa99d] hover:bg-[#f6faf8]"
        >
          {expanded ? "Прикажи помалку" : `Прикажи ги сите (${count})`}
        </button>
      )}
    </>
  );
}

export function Row({
  index,
  name,
  avatarUrl,
  isMe,
  children,
}: {
  index: number;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
        isMe ? "border-2 border-[#2aa99d] bg-[#e3f4f1]" : "border-2 border-transparent odd:bg-[#f6faf8]"
      }`}
    >
      <span className="w-7 shrink-0 text-left text-[13px] font-bold text-slate-500">{medal(index)}</span>
      <AvatarInitials name={name} avatarUrl={avatarUrl} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
        {isMe ? "Ти" : name}
      </span>
      {children}
    </li>
  );
}

/** Top three get a medal; the rest get their rank number. */
function medal(index: number): string {
  return index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1);
}

/** "08:14" in Skopje time. */
function skopjeTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("mk-MK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Skopje",
  });
}
