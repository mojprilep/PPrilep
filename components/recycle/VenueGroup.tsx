"use client";

import { useState } from "react";
import { ChevronDown, Globe, MapPin, Phone } from "lucide-react";
import { cn } from "../../lib/utils";
import { venueCollects, venueMapsUrl, websiteUrl, type PublicGreenVenue } from "../../lib/recycle";

const CIRCLE =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors";

function VenueCard({ v }: { v: PublicGreenVenue }) {
  const collects = venueCollects(v);
  const since = collects && v.partner_since ? new Date(`${v.partner_since}T12:00:00`).getFullYear() : null;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 pl-4",
        collects ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 opacity-60 grayscale",
      )}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", collects ? "text-zinc-900" : "text-zinc-500")}>{v.name}</p>
        {v.address && <p className="text-xs text-zinc-500">{v.address}</p>}
        {since && <p className="text-[11px] text-zinc-500">Селектира со Пакомак од {since}</p>}
        {!collects && <p className="text-[11px] font-medium text-zinc-500">Моментално не селектира</p>}
      </div>
      {v.website && (
        <a
          href={websiteUrl(v.website)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Веб / мрежи"
          title="Веб / мрежи"
          className={`${CIRCLE} border border-zinc-200 text-zinc-600 hover:bg-zinc-50`}>
          <Globe size={16} />
        </a>
      )}
      {/* Always shown so every row lines up; greyed out until the admin adds a number. */}
      {v.phone ? (
        <a
          href={`tel:${v.phone}`}
          aria-label={`Јави се: ${v.phone}`}
          title={v.phone}
          className={`${CIRCLE} border border-teal-300 text-teal-700 hover:bg-teal-50`}>
          <Phone size={16} />
        </a>
      ) : (
        <span
          aria-disabled="true"
          title="Нема внесен телефон"
          className={`${CIRCLE} cursor-not-allowed border border-zinc-200 text-zinc-300`}>
          <Phone size={16} />
        </span>
      )}
      {/* Without coordinates the maps link searches by name, so it always works. */}
      <a
        href={venueMapsUrl(v)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Локација"
        title="Локација"
        className={`${CIRCLE} bg-teal-600 text-white hover:bg-teal-700`}>
        <MapPin size={16} />
      </a>
    </li>
  );
}

interface Props {
  title: string;
  venues: PublicGreenVenue[];
  defaultOpen?: boolean;
}

export default function VenueGroup({ title, venues, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // Venues that don't collect go to the bottom and aren't counted.
  const sorted = [...venues].sort((a, b) => Number(venueCollects(b)) - Number(venueCollects(a)));
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition-colors hover:bg-zinc-50">
        <h2 className="flex-1 text-sm font-semibold text-zinc-800">{title}</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
          {venues.filter(venueCollects).length}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="grid gap-2 border-t border-zinc-100 p-3 sm:grid-cols-2">
          {sorted.map((v) => (
            <VenueCard key={v.id} v={v} />
          ))}
        </ul>
      )}
    </section>
  );
}
