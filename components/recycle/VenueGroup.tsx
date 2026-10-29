"use client";

import { useState } from "react";
import { ChevronDown, Globe, MapPin, Phone } from "lucide-react";
import { cn } from "../../lib/utils";
import { venueMapsUrl, websiteUrl, type PublicGreenVenue } from "../../lib/recycle";

function VenueCard({ v }: { v: PublicGreenVenue }) {
  const since = v.partner_since ? new Date(`${v.partner_since}T12:00:00`).getFullYear() : null;
  return (
    <li className="space-y-2.5 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{v.name}</p>
          {v.address && <p className="text-xs text-zinc-500">{v.address}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {v.glass && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              🍾 стакло
            </span>
          )}
          {v.cans && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              🥫 лименки
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Without coordinates the maps link searches by name, so it always works. */}
        <a
          href={venueMapsUrl(v)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
          <MapPin size={13} /> Локација
        </a>
        {v.phone && (
          <a
            href={`tel:${v.phone}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50">
            <Phone size={13} /> Јави се
          </a>
        )}
        {v.website && (
          <a
            href={websiteUrl(v.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            <Globe size={13} /> веб / мрежи
          </a>
        )}
      </div>
      {since && <p className="text-[11px] text-zinc-500">Селектира со Пакомак од {since}</p>}
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
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition-colors hover:bg-zinc-50">
        <h2 className="flex-1 text-sm font-semibold text-zinc-800">{title}</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
          {venues.length}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="grid gap-2 border-t border-zinc-100 p-3 sm:grid-cols-2">
          {venues.map((v) => (
            <VenueCard key={v.id} v={v} />
          ))}
        </ul>
      )}
    </section>
  );
}
