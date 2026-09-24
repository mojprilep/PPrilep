/**
 * Спорт и Рекреација — the club directory.
 *
 * Every club in Prilep gets a free profile with the SAME structure, so a
 * parent comparing two of them compares like with like. Profiles are created
 * either by the editorial team in Studio or by the club through /sport/nov.
 */

import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { ChevronRight, Footprints, Plus } from "lucide-react";

import SportDirectory from "../../../components/sport/SportDirectory";
import SubmitClubButton from "../../../components/sport/SubmitClubButton";
import { fetchSportClubs } from "../../../lib/sanity/sport";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Спорт и Рекреација — Мој Прилеп",
  description:
    "Сите спортски клубови, школи и фитнес центри во Прилеп на едно место — " +
    "распоред на тренинзи, цени и контакт.",
};

export default async function SportPage() {
  const clubs = await fetchSportClubs();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xl">
          🏅
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-theme-heading">Спорт и Рекреација</h1>
          <p className="text-xs text-theme-muted">
            {clubs.length
              ? `${clubs.length} клубови и организации во Прилеп`
              : "Клубовите во Прилеп — распоред, цени и контакт"}
          </p>
        </div>
      </div>

      {/* The invitation sits above the list, not buried under it: an empty or
          short directory is exactly when a club needs to be asked to join. */}
      <SubmitClubButton
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-left transition-colors hover:bg-teal-100"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-teal-800">
            Имаш клуб? Профилот е бесплатен.
          </p>
          <p className="text-xs text-teal-700">
            Пополни ја формата — распоред, цени и контакт на едно место.
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
          <Plus className="h-4 w-4" />
        </span>
      </SubmitClubButton>

      {/* The football league (Трета Лига Југ) is football-only, so it lives in
          the left-side menu under Спорт, not on this general club directory. */}

      {/* Local road race — informational page with apply links to the organiser. */}
      <Link
        href="/sport/ce-trcame"
        className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
          <Footprints className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-theme-heading">Че Трчаме 2026</p>
          <p className="text-xs text-theme-muted">Трка на 5 и 10 км · 18 октомври · пријави се</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-theme-muted" />
      </Link>

      {clubs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-theme-muted">
          Уште нема објавени клубови. Твојот може да биде првиот.
        </p>
      ) : (
        <SportDirectory clubs={clubs} />
      )}
    </div>
  );
}
