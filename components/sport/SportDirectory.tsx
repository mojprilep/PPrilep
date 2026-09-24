"use client";

/**
 * The club list with its search box and filter chips.
 *
 * A client component so filtering is instant — the whole directory is a few
 * dozen clubs, so it is fetched once on the server and narrowed in the browser
 * rather than round-tripping for every keystroke.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/Link";
import { Search, MapPin, BadgeCheck, ChevronDown } from "lucide-react";

import { urlForImage } from "../../lib/sanity/image";
import {
  AGE_LABEL,
  KIND_LABEL,
  sportsIn,
  type SportClubCard,
} from "../../lib/sanity/sport";

/** The age filter is a fixed order — a jumbled age list is hard to scan. */
const AGE_ORDER = ["4-6", "7-11", "12-15", "16-18", "18+", "recreation", "veterans"];

/** Kind order for the "Тип" dropdown — most common first. */
const KIND_ORDER = ["club", "gym", "centre", "school", "federation", "recreation"];

/**
 * A styled native <select>. Native is deliberate: it is keyboard- and
 * screen-reader-correct for free, and on mobile it opens the OS picker, which
 * beats any custom menu on a phone. The chevron is ours; the widget is the
 * browser's.
 */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "";
  return (
    <div className="relative min-w-0 flex-1">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full cursor-pointer appearance-none rounded-xl border bg-white py-2.5 pl-3 pr-8 text-sm font-semibold outline-none transition-colors focus:border-teal-400 ${
          active
            ? "border-teal-400 text-teal-700"
            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
          active ? "text-teal-600" : "text-zinc-400"
        }`}
      />
    </div>
  );
}

function ClubCard({ club }: { club: SportClubCard }) {
  return (
    <Link
      href={`/sport/${club.slug}`}
      className="flex gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition-all hover:shadow-md hover:ring-teal-200"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 sm:h-24 sm:w-24">
        {club.logo ? (
          <Image
            src={urlForImage(club.logo).width(192).height(192).fit("crop").url()}
            alt={club.name}
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl">🏅</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-theme-heading sm:text-lg">
            {club.name}
          </h3>
          {club.verified ? (
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          ) : null}
        </div>

        <p className="truncate text-sm text-theme-muted">
          {(club.sports ?? []).join(", ") || KIND_LABEL[club.kind]}
        </p>

        {club.shortDescription ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-theme-muted">
            {club.shortDescription}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {club.district ? (
            <span className="flex items-center gap-0.5 text-xs text-zinc-400">
              <MapPin className="h-3.5 w-3.5" />
              {club.district}
            </span>
          ) : null}
          {club.freeTrial ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-600">
              Прв тренинг бесплатно
            </span>
          ) : null}
          {/* Only the negative case is worth a badge: "прима членови" is the
              assumption, "не прима" is the thing that saves a phone call. */}
          {club.acceptingMembers ? null : (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-500">
              Уписот е затворен
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SportDirectory({ clubs }: { clubs: SportClubCard[] }) {
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("");
  const [age, setAge] = useState("");
  const [kind, setKind] = useState("");

  const sportOptions = useMemo(
    () => sportsIn(clubs).map((s) => ({ value: s, label: s })),
    [clubs],
  );
  const ageOptions = useMemo(
    () =>
      AGE_ORDER.filter((a) => clubs.some((c) => (c.ageGroups ?? []).includes(a))).map((a) => ({
        value: a,
        label: AGE_LABEL[a] ?? a,
      })),
    [clubs],
  );
  const kindOptions = useMemo(
    () =>
      KIND_ORDER.filter((k) => clubs.some((c) => c.kind === k)).map((k) => ({
        value: k,
        label: KIND_LABEL[k] ?? k,
      })),
    [clubs],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("mk");
    return clubs.filter((club) => {
      if (sport && !(club.sports ?? []).some((s) => s.toLocaleLowerCase("mk") === sport))
        return false;
      if (age && !(club.ageGroups ?? []).includes(age)) return false;
      if (kind && club.kind !== kind) return false;
      if (!needle) return true;
      const haystack = [club.name, club.shortDescription, club.district, ...(club.sports ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("mk");
      return haystack.includes(needle);
    });
  }, [clubs, query, sport, age, kind]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пребарај клуб или спорт…"
          className="w-full bg-transparent text-sm text-theme-heading outline-none placeholder:text-zinc-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {sportOptions.length > 0 ? (
          <FilterSelect label="Спорт" value={sport} onChange={setSport} options={sportOptions} />
        ) : null}
        {ageOptions.length > 0 ? (
          <FilterSelect label="Возраст" value={age} onChange={setAge} options={ageOptions} />
        ) : null}
        {kindOptions.length > 1 ? (
          <FilterSelect label="Тип" value={kind} onChange={setKind} options={kindOptions} />
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-theme-muted">
          Нема клуб што одговара на пребарувањето.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((club) => (
            <ClubCard key={club._id} club={club} />
          ))}
        </div>
      )}
    </div>
  );
}
