import type { Metadata } from "next";
import { ExternalLink, Globe, MapPin, Phone } from "lucide-react";
import { createPublicClient } from "../../../../lib/supabase/public";
import {
  PAKOMAK_CONTACT,
  PUBLIC_GREEN_VENUE_COLUMNS,
  VENUE_KIND_PLURALS,
  venueMapsUrl,
  websiteUrl,
  type GreenVenueKind,
  type PublicGreenVenue,
} from "../../../../lib/recycle";

// Admin edits revalidate this path on demand; the timer is only a fallback.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Еко угостители — кафулиња и ресторани што рециклираат",
  description:
    "Кафулиња, ресторани, барови и хотели во Прилеп што го селектираат стаклото и лименките со Пакомак. Поддржи ги еко угостителите.",
  alternates: { canonical: "/recycle/eko-ugostiteli" },
  openGraph: {
    title: "Еко угостители во Прилеп",
    description: "Објекти што го селектираат стаклото и лименките со Пакомак — поддржи ги.",
    url: "/recycle/eko-ugostiteli",
    type: "article",
  },
};

const KIND_ORDER: GreenVenueKind[] = ["cafe", "restaurant", "bar", "hotel", "other"];

async function loadVenues(): Promise<PublicGreenVenue[]> {
  const { data, error } = await createPublicClient()
    .from("green_venues_public")
    .select(PUBLIC_GREEN_VENUE_COLUMNS)
    .order("name");
  if (error) console.error("[recycle/eko-ugostiteli]", error.message);
  return (data ?? []) as PublicGreenVenue[];
}

function VenueCard({ v }: { v: PublicGreenVenue }) {
  const since = v.partner_since ? new Date(`${v.partner_since}T12:00:00`).getFullYear() : null;
  return (
    <li className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">{v.name}</p>
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {(v.address || (v.lat != null && v.lng != null)) && (
          <a
            href={venueMapsUrl(v)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-teal-700 hover:underline">
            <MapPin size={11} /> {v.address || "Види на мапа"}
          </a>
        )}
        {v.phone && (
          <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
            <Phone size={11} /> {v.phone}
          </a>
        )}
        {v.website && (
          <a
            href={websiteUrl(v.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-teal-700 hover:underline">
            <Globe size={11} /> веб / мрежи
          </a>
        )}
      </div>
      {since && <p className="text-[11px] text-zinc-500">Селектира со Пакомак од {since}</p>}
    </li>
  );
}

export default async function GreenVenuesPage() {
  const venues = await loadVenues();
  const groups = KIND_ORDER.map((k) => ({ kind: k, list: venues.filter((v) => v.kind === k) })).filter(
    (g) => g.list.length > 0,
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-theme-heading">🌿 Еко угостители</h1>
        <p className="text-sm text-theme-muted">
          Кафулиња, ресторани, барови и хотели во Прилеп што го селектираат стаклото и лименките
          со <strong>Пакомак</strong> наместо да завршат на депонија. Поддржи ги — испиј го
          следното кафе кај нив.
        </p>
      </header>

      {venues.length > 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="text-lg">{venues.length}</strong>{" "}
          {venues.length === 1 ? "објект селектира" : "објекти селектираат"} отпад во Прилеп.
        </p>
      )}

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Листата наскоро ќе биде објавена.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.kind} className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              {VENUE_KIND_PLURALS[g.kind]} <span className="font-normal text-zinc-500">({g.list.length})</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.list.map((v) => (
                <VenueCard key={v.id} v={v} />
              ))}
            </ul>
          </section>
        ))
      )}

      <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">Вашиот објект сака да селектира?</h2>
        <p className="text-sm leading-relaxed text-teal-900/80">
          Договорот за селектирање и подигање на стаклото и лименките се склучува директно со
          Пакомак. Јавете им се — откако ќе почнете, објектот се појавува на оваа листа.
        </p>
        <div className="flex flex-wrap gap-2">
          {PAKOMAK_CONTACT.phone && (
            <a
              href={`tel:${PAKOMAK_CONTACT.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              <Phone size={14} /> {PAKOMAK_CONTACT.phone}
            </a>
          )}
          {PAKOMAK_CONTACT.form && (
            <a
              href={PAKOMAK_CONTACT.form}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              Пополни формулар <ExternalLink size={13} />
            </a>
          )}
          <a
            href={PAKOMAK_CONTACT.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100">
            pakomak.com.mk <ExternalLink size={13} />
          </a>
        </div>
      </section>
    </div>
  );
}
