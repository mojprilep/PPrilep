/**
 * Распоред — the active league's fixtures.
 *
 * One league at a time (admin flips `active` in Studio). Rounds already played
 * show results; the next un-played round is highlighted at the top so a reader
 * lands straight on "when's the next match".
 */

import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { ArrowLeft } from "lucide-react";

import { computeStandings, fetchActiveLeague } from "../../../../lib/sanity/sport";
import LeagueView from "./LeagueView";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Распоред — Спорт и Рекреација — Мој Прилеп",
  description: "Распоред на натпревари, резултати и табела за фудбалската лига во Прилеп.",
};

export default async function RasporedPage() {
  const league = await fetchActiveLeague();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sport"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-theme-muted hover:text-theme-heading"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Спорт и Рекреација
        </Link>
        <h1 className="text-sm font-bold text-theme-heading">Распоред</h1>
        {league ? (
          <p className="text-xs text-theme-muted">
            {[league.title, league.season, league.part].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {!league || league.rounds.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-theme-muted">
          Распоредот сè уште не е објавен.
        </p>
      ) : (
        <LeagueView league={league} standings={computeStandings(league.rounds)} />
      )}
    </div>
  );
}
