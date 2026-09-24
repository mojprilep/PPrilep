"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { faBusSimple, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { STATION_PHONE } from "../../lib/busStation";
import { allDestinations, linesTo } from "../../lib/data/timetable";
import OfficialTimetable from "./OfficialTimetable";
import NextDepartures from "./NextDepartures";

const POPULAR = ["Скопје", "Битола", "Охрид", "Кичево", "Велес", "Белград"];

/**
 * Shown when nothing has been searched yet. Skopje is far and away the most
 * asked-for destination at this station, so landing on an empty screen wastes
 * the one interaction most visitors were going to make anyway.
 */
const DEFAULT_DESTINATION = "Скопје";

/**
 * The interactive half of the bus-station page. It lives in a Client Component
 * so it can read `?to=` from the URL WITHOUT making the page dynamic on the
 * server — the shell (header, contact, footer) prerenders and caches, and only
 * this island hydrates to pick the destination. The timetable is a fixed sheet
 * that is the same every day, so everything here is derived from the static
 * `lib/data/timetable` data — no third-party API calls, nothing to revalidate.
 */
export default function BusStationBoard() {
  const params = useSearchParams();
  const destination = (params.get("to") ?? "").trim() || DEFAULT_DESTINATION;
  const sheetLines = linesTo(destination);
  const hasSheet = sheetLines.length > 0;
  /** Where you can actually get to — our own sheet's destinations. */
  const destinations = allDestinations();

  return (
    <>
      {/* Destination picker. A plain GET form so it works without JavaScript
          and every result is a shareable, cacheable URL. */}
      <section className="space-y-3">
        <form action="/bus-station" className="flex gap-2">
          <input
            type="search"
            name="to"
            list="bus-stations"
            defaultValue={destination}
            placeholder="Кон каде патуваш?"
            aria-label="Дестинација"
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus-visible:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-700"
          >
            Барај
          </button>
        </form>
        {/* Every destination we hold a sheet for, as native autocomplete. */}
        <datalist id="bus-stations">
          {destinations.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="flex flex-wrap gap-2">
          {POPULAR.map((city) => (
            <Link
              key={city}
              href={`/bus-station?to=${encodeURIComponent(city)}`}
              className={
                city === destination
                  ? "rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-theme-muted transition-colors hover:border-teal-300 hover:text-teal-600"
              }
            >
              {city}
            </Link>
          ))}
        </div>

        {/* The chips answer "is my usual coach running"; this answers "where can
            I even go from here", which the search box can't — it only helps
            someone who already knows the name. A <details> so it costs no
            JavaScript and the closed state is the default. */}
        {destinations.length ? (
          <details className="group rounded-2xl border border-zinc-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-theme-muted transition-colors hover:text-teal-600">
              Сите дестинации ({destinations.length})
              <FontAwesomeIcon
                icon={faChevronDown}
                className="h-3 w-3 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-100 px-4 py-3 sm:grid-cols-3 md:grid-cols-4">
              {destinations.map((s) => (
                <Link
                  key={s}
                  href={`/bus-station?to=${encodeURIComponent(s)}`}
                  className="truncate py-1 text-sm text-theme-muted transition-colors hover:text-teal-600"
                >
                  {s}
                </Link>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      {/* The station's own sheet — it carries student and return fares. */}
      {hasSheet ? (
        <>
          <OfficialTimetable destination={destination} lines={sheetLines} />
          {/* The grouped view above answers "what does Роман run"; this answers
              "what is the next bus", which is what most visits are actually
              about. Same data, ordered by the clock instead of by carrier. */}
          <NextDepartures destination={destination} lines={sheetLines} />
        </>
      ) : (
        // Someone typed a place we haven't transcribed. The sheet is the whole
        // answer we hold, so point them at the station rather than guessing.
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 px-8 py-12 text-center">
          <FontAwesomeIcon icon={faBusSimple} className="h-8 w-8 text-zinc-300" />
          <p className="max-w-sm text-sm leading-relaxed text-theme-muted">
            Немаме возен ред за „{destination}“. Провери го името на местото или
            јави се на станицата на{" "}
            <a
              href={`tel:${STATION_PHONE.replace(/\s/g, "")}`}
              className="font-semibold text-teal-600 underline"
            >
              {STATION_PHONE}
            </a>
            .
          </p>
        </div>
      )}
    </>
  );
}
