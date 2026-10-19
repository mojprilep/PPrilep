"use client";

/**
 * Client view for the active league: a Распоред / Таблица toggle over data the
 * server already fetched. Fixtures use a stacked two-row layout (time on the
 * left, the pairing in the middle, the score on the right); the table is the
 * usual league standings computed from played results. The league's `ourTeam`
 * (e.g. ПРИЛЕП) is picked out in teal in both views.
 */

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import {
  isMatchPlayed,
  isRoundPlayed,
  nextRoundIndex,
  type LeagueMatch,
  type FormEntry,
  type LeagueRound,
  type SportLeague,
  type StandingRow,
} from "../../../../lib/sanity/sport";

function splitDate(round: LeagueRound): { day: string; time: string } {
  // Prefer an explicit label ("12–13.09.2026") but keep it compact for the
  // narrow time column; fall back to the ISO date.
  const label = round.dateLabel?.trim();
  if (label) return { day: label, time: "" };
  if (!round.date) return { day: "", time: "" };
  try {
    const d = new Date(round.date);
    return {
      day: new Intl.DateTimeFormat("mk-MK", {
        day: "2-digit",
        month: "2-digit",
      }).format(d),
      time: "",
    };
  } catch {
    return { day: round.date, time: "" };
  }
}

function teamClass(lost: boolean, ours: boolean): string {
  if (ours)
    return lost
      ? "font-semibold text-teal-700/60"
      : "font-semibold text-teal-700";
  return lost ? "text-theme-muted" : "text-theme-heading";
}

function MatchRow({
  match,
  ourTeam,
}: {
  match: LeagueMatch;
  ourTeam: string | null;
}) {
  const played = isMatchPlayed(match);
  // Dim the loser of a played match so the winner stays prominent and you can
  // read who won at a glance. A draw keeps both sides prominent.
  const homeLost = played && match.homeScore! < match.awayScore!;
  const awayLost = played && match.awayScore! < match.homeScore!;
  return (
    <div className="flex items-stretch gap-3 py-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div
          className={`truncate text-sm ${teamClass(homeLost, match.home === ourTeam)}`}
        >
          {match.home}
        </div>
        <div
          className={`truncate text-sm ${teamClass(awayLost, match.away === ourTeam)}`}
        >
          {match.away}
        </div>
      </div>
      <div className="flex flex-col items-end justify-center gap-1.5 text-sm font-bold tabular-nums">
        <span
          className={
            !played || homeLost ? "text-theme-muted" : "text-theme-heading"
          }
        >
          {played ? match.homeScore : "-"}
        </span>
        <span
          className={
            !played || awayLost ? "text-theme-muted" : "text-theme-heading"
          }
        >
          {played ? match.awayScore : "-"}
        </span>
      </div>
    </div>
  );
}

function RoundBlock({
  round,
  highlight,
  ourTeam,
}: {
  round: LeagueRound;
  highlight: boolean;
  ourTeam: string | null;
}) {
  const played = isRoundPlayed(round);
  const { day } = splitDate(round);
  // Only the current/next round starts open; every other round collapses so the
  // whole season fits on one glance and the live round is what you land on.
  const [open, setOpen] = useState(highlight);
  return (
    <div
      className={
        highlight
          ? "overflow-hidden rounded-2xl border border-teal-300 bg-teal-50/50"
          : "overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3.5 text-left transition-colors hover:bg-zinc-100/70"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-theme-muted">
            {round.number}. коло
          </span>
          {highlight ? (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {played ? "Последно" : "Следно"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-theme-muted">{day}</span>
          <ChevronDown
            size={15}
            className={`shrink-0 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open ? (
        <div className="divide-y divide-zinc-100 px-4">
          {(round.matches ?? []).map((m, i) => (
            <MatchRow key={i} match={m} ourTeam={ourTeam} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Fixtures({
  rounds,
  ourTeam,
}: {
  rounds: LeagueRound[];
  ourTeam: string | null;
}) {
  const next = nextRoundIndex(rounds);
  return (
    <div className="space-y-3">
      {rounds.map((round, i) => (
        <RoundBlock
          key={round.number ?? i}
          round={round}
          highlight={i === next}
          ourTeam={ourTeam}
        />
      ))}
    </div>
  );
}

const FORM_STYLE: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-amber-400 text-white",
  L: "bg-rose-500 text-white",
};
const FORM_LABEL: Record<"W" | "D" | "L", string> = { W: "П", D: "Н", L: "И" };

function formText(e: FormEntry): string {
  const round = e.round != null ? `${e.round}. коло · ` : "";
  return `${round}${e.home} ${e.homeScore} : ${e.awayScore} ${e.away}`;
}

const TIP_W = 224; // px — matches w-56 below
const RESULT_TEXT: Record<"W" | "D" | "L", string> = {
  W: "Победа",
  D: "Нерешено",
  L: "Пораз",
};

/**
 * One form box. Hover (desktop) or tap (phones) opens a small card with the
 * round and score. The card is portalled to <body> with fixed positioning so
 * the table's horizontal-scroll wrapper can't clip it.
 */
function FormBadge({
  entry: e,
  team,
  latest,
}: {
  entry: FormEntry;
  team: string;
  latest: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    x: number;
    y: number;
    arrow: number;
    below: boolean;
  } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const cx = r.left + r.width / 2;
    // Keep the card inside the viewport; the arrow still points at the box.
    const x = Math.min(
      Math.max(cx, TIP_W / 2 + 8),
      window.innerWidth - TIP_W / 2 - 8,
    );
    const below = r.top < 120;
    setPos({ x, y: below ? r.bottom + 8 : r.top - 8, arrow: cx - x, below });
  };
  const hide = () => setPos(null);

  // A tap-opened card closes on any outside tap or scroll.
  useEffect(() => {
    if (!pos) return;
    const close = (ev: Event) => {
      if (ev.target instanceof Node && ref.current?.contains(ev.target)) return;
      setPos(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", hide, true);
    };
  }, [pos]);

  const side = (name: string, score: number, won: boolean) => (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`truncate ${name === team ? "font-bold text-white" : "text-zinc-300"}`}
      >
        {name}
      </span>
      <span
        className={`tabular-nums font-bold ${won ? "text-white" : "text-zinc-400"}`}
      >
        {score}
      </span>
    </div>
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={formText(e)}
        aria-expanded={pos !== null}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        className={`grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-md border-2 outline-none ${latest ? "border-zinc-400" : "border-transparent"}`}
      >
        <span
          className={`grid h-4 w-4 place-items-center rounded text-[9px] font-bold leading-none ${FORM_STYLE[e.result]}`}
        >
          {FORM_LABEL[e.result]}
        </span>
      </button>
      {pos
        ? createPortal(
            <div
              role="tooltip"
              style={{
                left: pos.x,
                top: pos.y,
                width: TIP_W,
                transform: `translate(-50%, ${pos.below ? "0" : "-100%"})`,
              }}
              className="pointer-events-none fixed z-50 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs shadow-xl"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {e.round != null ? `${e.round}. коло` : ""}
                  {latest ? " · последен" : ""}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${FORM_STYLE[e.result]}`}
                >
                  {RESULT_TEXT[e.result]}
                </span>
              </div>
              <div className="space-y-1">
                {side(e.home, e.homeScore, e.homeScore > e.awayScore)}
                {side(e.away, e.awayScore, e.awayScore > e.homeScore)}
              </div>
              <span
                style={{ left: `calc(50% + ${pos.arrow}px)` }}
                className={`absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-zinc-900 ${pos.below ? "-top-1" : "-bottom-1"}`}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function StandingsTable({
  rows,
  ourTeam,
}: {
  rows: StandingRow[];
  ourTeam: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-theme-muted">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="py-2 pl-1 pr-2 text-left font-semibold">Тим</th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-semibold"
              title="Одиграни"
            >
              О
            </th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-semibold"
              title="Победа"
            >
              П
            </th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-semibold"
              title="Нерешено"
            >
              Н
            </th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-semibold"
              title="Изгубено"
            >
              И
            </th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-semibold"
              title="Гол разлика"
            >
              ГР
            </th>
            <th
              className="cursor-help px-1.5 py-2 text-center font-bold text-theme-heading"
              title="Бодови"
            >
              Б
            </th>
            <th className="px-2 py-2 text-left font-semibold">Форма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const recent = r.form.slice(-5).reverse();
            return (
              <Fragment key={r.team}>
                <tr
                  className={`border-b border-zinc-50 last:border-0 ${r.team === ourTeam ? "bg-teal-50" : ""}`}
                >
                  <td className="px-2 py-2 text-left tabular-nums text-theme-muted">
                    {i + 1}
                  </td>
                  <td
                    className={`py-2 pl-1 pr-2 ${r.team === ourTeam ? "font-bold text-teal-700" : "font-medium text-theme-heading"}`}
                  >
                    {r.team}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-theme-muted">
                    {r.played}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-theme-muted">
                    {r.won}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-theme-muted">
                    {r.drawn}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-theme-muted">
                    {r.lost}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-theme-muted">
                    {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                  </td>
                  <td className="px-1.5 py-2 text-center font-bold tabular-nums text-theme-heading">
                    {r.points}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-0.5">
                      {/* Newest first (leftmost) — that's how fans read a form strip;
                      the latest result is framed so it's unambiguous. */}
                      {recent.map((e, j) => (
                        <FormBadge
                          key={j}
                          entry={e}
                          team={r.team}
                          latest={j === 0}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LeagueView({
  league,
  standings,
}: {
  league: SportLeague;
  standings: StandingRow[];
}) {
  const [tab, setTab] = useState<"fixtures" | "table">("fixtures");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("fixtures")}
          className={
            tab === "fixtures"
              ? "rounded-full bg-teal-600 px-4 py-1.5 text-white"
              : "rounded-full px-4 py-1.5 text-theme-muted hover:text-theme-heading"
          }
        >
          Распоред
        </button>
        <button
          type="button"
          onClick={() => setTab("table")}
          className={
            tab === "table"
              ? "rounded-full bg-teal-600 px-4 py-1.5 text-white"
              : "rounded-full px-4 py-1.5 text-theme-muted hover:text-theme-heading"
          }
        >
          Табела
        </button>
      </div>

      {tab === "fixtures" ? (
        <Fixtures rounds={league.rounds} ourTeam={league.ourTeam} />
      ) : (
        <StandingsTable rows={standings} ourTeam={league.ourTeam} />
      )}
    </div>
  );
}
