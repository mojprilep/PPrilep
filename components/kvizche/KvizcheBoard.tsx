"use client";

/**
 * КвизЧе ranking — the game's right column on /kvizche.
 *
 *  - "Денес": everyone who answered today's question, right answers first,
 *    then the fastest (`kvizche_today_board()`).
 *  - "Недела": points summed over this week; harder days are worth more, so
 *    Sunday's timeline can still swing it (`kvizche_week_board()`).
 *
 * Re-reads on mount and on KVIZCHE_EVENT (fired after an answer). Reuses the
 * ЗборЧе list pieces, so the signed-in player's row is highlighted and pinned
 * with its real rank.
 */

import { useEffect, useState } from "react";
import { Expandable, Row, TabButton } from "../zborche/ZborcheLeaderboard";
import { fetchMyUserId } from "../../lib/zborche/leaderboard";
import { formatSeconds } from "../../lib/kvizche";
import {
  fetchKvizcheTodayBoard,
  fetchKvizcheWeekBoard,
  KVIZCHE_EVENT,
  type KvizcheTodayRow,
  type KvizcheWeekRow,
} from "../../lib/kvizche/client";

type Tab = "today" | "week";

export default function KvizcheBoard() {
  const [tab, setTab] = useState<Tab>("today");
  const [today, setToday] = useState<KvizcheTodayRow[] | null>(null);
  const [week, setWeek] = useState<KvizcheWeekRow[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchKvizcheTodayBoard().then((r) => alive && setToday(r));
      fetchKvizcheWeekBoard().then((r) => alive && setWeek(r));
      fetchMyUserId().then((id) => alive && setMe(id));
    };
    load();
    window.addEventListener(KVIZCHE_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(KVIZCHE_EVENT, load);
    };
  }, []);

  return (
    <div className="space-y-4 lg:p-3">
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🏆</span>
          <span className="text-sm font-semibold text-slate-800">Ранг листа</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-[#f1f6f4] p-1">
          <TabButton active={tab === "today"} onClick={() => setTab("today")}>
            Денес
          </TabButton>
          <TabButton active={tab === "week"} onClick={() => setTab("week")}>
            Недела
          </TabButton>
        </div>

        {tab === "today" ? <TodayList rows={today} me={me} /> : <WeekList rows={week} me={me} />}
      </section>

      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4 text-[12px] leading-relaxed text-slate-500">
        <p className="mb-1 font-semibold text-slate-700">Како се бодува?</p>
        Точен одговор носи <b>ден × 100</b> поени (пон 100 … нед 700) и до <b>50% бонус</b> за брзина.
        Погрешен одговор — 0. Времето тече од „Започни“ до одговорот.
      </section>
    </div>
  );
}

const loading = <p className="text-[13px] leading-relaxed text-slate-400">Се вчитува…</p>;

function TodayList({ rows, me }: { rows: KvizcheTodayRow[] | null; me: string | null }) {
  if (rows === null) return loading;
  if (rows.length === 0)
    return (
      <p className="text-[13px] leading-relaxed text-slate-500">
        Никој уште не одговорил на денешното прашање. Најави се и биди прв! 🥇
      </p>
    );
  return (
    <>
      <p className="mb-2 text-[12px] text-slate-500">
        <span className="font-semibold text-slate-700">{rows[0].correct_today}</span> точно ·{" "}
        {rows[0].played_today} играа денес
      </p>
      <Expandable count={rows.length} meIndex={rows.findIndex((r) => r.user_id === me)}>
        {(i) => {
          const r = rows[i];
          return (
            <Row key={r.user_id} index={i} name={r.name} avatarUrl={r.avatar_url} isMe={r.user_id === me}>
              <span className="shrink-0 text-[11px] text-slate-400">{formatSeconds(r.time_ms)}</span>
              <span className={`shrink-0 text-[13px] font-extrabold ${r.correct ? "text-slate-800" : "text-red-400"}`}>
                {r.correct ? r.points : "✗"}
              </span>
            </Row>
          );
        }}
      </Expandable>
    </>
  );
}

function WeekList({ rows, me }: { rows: KvizcheWeekRow[] | null; me: string | null }) {
  if (rows === null) return loading;
  if (rows.length === 0)
    return <p className="text-[13px] leading-relaxed text-slate-500">Оваа недела уште никој не играл.</p>;
  return (
    <Expandable count={rows.length} meIndex={rows.findIndex((r) => r.user_id === me)}>
      {(i) => {
        const r = rows[i];
        return (
          <Row key={r.user_id} index={i} name={r.name} avatarUrl={r.avatar_url} isMe={r.user_id === me}>
            <span className="shrink-0 text-[11px] text-slate-400" title="Точни одговори">
              {r.correct}/{r.answered}
            </span>
            <span className="shrink-0 text-[13px] font-extrabold text-slate-800">{r.points}</span>
          </Row>
        );
      }}
    </Expandable>
  );
}
