"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { CalendarDays, MapPin, Star, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { urlForImage } from "../../lib/sanity/image";
import type { SanityEvent } from "../../lib/sanity/queries";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_VISUAL,
  eventPath,
  type EventCategory,
} from "../../lib/data/events";

// No-Intl date formatter (same convention as EventsExplorer) — identical on
// server and client, parsed as a local date so there's no timezone shift.
const MK_MONTHS = [
  "јан", "фев", "мар", "апр", "мај", "јун",
  "јул", "авг", "сеп", "окт", "ное", "дек",
];
const MK_WEEKDAYS = ["нед", "пон", "вто", "сре", "чет", "пет", "саб"];

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${MK_WEEKDAYS[date.getDay()]}, ${d} ${MK_MONTHS[m - 1]}`;
}

function formatWhen(ev: SanityEvent): string {
  const start = fmtDate(ev.startDate);
  if (ev.endDate && ev.endDate !== ev.startDate) {
    return `${start} – ${fmtDate(ev.endDate)}`;
  }
  return ev.time ? `${start} · ${ev.time}` : start;
}

export default function EventSpotlight() {
  const [event, setEvent] = useState<SanityEvent | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/events/spotlight")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.event) return;
        setEvent(data.event as SanityEvent);
        setCount(typeof data.count === "number" ? data.count : 0);
      })
      .catch(() => { /* silent — the panel just omits the spotlight */ });
    return () => { alive = false; };
  }, []);

  if (!event) return null;

  const visual =
    EVENT_CATEGORY_VISUAL[event.category as EventCategory] ??
    EVENT_CATEGORY_VISUAL.other;
  const categoryLabel =
    EVENT_CATEGORY_LABELS[event.category as EventCategory] ?? event.category;
  const cover = event.coverImage?.asset
    ? urlForImage(event.coverImage).width(480).height(240).url()
    : null;

  return (
    <div className="lg:p-3">
      {/* Section header — links out to the full events listing. */}
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Случувања
        </span>
        <Link
          href="/events"
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80">
          Сите случувања
          <ChevronRight size={13} />
        </Link>
      </div>
      <Link
        href={eventPath(event)}
        className="block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-md">
        {/* Cover */}
        <div className="relative h-28 w-full">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={event.coverImage?.alt ?? event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-linear-to-br",
                visual.gradient,
              )}>
              <span className="text-4xl drop-shadow-sm">{visual.emoji}</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-800 backdrop-blur-sm">
            <span>{visual.emoji}</span>
            {categoryLabel}
          </span>
        </div>

        {/* Body */}
        <div className="space-y-1.5 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
            {event.pinned ? "Издвоен настан" : "Следен настан"}
          </p>
          <h3 className="text-sm font-bold leading-snug text-zinc-800 line-clamp-2">
            {event.title}
          </h3>
          <div className="space-y-1 text-xs text-zinc-500">
            <p className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} /> {formatWhen(event)}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <MapPin size={12} /> {event.location}
            </p>
          </div>
          {count > 0 && (
            <p className="inline-flex items-center gap-1.5 pt-0.5 text-xs font-medium text-amber-600">
              <Star size={12} className="fill-amber-500 text-amber-500" />
              {count} заинтересирани
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}
