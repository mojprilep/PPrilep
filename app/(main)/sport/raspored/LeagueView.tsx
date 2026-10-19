"use client";

/**
 * Client view for the active league: a Распоред / Таблица toggle over data the
 * server already fetched. Fixtures use a stacked two-row layout (time on the
 * left, the pairing in the middle, the score on the right); the table is the
 * usual league standings computed from played results. The league's `ourTeam`
 * (e.g. ПРИЛЕП) is picked out in teal in both views.
 */

import { Fragment, useState } from "react";
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

function StandingsTable({
  rows,
  ourTeam,
}: {
  rows: StandingRow[];
  ourTeam: string | null;
}) {
  // Tapped form box ("team|index") — hover shows a tooltip on desktop, but
  // phones have no hover, so a tap opens the match under that team's row.
  const [picked, setPicked] = useState<string | null>(null);
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
            const pickedIdx = picked?.startsWith(`${r.team}|`)
              ? Number(picked.slice(r.team.length + 1))
              : -1;
            const pickedEntry = recent[pickedIdx];
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
                    <div className="flex gap-1">
                      {/* Newest first (leftmost) — that's how fans read a form strip;
                      the latest result also gets a ring so it's unambiguous. */}
                      {recent.map((e, j) => (
                        <button
                          key={j}
                          type="button"
                          title={
                            (j === 0 ? "Последен натпревар: " : "") +
                            formText(e)
                          }
                          aria-label={formText(e)}
                          aria-expanded={j === pickedIdx}
                          onClick={() =>
                            setPicked(j === pickedIdx ? null : `${r.team}|${j}`)
                          }
                          className={`inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[9px] font-bold leading-none ${FORM_STYLE[e.result]} ${j === 0 ? "ring-2 ring-offset-1 ring-zinc-400" : ""} ${j === pickedIdx ? "scale-125" : ""}`}
                        >
                          {FORM_LABEL[e.result]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
                {pickedEntry ? (
                  <tr className="border-b border-zinc-50 bg-zinc-50/70">
                    <td
                      colSpan={9}
                      className="px-3 py-2 text-xs text-theme-muted"
                    >
                      {pickedEntry.round != null ? (
                        <span className="mr-2 font-semibold uppercase tracking-wide">
                          {pickedEntry.round}. коло
                        </span>
                      ) : null}
                      <span
                        className={
                          pickedEntry.home === r.team
                            ? "font-semibold text-theme-heading"
                            : ""
                        }
                      >
                        {pickedEntry.home}
                      </span>{" "}
                      <span className="font-bold tabular-nums text-theme-heading">
                        {pickedEntry.homeScore} : {pickedEntry.awayScore}
                      </span>{" "}
                      <span
                        className={
                          pickedEntry.away === r.team
                            ? "font-semibold text-theme-heading"
                            : ""
                        }
                      >
                        {pickedEntry.away}
                      </span>
                    </td>
                  </tr>
                ) : null}
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
