// ── Рециклажни точки: стакло + хартија + пластика на една мапа ─────────────────
//
// Контејнерите од различен вид обично стојат еден до друг. Тука ги спојуваме
// оние на помалку од SITE_RADIUS_M метри во една „точка“ — еден пин на мапата
// што покажува кои видови ги има и колку.

import { GLASS_CONTAINERS } from "./glassContainers";
import { RECYCLE_BINS } from "./recycleBins";

export type RecycleKind = "glass" | "paper" | "plastic";

export const RECYCLE_KINDS: RecycleKind[] = ["glass", "paper", "plastic"];

export interface RecycleSite {
  /** id на првиот контејнер во точката — стабилен додека не се смени листата. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Број на контејнери по вид (0 = го нема). */
  counts: Record<RecycleKind, number>;
  photos?: string[];
}

const SITE_RADIUS_M = 15;

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  // Equirectangular is plenty at city scale.
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return Math.sqrt(x * x + y * y) * 111320;
}

function buildSites(): RecycleSite[] {
  // Glass first, so a site sits on (and is named after) its glass container.
  const items = [
    ...GLASS_CONTAINERS.map((g) => ({ ...g, kind: "glass" as const, count: 1 })),
    ...RECYCLE_BINS.map((b) => ({ ...b, count: b.count ?? 1 })),
  ];
  const sites: RecycleSite[] = [];
  for (const it of items) {
    const site = sites.find((s) => meters(s, it) < SITE_RADIUS_M);
    if (site) {
      site.counts[it.kind] += it.count;
      continue;
    }
    sites.push({
      id: it.id,
      name: it.name,
      lat: it.lat,
      lng: it.lng,
      counts: { glass: 0, paper: 0, plastic: 0, [it.kind]: it.count },
      photos: "photos" in it ? it.photos : undefined,
    });
  }
  return sites;
}

export const RECYCLE_SITES: RecycleSite[] = buildSites();

/** Вкупно контејнери од даден вид низ градот. */
export function kindTotal(kind: RecycleKind): number {
  return RECYCLE_SITES.reduce((n, s) => n + s.counts[kind], 0);
}
