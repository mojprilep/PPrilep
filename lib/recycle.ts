/**
 * Еко угостители — venues that sort glass / cans with ПАКОМАК, entered by
 * the admin from ПАКОМАК's data (see supabase/add_green_venues.sql).
 */

export type GreenVenueKind = "cafe" | "restaurant" | "bar" | "hotel" | "other";

/** What everyone sees (view green_venues_public). */
export interface PublicGreenVenue {
  id: number;
  name: string;
  kind: GreenVenueKind;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  glass: boolean;
  cans: boolean;
  partner_since: string | null;
}

/** The full admin row. */
export interface GreenVenue extends PublicGreenVenue {
  edb: string | null;
  pakomak_ref: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const PUBLIC_GREEN_VENUE_COLUMNS =
  "id, name, kind, address, lat, lng, phone, website, glass, cans, partner_since";

export const VENUE_KIND_LABELS: Record<GreenVenueKind, string> = {
  cafe: "Кафе",
  restaurant: "Ресторан",
  bar: "Бар",
  hotel: "Хотел",
  other: "Друго",
};

/** Plural headings for the grouped public list. */
export const VENUE_KIND_PLURALS: Record<GreenVenueKind, string> = {
  cafe: "Кафулиња",
  restaurant: "Ресторани",
  bar: "Барови",
  hotel: "Хотели",
  other: "Други објекти",
};

/**
 * Where venues that want to join are sent. ПАКОМАК signs the deal with them
 * directly — we only promote the venues afterwards.
 * TODO(user): confirm ПАКОМАК's phone / sign-up form for Прилеп.
 */
export const PAKOMAK_CONTACT = {
  website: "https://pakomak.com.mk",
  phone: null as string | null,
  form: null as string | null,
};

export function venueMapsUrl(v: Pick<PublicGreenVenue, "lat" | "lng" | "address" | "name">): string {
  const q = v.lat != null && v.lng != null ? `${v.lat},${v.lng}` : [v.name, v.address, "Прилеп"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Make "instagram.com/x" or "@x" clickable. */
export function websiteUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("@")) return `https://instagram.com/${s.slice(1)}`;
  return `https://${s}`;
}
