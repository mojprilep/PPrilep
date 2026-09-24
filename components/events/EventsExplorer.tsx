"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, CalendarDays, MapPin, Clock } from "lucide-react";
import Link from "@/components/ui/Link";
import { cn } from "../../lib/utils";
import ShareSheet from "../ui/ShareSheet";
import BlurImage from "../ui/BlurImage";
import EventDetailModal from "./EventDetailModal";
import FilterSelect from "../ui/FilterSelect";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_VISUAL,
  eventPath,
  type EventCategory,
} from "../../lib/data/events";
import { urlForImage } from "../../lib/sanity/image";
import type { SanityEvent } from "../../lib/sanity/queries";

type DateFilter = "upcoming" | "week" | "month" | "all";

const DATE_OPTIONS = [
  { value: "upcoming", label: "Идни настани" },
  { value: "week",     label: "Оваа недела" },
  { value: "month",    label: "Овој месец" },
  { value: "all",      label: "Сите датуми" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Сите категории" },
  ...( Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map((c) => ({
    value: c,
    label: EVENT_CATEGORY_LABELS[c],
  })),
];
const STORAGE_KEY = "events_interested";
// Share links always point at the live domain — Facebook/Viber scrape the public
// page for its OG card and cannot reach localhost.
const SHARE_BASE = "https://mojprilep.mk";
// Stable per-browser id so anonymous "interested" clicks can be deduped
// server-side (hybrid with logged-in user_id — see /api/events/interest).
const VISITOR_KEY = "pp_visitor_id";

function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const MK_MONTHS = [
  "јан", "фев", "мар", "апр", "мај", "јун",
  "јул", "авг", "сеп", "окт", "ное", "дек",
];
const MK_WEEKDAYS = ["нед", "пон", "вто", "сре", "чет", "пет", "саб"];

/**
 * Format a YYYY-MM-DD string without Intl so the output is identical on the
 * server (Node.js) and on the client — avoids the locale hydration mismatch.
 * Parses the date as a local date (no timezone shift).
 */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${MK_WEEKDAYS[date.getDay()]}, ${d} ${MK_MONTHS[m - 1]}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// First "HH:MM" in the free-text time field → minutes since midnight. Events
// with no parseable time sort after timed ones on the same day (an all-day or
// time-TBD entry shouldn't jump ahead of a 17:00 start).
function timeMinutes(time: string | null | undefined): number {
  if (!time) return Number.POSITIVE_INFINITY;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return Number.POSITIVE_INFINITY;
  return h * 60 + min;
}

// GROQ orders by startDate (day granularity) only, so same-day events come back
// in arbitrary order. Sort them chronologically by their start time here.
function byDateThenTime(a: SanityEvent, b: SanityEvent): number {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  return timeMinutes(a.time) - timeMinutes(b.time);
}

function formatWhen(ev: SanityEvent): string {
  const startStr = fmtDate(ev.startDate);
  if (ev.endDate && ev.endDate !== ev.startDate) {
    return `${startStr} – ${fmtDate(ev.endDate)}`;
  }
  return ev.time ? `${startStr} · ${ev.time}` : startStr;
}

// ── Cover (Sanity image or category gradient fallback) ────────────────────────
function EventCover({ ev }: { ev: SanityEvent }) {
  const visual =
    EVENT_CATEGORY_VISUAL[ev.category as EventCategory] ??
    EVENT_CATEGORY_VISUAL.other;

  if (ev.coverImage?.asset) {
    const src = urlForImage(ev.coverImage).width(800).height(480).url();
    return (
      <BlurImage
        src={src}
        alt={ev.coverImage.alt ?? ev.title}
        width={800}
        height={480}
        sizes="(max-width: 640px) 100vw, 400px"
        wrapperClassName="h-full w-full"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-linear-to-br",
        visual.gradient,
      )}>
      <span className="text-5xl drop-shadow-sm">{visual.emoji}</span>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const label =
    EVENT_CATEGORY_LABELS[category as EventCategory] ?? category;
  return (
    <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  events: SanityEvent[];
}

export default function EventsExplorer({ events }: Props) {
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedEvent, setSelectedEvent] = useState<SanityEvent | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setInterested(new Set(JSON.parse(raw) as string[]));
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Pull the public counts and this user's marked-set once, on load. Both can
  // change on another device (e.g. a tap in the mobile app), so they're read
  // fresh each page load rather than trusting localStorage alone — but we don't
  // poll or refetch on focus, to keep backend requests to one per page view.
  // Cross-device changes show up on the next refresh.
  useEffect(() => {
    let alive = true;

    // Public counts (fail-soft: no counter shown if unavailable).
    fetch("/api/events/interest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.counts) setCounts(data.counts as Record<string, number>);
      })
      .catch(() => { /* ignore */ });

    // This user's marked events (union in — never removes, so an un-tap
    // elsewhere just won't re-add). Empty for anonymous visitors.
    fetch("/api/events/interest/mine")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ids = data?.ids as string[] | undefined;
        if (!alive || !ids?.length) return;
        setInterested((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
      })
      .catch(() => { /* ignore */ });

    return () => { alive = false; };
  }, []);

  // Reflect the open event in the address bar (shallow — no navigation/refetch)
  // so the URL is copy-paste shareable and the back button closes the modal.
  useEffect(() => {
    if (!selectedEvent) return;
    const path = eventPath(selectedEvent);
    if (window.history.state?.eventModal !== selectedEvent._id) {
      window.history.pushState({ eventModal: selectedEvent._id }, "", path);
    }
    const onPop = () => setSelectedEvent(null);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via the X/backdrop (URL still on the event) → restore /events.
      if (window.history.state?.eventModal) window.history.back();
    };
  }, [selectedEvent]);

  function toggleInterested(id: string) {
    const adding = !interested.has(id);

    // Optimistic local state + count.
    setInterested((prev) => {
      const next = new Set(prev);
      if (adding) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + (adding ? 1 : -1)),
    }));

    // Persist; reconcile with the authoritative server count.
    fetch("/api/events/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: id,
        action: adding ? "add" : "remove",
        visitorId: getVisitorId(),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.count === "number") {
          setCounts((prev) => ({ ...prev, [id]: data.count }));
        }
      })
      .catch(() => { /* keep optimistic value */ });
  }

  // Shareable URL = our own event page on the LIVE domain (has OG tags for a rich
  // preview), not the external sourceUrl and never localhost — Facebook/Viber can
  // only scrape a public URL, so a dev-origin link shows no card.
  function eventUrl(ev: SanityEvent): string {
    return `${SHARE_BASE}${eventPath(ev)}`;
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 7);

    return events
      .filter((ev) => {
        if (category !== "all" && ev.category !== category) return false;

        const start = startOfDay(new Date(ev.startDate));
        const end = startOfDay(new Date(ev.endDate ?? ev.startDate));

        if (dateFilter === "upcoming") return end >= today;
        if (dateFilter === "week") return end >= today && start <= weekAhead;
        if (dateFilter === "month")
          return (
            end >= today &&
            start.getFullYear() === today.getFullYear() &&
            start.getMonth() === today.getMonth()
          );
        return true;
      })
      // GROQ sorts by startDate (day) only; break same-day ties by start time.
      .sort(byDateThenTime);
  }, [events, category, dateFilter]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-2xl">📅</p>
        <p className="mt-2 text-sm font-medium text-zinc-700">
          Сè уште нема внесени настани
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Додајте настани преку{" "}
          <Link href="/studio" className="text-rose-500 hover:underline">
            Studio
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
      {/* ── Filters ── */}
      <div className="flex items-center gap-2">
        <FilterSelect
          value={dateFilter}
          onChange={(v) => setDateFilter(v as DateFilter)}
          options={DATE_OPTIONS}
          placeholder="Идни настани"
          isActive={dateFilter !== "upcoming"}
          className="w-44"
        />
        <FilterSelect
          value={category === "all" ? "" : category}
          onChange={(v) => setCategory((v || "all") as EventCategory | "all")}
          options={CATEGORY_OPTIONS.map((o) => ({ ...o, value: o.value === "all" ? "" : o.value }))}
          placeholder="Сите категории"
          isActive={category !== "all"}
          className="w-44"
        />
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-theme-muted">
            Нема настани за избраните филтри.
          </p>
        </div>
      )}

      {/* ── Featured ── */}
      {featured && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-theme-heading">
            Следен настан
          </h2>
          <div
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:flex cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setSelectedEvent(featured)}>
            <div className="relative h-70 w-full shrink-0 sm:w-2/5 lg:w-1/3">
              <EventCover ev={featured} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
              <div className="space-y-1.5">
                <CategoryBadge category={featured.category} />
                <h3 className="text-lg font-bold leading-snug text-theme-heading">
                  {featured.title}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-theme-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> {formatWhen(featured)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} /> {featured.location}
                  </span>
                </div>
                {featured.description && (
                  <p className="pt-1 text-sm leading-relaxed text-theme-muted line-clamp-5">
                    {featured.description}
                  </p>
                )}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <InterestedButton
                  active={interested.has(featured._id)}
                  onClick={() => toggleInterested(featured._id)}
                  count={counts[featured._id] ?? 0}
                  large
                />
                <ShareSheet
                  url={eventUrl(featured)}
                  title={featured.title}
                  showLabel
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                />
                {featured.sourceUrl && (
                  <a
                    href={featured.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-rose-500 hover:underline">
                    Повеќе →
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Grid ── */}
      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-theme-heading">
            Останати настани
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((ev) => (
              <article
                key={ev._id}
                onClick={() => setSelectedEvent(ev)}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer">
                <div className="relative h-50 w-full">
                  <EventCover ev={ev} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <CategoryBadge category={ev.category} />
                  <h3 className="text-sm font-bold leading-snug text-theme-heading">
                    {ev.title}
                  </h3>
                  <div className="space-y-1 text-xs text-theme-muted">
                    <p className="inline-flex items-center gap-1.5">
                      <Clock size={12} /> {formatWhen(ev)}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <MapPin size={12} /> {ev.location}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    <InterestedButton
                      active={interested.has(ev._id)}
                      onClick={() => toggleInterested(ev._id)}
                      count={counts[ev._id] ?? 0}
                    />
                    <ShareSheet
                      url={eventUrl(ev)}
                      title={ev.title}
                      className="inline-flex h-8 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    />
                    {ev.sourceUrl && (
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[11px] text-rose-500 hover:underline">
                        Повеќе →
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>

    {/* ── Event Detail Modal ── */}
    {selectedEvent && (
      <EventDetailModal
        event={selectedEvent}
        interested={interested.has(selectedEvent._id)}
        interestedCount={counts[selectedEvent._id] ?? 0}
        onToggleInterested={(id) => {
          toggleInterested(id);
        }}
        onClose={() => setSelectedEvent(null)}
        shareUrl={eventUrl(selectedEvent)}
      />
    )}
    </>
  );
}


function InterestedButton({
  active, onClick, large = false, count = 0,
}: {
  active: boolean; onClick: () => void; large?: boolean; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors",
        large ? "max-w-xs px-4 py-2 text-sm" : "h-8 px-3 text-xs",
        active
          ? "bg-primary text-white hover:bg-primary/90"
          : "bg-primary-light text-primary hover:bg-primary/15",
      )}>
      <Star size={large ? 15 : 14} className={active ? "fill-white" : ""} />
      Заинтересиран
      {count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold tabular-nums text-primary shadow-sm">
          {count}
        </span>
      )}
    </button>
  );
}
