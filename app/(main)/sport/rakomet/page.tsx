/**
 * Ракомет — the active handball league (Супер машка лига) with РК Прилеп.
 *
 * Same LeagueView as the football /sport/raspored, fed the active league whose
 * `sport` is handball (2 points for a win).
 */

import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { ArrowLeft } from "lucide-react";

import { computeStandings, fetchActiveLeague, winPointsFor } from "../../../../lib/sanity/sport";
import LeagueView from "../raspored/LeagueView";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ракомет — Спорт и Рекреација — Мој Прилеп",
  description: "Распоред, резултати и табела од ракометната Супер лига со РК Прилеп.",
};

export default async function RakometPage() {
  const league = await fetchActiveLeague("handball");

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
        <h1 className="text-sm font-bold text-theme-heading">Ракомет</h1>
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
        <LeagueView league={league} standings={computeStandings(league.rounds, winPointsFor(league.sport))} />
      )}
    </div>
  );
}
