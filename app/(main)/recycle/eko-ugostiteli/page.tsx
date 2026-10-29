import type { Metadata } from "next";
import { ExternalLink, Phone } from "lucide-react";
import { createPublicClient } from "../../../../lib/supabase/public";
import {
  PAKOMAK_CONTACT,
  PUBLIC_GREEN_VENUE_COLUMNS,
  VENUE_KIND_PLURALS,
  type GreenVenueKind,
  type PublicGreenVenue,
} from "../../../../lib/recycle";
import VenueGroup from "../../../../components/recycle/VenueGroup";

// Admin edits revalidate this path on demand; the timer is only a fallback.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Еко угостители — кафулиња и ресторани што рециклираат",
  description:
    "Кафулиња, ресторани и хотели во Прилеп што го селектираат стаклото со Пакомак. Поддржи ги еко угостителите.",
  alternates: { canonical: "/recycle/eko-ugostiteli" },
  openGraph: {
    title: "Еко угостители во Прилеп",
    description: "Објекти што го селектираат стаклото со Пакомак — поддржи ги.",
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
          Кафулиња, ресторани и хотели во Прилеп што го селектираат стаклото со <strong>Пакомак</strong> наместо да заврши на депонија. Поддржи ги — испиј го
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
        <div className="space-y-2">
          {groups.map((g) => (
            <VenueGroup key={g.kind} title={VENUE_KIND_PLURALS[g.kind]} venues={g.list} />
          ))}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">Вашиот објект сака да селектира?</h2>
        <p className="text-sm leading-relaxed text-teal-900/80">
          Договорот за селектирање и подигање на стаклото се склучува директно со
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
