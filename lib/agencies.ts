import type { Category } from "./types/database";

/**
 * Single source of truth for the institution ↔ category mapping. Mirrors the DB
 * tables `agencies` / `agency_categories` (supabase/add_agencies.sql). UI labels
 * and routing both derive from here so they never drift.
 */
export type AgencyId =
  | "vodovod"
  | "komunalec"
  | "osvetluvanje"
  | "evn"
  | "transport_parking"
  | "municipality";

export interface Agency {
  id: AgencyId;
  name: string;
  sort: number;
}

export const AGENCIES: Record<AgencyId, Agency> = {
  vodovod: { id: "vodovod", name: "Водовод", sort: 1 },
  komunalec: { id: "komunalec", name: "Комуналец", sort: 2 },
  osvetluvanje: { id: "osvetluvanje", name: "Јавно осветлување", sort: 3 },
  // The national distributor — household supply, not street lighting. Unlike
  // the others it has no operator account and handles no issue category; an
  // admin republishes its outage notices by hand.
  evn: { id: "evn", name: "ЕВН Македонија", sort: 4 },
  transport_parking: {
    id: "transport_parking",
    name: "Јавен превоз и паркинзи",
    sort: 5,
  },
  municipality: { id: "municipality", name: "Општина Прилеп", sort: 6 },
};

export const AGENCY_LIST: Agency[] = Object.values(AGENCIES).sort(
  (a, b) => a.sort - b.sort,
);

/** Which agency handles each issue category. */
export const AGENCY_BY_CATEGORY: Record<Category, AgencyId> = {
  water: "vodovod",
  garbage: "komunalec",
  park: "komunalec",
  power: "osvetluvanje",
  transport: "transport_parking",
  parking: "transport_parking",
  road: "municipality",
  negligent: "municipality",
  vehicles: "municipality",
  polluters: "municipality",
  traffic_lights: "municipality",
  traffic_signs: "municipality",
  admin: "municipality",
  other: "municipality",
};

/**
 * Notification inbox per agency. ⚠️ TEMPORARY — every agency currently routes to
 * the shared mojpprilep@gmail.com inbox until each institution gives us its real
 * address; replace per-agency below as they come in.
 */
export const AGENCY_EMAIL: Record<AgencyId, string> = {
  vodovod: "mojpprilep@gmail.com",
  komunalec: "mojpprilep@gmail.com",
  osvetluvanje: "mojpprilep@gmail.com",
  // Not a typo: EVN handles no issue category, so nothing routes here. The key
  // exists only because this map must cover every AgencyId.
  evn: "mojpprilep@gmail.com",
  transport_parking: "mojpprilep@gmail.com",
  municipality: "mojpprilep@gmail.com",
};

/**
 * Recipients for Комуналец requests sent from the utility/garbage form — the
 * agency's own press inbox plus our shared inbox, so nothing is missed.
 */
export const KOMUNALEC_REQUEST_RECIPIENTS: string[] = [
  "presskomunalec@yahoo.com",
  "mojpprilep@gmail.com",
];

/**
 * Viber / WhatsApp click-to-chat numbers per agency. Numbers are in plain
 * international form WITHOUT the leading "+" or spaces (e.g. "38970123456");
 * the UI builds `wa.me/<n>` and `viber://chat?number=%2B<n>` from them.
 *
 * ⚠️ PLACEHOLDER — replace the Комуналец number(s) with the real one before
 * launch. Leave a channel empty/undefined to hide that button.
 */
export interface AgencyContact {
  viber?: string;
  whatsapp?: string;
}

export const AGENCY_CONTACT: Partial<Record<AgencyId, AgencyContact>> = {
  komunalec: {
    // Комуналец mobile line (076/207-113), also used for stray-dog reports.
    viber: "38976207113",
    whatsapp: "38976207113",
  },
};

/** Display name of the institution responsible for a category. */
export function companyForCategory(category: Category): string {
  return AGENCIES[AGENCY_BY_CATEGORY[category]].name;
}

/**
 * Display name for an agency id, or null if it isn't one we know.
 * `id` is `text` in the DB, so callers can pass anything.
 */
export function agencyName(id: string | null | undefined): string | null {
  if (!id) return null;
  return AGENCIES[id as AgencyId]?.name ?? null;
}

/**
 * The agency an `/agency/<id>` link points at — used to attribute an
 * announcement to the institution that published it rather than to the staff
 * account that pressed the button.
 */
export function agencyNameFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const m = /^\/agency\/([^/?#]+)/.exec(link);
  return m ? agencyName(decodeURIComponent(m[1])) : null;
}

/** Does the given agency handle the given category? */
export function agencyHandlesCategory(
  agencyId: string | null | undefined,
  category: Category,
): boolean {
  if (!agencyId) return false;
  return AGENCY_BY_CATEGORY[category] === agencyId;
}
