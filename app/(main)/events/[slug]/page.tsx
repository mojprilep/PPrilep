import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, ExternalLink } from "lucide-react";
import { fetchEventByKey, type SanityEvent } from "@/lib/sanity/queries";
import { urlForImage } from "@/lib/sanity/image";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_VISUAL,
  eventPath,
  type EventCategory,
} from "@/lib/data/events";
import { cn } from "@/lib/utils";
import ShareSheet from "@/components/ui/ShareSheet";
import EventInterestButton from "@/components/events/EventInterestButton";
import EventPoll from "@/components/events/EventPoll";
import EventCover from "@/components/events/EventCover";

const BASE_URL = "https://mojprilep.mk";

// Sanity-only content (interest + poll load client-side), so the page can be
// cached. The Sanity webhook's revalidateTag("events") purges it on publish.
export const revalidate = 300;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

// ── Date formatting (no Intl → identical on server + client) ─────────────────
const MK_MONTHS_FULL = [
  "јануари", "февруари", "март", "април", "мај", "јуни",
  "јули", "август", "септември", "октомври", "ноември", "декември",
];
const MK_WEEKDAYS_FULL = [
  "недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота",
];

function fmtFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${MK_WEEKDAYS_FULL[date.getDay()]}, ${d} ${MK_MONTHS_FULL[m - 1]} ${y}`;
}

function formatWhen(ev: SanityEvent): string {
  const start = fmtFull(ev.startDate);
  if (ev.endDate && ev.endDate !== ev.startDate) return `${start} – ${fmtFull(ev.endDate)}`;
  return start;
}

// ── Metadata (Facebook/Twitter share cards) ──────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await fetchEventByKey(decodeURIComponent(slug));
  if (!ev) return {};

  const image = ev.coverImage?.asset
    ? urlForImage(ev.coverImage).width(1200).height(630).url()
    : undefined;
  const description = ev.description ?? `${ev.location} · ${formatWhen(ev)}`;

  return {
    title: ev.title,
    description,
    alternates: { canonical: eventPath(ev) },
    openGraph: {
      type: "article",
      title: ev.title,
      description,
      url: `${BASE_URL}${eventPath(ev)}`,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ev.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const key = decodeURIComponent(slug);
  const ev = await fetchEventByKey(key);
  if (!ev) notFound();

  // Canonical URL is the slug when one exists; redirect /events/<_id> → /events/<slug>.
  if (ev.slug && key !== ev.slug) redirect(eventPath(ev));

  const visual =
    EVENT_CATEGORY_VISUAL[ev.category as EventCategory] ?? EVENT_CATEGORY_VISUAL.other;
  const categoryLabel =
    EVENT_CATEGORY_LABELS[ev.category as EventCategory] ?? ev.category;
  const cover = ev.coverImage?.asset
    ? urlForImage(ev.coverImage).width(1200).height(600).url()
    : null;
  // The banner is cropped to a 2:1 band; the viewer gets the whole image.
  const coverFull = ev.coverImage?.asset
    ? urlForImage(ev.coverImage).width(1600).fit("max").url()
    : null;
  const gallery = ev.gallery.map((img) => ({
    thumb: urlForImage(img).width(160).height(160).url(),
    full: urlForImage(img).width(1600).fit("max").url(),
    alt: img.alt ?? ev.title,
  }));
  const categoryBadge = (
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-800 backdrop-blur-sm">
      <span>{visual.emoji}</span>
      {categoryLabel}
    </span>
  );
  const shareUrl = `${BASE_URL}${eventPath(ev)}`;

  return (
    <div className="space-y-4">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-muted transition-colors hover:text-theme-heading">
        <ArrowLeft size={15} /> Сите настани
      </Link>

      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Cover — clickable, opening the uncropped image and any gallery shots. */}
        {cover ? (
          <EventCover
            src={cover}
            full={coverFull!}
            alt={ev.coverImage?.alt ?? ev.title}
            gallery={gallery}>
            {categoryBadge}
          </EventCover>
        ) : (
          <div className="relative h-56 w-full sm:h-72">
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-linear-to-br",
                visual.gradient,
              )}>
              <span className="text-7xl drop-shadow-sm">{visual.emoji}</span>
            </div>
            {categoryBadge}
          </div>
        )}

        {/* Body */}
        <div className="space-y-4 p-5">
          <h1 className="text-2xl font-bold leading-snug text-theme-heading">
            {ev.title}
          </h1>

          <ul className="space-y-2.5">
            <li className="flex items-start gap-3 text-sm text-theme-muted">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-zinc-400" />
              <span>{formatWhen(ev)}</span>
            </li>
            {ev.time && (
              <li className="flex items-start gap-3 text-sm text-theme-muted">
                <Clock size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                <span>{ev.time} часот</span>
              </li>
            )}
            <li className="flex items-start gap-3 text-sm text-theme-muted">
              <MapPin size={16} className="mt-0.5 shrink-0 text-zinc-400" />
              <span>{ev.location}</span>
            </li>
          </ul>

          {ev.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
              {ev.description}
            </p>
          )}

          {ev.poll && <EventPoll eventId={ev._id} poll={ev.poll} />}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
            <EventInterestButton eventId={ev._id} />
            <ShareSheet
              url={shareUrl}
              title={ev.title}
              showLabel
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            />
            {/* One-click cross-post to Facebook. FB builds the preview card
                (image + title + description) from this page's OG tags, so the
                post needs no retyping — pick the МојПрилеп Page in the dialog
                and post. FB no longer supports pre-filling a custom caption. */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f66d0]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
              Сподели на Facebook
            </a>
            {ev.sourceUrl && (
              <a
                href={ev.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
                <ExternalLink size={14} /> Повеќе
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
