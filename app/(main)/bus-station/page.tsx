import type { Metadata } from "next";
import { Suspense } from "react";
import { faPhone, faTicket } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  STATION_EMAIL,
  STATION_PHONE,
  TICKETS_URL,
} from "../../../lib/busStation";
import BusStationBoard from "../../../components/bus/BusStationBoard";
import BusPanelInjector from "../../../components/bus/BusPanelInjector";

export const metadata: Metadata = {
  title: "Автобуска станица Прилеп — возен ред | Мој Прилеп",
  description:
    "Меѓуградски и меѓународни автобуски линии од Автобуската станица во Прилеп — поаѓања, превозници и цени на билети.",
  alternates: { canonical: "/bus-station" },
  openGraph: {
    title: "Возен ред — Автобуска станица Прилеп",
    description:
      "Поаѓања од Прилеп кон Скопје, Битола, Охрид и останатите дестинации, со превозник и цена.",
    url: "/bus-station",
    type: "article",
  },
};

/**
 * The timetable is a fixed sheet that reads the same every day, so this page
 * holds no server-side data fetch at all — it prerenders as fully static HTML.
 * The `?to=` destination is read client-side in <BusStationBoard>, so choosing
 * a destination never touches the origin. (Previously the page awaited
 * `searchParams` and called the pelagonija portal on every request, which forced
 * dynamic rendering and made it one of the site's uncached, per-request routes.)
 */
export default function BusStationPage() {
  return (
    <div className="space-y-6">
      {/* Rules & terms → right panel (mirrors the mobile "Правила" popup). */}
      <BusPanelInjector />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-theme-heading">
          🚌 Автобуска станица Прилеп
        </h1>
        <p className="text-sm text-theme-muted">
          Меѓуградски и меѓународни поаѓања. Избери дестинација за да го видиш
          возниот ред.
        </p>
      </header>

      {/* Station contact — the fallback whenever the timetable can't be loaded,
          and the answer to everything the timetable doesn't cover. */}
      <section className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white p-4">
        <a
          href={`tel:${STATION_PHONE.replace(/\s/g, "")}`}
          className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-bold text-teal-600 transition-colors hover:bg-teal-100"
        >
          <FontAwesomeIcon icon={faPhone} className="h-3.5 w-3.5" />
          {STATION_PHONE}
        </a>
        <a
          href={TICKETS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-theme-muted transition-colors hover:border-teal-300 hover:text-teal-600"
        >
          <FontAwesomeIcon icon={faTicket} className="h-3.5 w-3.5" />
          Купи билет
        </a>
        <a
          href={`mailto:${STATION_EMAIL}`}
          className="text-xs text-zinc-400 transition-colors hover:text-teal-600"
        >
          {STATION_EMAIL}
        </a>
      </section>

      {/* Reads ?to= from the URL, so it must be a client island. The Suspense
          boundary lets everything above prerender as static HTML while this
          hydrates. */}
      <Suspense
        fallback={
          <div className="h-40 rounded-2xl border border-zinc-200 bg-white" />
        }
      >
        <BusStationBoard />
      </Suspense>

      <p className="text-xs leading-relaxed text-zinc-400">
        Возниот ред е официјалниот распоред на превозниците и може да се разликува
        од фактичката состојба. За потврда јави се на{" "}
        <a href={`tel:${STATION_PHONE.replace(/\s/g, "")}`} className="underline">
          {STATION_PHONE}
        </a>
        .
      </p>
    </div>
  );
}
