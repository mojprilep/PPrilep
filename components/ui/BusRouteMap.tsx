"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Bus, ChevronDown, Check, Gauge, Clock, X, Sun, Moon, Info, MapPin } from "lucide-react";
import { BUS_ROUTES, BUS_STOPS } from "../../lib/data/busRoutes";
import {
  timetableForStop,
  nextDepartureAt,
  nextDeparturesAtStop,
  GRACE_MIN,
  hhmmToMin,
  isSundayService,
  activeServiceNotice,
  SUNDAY_ROUTE_ID,
  type StopSchedule,
} from "../../lib/data/busTimetables";
import { useAuthContext } from "../../lib/context/AuthContext";
import { OWNER_EMAIL, FLEET_OPERATOR_EMAIL } from "../../lib/config/owner";
import {
  buildGeom,
  snapToLine,
  pointAt,
  bearingAt,
  angleDiff,
  type RouteGeom,
  type LngLat,
} from "../../lib/geo/lineFollow";
import { COOPERATIVE_MAP_OPTIONS } from "../../lib/map/cooperative";

// Tight extent covering every route, so the map can't be panned or zoomed out
// beyond the area the buses actually serve. Derived from the route geometry so
// it stays correct if lines are edited.
const ROUTE_EXTENT = (() => {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const r of BUS_ROUTES)
    for (const [lng, lat] of r.path) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  return { minLng, minLat, maxLng, maxLat };
})();

// What we fit the view to (defines the zoom-out floor).
const FIT_BOUNDS: [[number, number], [number, number]] = [
  [ROUTE_EXTENT.minLng, ROUTE_EXTENT.minLat],
  [ROUTE_EXTENT.maxLng, ROUTE_EXTENT.maxLat],
];

// Panning limit — a little looser than the fit so the fitted view isn't clamped.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [ROUTE_EXTENT.minLng - 0.03, ROUTE_EXTENT.minLat - 0.03],
  [ROUTE_EXTENT.maxLng + 0.03, ROUTE_EXTENT.maxLat + 0.03],
];

// Town centre (mid-point of the served extent) + default zoom levels. The map
// opens zoomed IN here rather than fitting the whole network; if the visitor
// grants location we ease to them.
const TOWN_CENTER: [number, number] = [
  (ROUTE_EXTENT.minLng + ROUTE_EXTENT.maxLng) / 2,
  (ROUTE_EXTENT.minLat + ROUTE_EXTENT.maxLat) / 2,
];
const DEFAULT_VIEW_ZOOM = 14;
const USER_VIEW_ZOOM = 15;
// Only recentre on the visitor when they're within the served area — someone
// browsing from another city shouldn't have the map yanked off the network.
function withinExtent(ll: [number, number]): boolean {
  return (
    ll[0] >= ROUTE_EXTENT.minLng - 0.03 &&
    ll[0] <= ROUTE_EXTENT.maxLng + 0.03 &&
    ll[1] >= ROUTE_EXTENT.minLat - 0.03 &&
    ll[1] <= ROUTE_EXTENT.maxLat + 0.03
  );
}

// Metres between two [lng, lat] points (haversine) — for finding the stop
// closest to the visitor. Only suggest a stop within this radius; beyond it the
// visitor isn't really "at" a stop and the hint would be noise.
const NEAREST_MAX_M = 1500;
function distMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// "240 м" under a km, "1.2 км" above.
function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1)} км`;
}

// The visitor's own location marker: a solid blue core with a white ring and a
// soft pulse that expands and fades on a loop (via the Web Animations API — no
// extra CSS). Bigger and livelier than a plain dot.
function makeUserEl(): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = "position:relative;width:22px;height:22px;pointer-events:none;z-index:9999;";
  const ring = document.createElement("div");
  ring.style.cssText = "position:absolute;inset:0;border-radius:999px;background:#2563eb;";
  ring.animate(
    [
      { transform: "scale(1)", opacity: "0.45" },
      { transform: "scale(3)", opacity: "0" },
    ],
    { duration: 1800, iterations: Infinity, easing: "ease-out" },
  );
  const core = document.createElement("div");
  core.style.cssText =
    "position:absolute;inset:0;border-radius:999px;background:#2563eb;" +
    "border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);";
  root.appendChild(ring);
  root.appendChild(core);
  return root;
}

// Switchable basemaps (OpenFreeMap). Users pick between the blue ("fiord") and
// the light ("positron") basemaps.
const MAP_STYLES = {
  fiord: "https://tiles.openfreemap.org/styles/fiord",
  positron: "https://tiles.openfreemap.org/styles/positron",
} as const;
type MapStyleId = keyof typeof MAP_STYLES;
const DEFAULT_STYLE: MapStyleId = "positron"; // light/white map by default

function readSavedStyle(): MapStyleId {
  if (typeof window === "undefined") return DEFAULT_STYLE;
  try {
    const v = localStorage.getItem("pp_map_style");
    return v === "positron" || v === "fiord" ? v : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

// ── Live buses ────────────────────────────────────────────────────────────────
type LiveBus = {
  id: number;
  label: string;
  routeId: string;
  lat: number;
  lng: number;
  speed: number | null;
  course: number | null;
  lastSeen: string | null;
  offline?: boolean; // owner endpoint only: bus is out of service, parked at last fix
};

// Line geometry, precomputed once, for snapping + smooth following.
const ROUTE_GEOM: Record<string, RouteGeom> = Object.fromEntries(
  BUS_ROUTES.map((r) => [r.id, buildGeom(r.path as LngLat[])]),
);

// Each route's stops, projected onto the line and sorted by distance along it,
// so we can tell which stop a bus just passed and which it's heading to.
// Derive each route's stops from the SAME source the map dots use — every stop
// whose `routeIds` includes this route — so the panel's prev/next can never
// disagree with what's drawn. Order in the data is irrelevant: we sort by
// distance along the line.
const ROUTE_STOPS: Record<string, { name: string; along: number }[]> =
  Object.fromEntries(
    BUS_ROUTES.map((r) => {
      const g = ROUTE_GEOM[r.id];
      const stops = BUS_STOPS.filter((s) => s.routeIds.includes(r.id))
        .map((s) => ({
          name: s.name,
          along: g ? snapToLine(g, s.coordinates[0], s.coordinates[1]).along : 0,
        }))
        .sort((a, b) => a.along - b.along);
      return [r.id, stops];
    }),
  );

// Previous (last passed) and next (upcoming) stop for a bus at `along`, given the
// direction it's running the line.
function aroundStops(
  routeId: string,
  along: number,
  forward: boolean,
): { prev: string | null; next: string | null } {
  const stops = ROUTE_STOPS[routeId];
  if (!stops?.length) return { prev: null, next: null };
  let lower: string | null = null; // greatest along ≤ current
  let upper: string | null = null; // smallest along > current
  for (const s of stops) {
    if (s.along <= along) lower = s.name;
    else {
      upper = s.name;
      break;
    }
  }
  return forward ? { prev: lower, next: upper } : { prev: upper, next: lower };
}

// Trackers report every ~3-30s and the endpoint is edge-cached for 5s, so
// polling much faster than 10s buys nothing. All viewers share the cached copy,
// so a shorter poll costs edge hits, not origin runs. Cadence adapts:
//  • ACTIVE  — buses on the map: 10s.
//  • QUIET   — no buses, but within ENGINE_OFF_GRACE of the last one going
//              offline: 60s, staying attentive in case one's still finishing up.
//  • DORMANT — engines have been off for >15 min (end of service), or none seen
//              yet: a slow 5-min heartbeat, just enough to notice buses returning
//              (or the first one of the day) without spending requests all evening.
// Off-hours fetches are skipped entirely, so those ticks cost nothing.
const ACTIVE_POLL_MS = 10_000;
const QUIET_POLL_MS = 60_000;
const DORMANT_POLL_MS = 5 * 60_000;
// End active fetching this long after the last bus turns off its engine (goes
// offline). Driven by the live signal rather than a fixed clock time, so it
// auto-adjusts to the seasonal end of service instead of hardcoding e.g. 16:30.
const ENGINE_OFF_GRACE_MS = 15 * 60_000;

// Auto-pause polling after this long with zero interaction. A tab left open and
// visible (a pinned tab, a second monitor, or a forgotten owner window) otherwise
// keeps firing a request every poll around the clock; this caps that waste.
// 3 min is short enough to matter but long enough that someone quietly watching
// their bus approach isn't paused mid-wait — and any move/tap resumes instantly.
// In dev it drops to 30s: a forgotten `next dev` tab is the most common way to
// quietly burn requests while working, so pause it fast locally.
const IDLE_MS =
  process.env.NODE_ENV === "production" ? 3 * 60_000 : 30_000;

// Service window (local time). Outside it the public map skips fetching entirely
// — no bus runs and the server also short-circuits the endpoint off-hours, so
// this keeps the client from even asking. Keep in sync with OPEN_MIN/CLOSE_MIN in
// app/api/buses/positions/route.ts. The owner is exempt (keeps watching parked
// buses via the admin endpoint).
const SERVICE_START_MIN = 6 * 60; // 06:00
const SERVICE_END_MIN = 20 * 60; // 20:00
function inServiceHours(now: Date = new Date()): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= SERVICE_START_MIN && m <= SERVICE_END_MIN;
}

// Operating hours: during the day the live map must stay live no matter what, so
// a brief stop (a tire change, a layover, heavy traffic) can never let the
// viewer's tab quietly auto-pause and freeze on a stale frame. Between 06:00 and
// 20:00 the inactivity pause is disabled outright. Only applies in production —
// dev keeps the fast pause so a forgotten `next dev` tab still stops. Outside
// these hours the normal idle-pause returns to cap request cost.
const NO_IDLE_START_MIN = 6 * 60; // 06:00
const NO_IDLE_END_MIN = 20 * 60; // 20:00
function inNoIdleHours(now: Date = new Date()): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= NO_IDLE_START_MIN && m < NO_IDLE_END_MIN;
}
const STALE_MS = 5 * 60_000; // no fix in 5 min → grey out
const SNAP_MAX_M = 75; // snap to the line within this gap (route polyline is coarse
// + GPS jitters, so 45m detached the bus too eagerly); else show raw point

// ── Motion model: forward prediction (dead reckoning) ──────────────────────────
// Instead of replaying the past (tweening from the previous fix to the latest —
// which leaves the marker ~one reporting interval behind, and MORE behind for a
// bus that reports every 30s than one every 7s), we project the latest fix
// FORWARD along the route by speed × time-since-fix. The marker estimates where
// the bus is *now*, so lag is small and uniform across the fleet regardless of
// each tracker's interval. When the next fix lands we re-anchor and ease to it.
const SMOOTH_TAU_S = 1.1; // easing time constant: how gently the marker chases its
// target. Larger = a fix-time correction glides in over a couple seconds instead
// of snapping (the visible "jump" on a new GPS signal); smaller = snappier.
const PREDICT_HORIZON_S = 40; // cap dead reckoning: if a fix is missed, stop
// projecting after this long so a bus can't be flung across town on stale speed.
const MAX_SPEED_MPS = 30; // ~108 km/h clamp on the projection speed (reject junk).
const PREDICT_SPEED_FACTOR = 0.85; // under-predict slightly so the marker tends to
// sit just BEHIND reality — corrections then land ahead of it (a natural forward
// catch-up) instead of behind it (which would need an unnatural reverse).
const GREY = "#94a3b8";

// Per-bus animation state — lives in a ref, mutated by the rAF loop (not React).
type BusAnim = {
  routeId: string;
  label: string;
  color: string;
  onRoute: boolean;
  forward: boolean;
  // Prediction anchor = the latest fix. fixRecvT is the CLIENT clock time we
  // applied it (not the device/server timestamp), so extrapolation is immune to
  // tracker clock skew.
  fixAlong: number; // onRoute: distance along the line at the fix
  fixLngLat: LngLat; // off-route: raw fix coordinate
  fixRecvT: number; // ms, Date.now() when this fix was applied
  speedMps: number; // ground speed used to project the marker forward (0 = parked)
  // Rendered state, mutated every frame by the rAF loop.
  renderAlong: number;
  renderLngLat: LngLat;
  bearing: number;
  // meta
  speed: number | null;
  lastSeen: string | null;
  fixKey: string; // dedupe identical fixes between polls
};

type BusEls = {
  marker: maplibregl.Marker;
  root: HTMLDivElement; // outer wrapper given to MapLibre (it owns the position transform)
  pill: HTMLDivElement; // the coloured pill — scaled with zoom (own transform)
  numEl: HTMLSpanElement; // line number inside the white circle
};

// Marker size as a function of zoom: tiny when zoomed out, growing as you zoom
// in, but capped well below the old fixed size. Applied as a CSS scale on the
// pill (the wrapper keeps MapLibre's position transform untouched).
// The marker is built at its largest (zoomed-in) size and scaled DOWN when
// zoomed out. Downscaling a transform stays crisp; upscaling past the
// element's native size is what blurs the whole pill.
const markerScale = (zoom: number) => {
  const t = (zoom - 12) / (17 - 12); // 0 at z12 (≈fitted) … 1 at z17
  return 0.5 + Math.max(0, Math.min(1, t)) * 0.5; // 0.5 … 1.0
};

// Mix a #rrggbb colour toward white. t=0 → the colour, t=1 → white. Used to make
// the "lighter" end of each line's animated rail from the line's own colour.
function tint(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Each line gets its own "lane": a constant screen-pixel offset perpendicular to
// the route so overlapping lines render side-by-side (transit-map style) instead
// of stacking. Spread symmetrically around centre by route index.
const LANE_GAP = 4; // px between adjacent lanes
// The Недела line rides the centre (no lane): it's the only line shown on its
// service day, and a non-zero offset would split its out-and-back loop
// (Макпетрол) into two parallel lines, since the offset flips side with the
// direction of travel.
const LANE_ROUTES = BUS_ROUTES.filter((r) => r.id !== SUNDAY_ROUTE_ID);
const laneOffset = (routeId: string): number => {
  const i = LANE_ROUTES.findIndex((r) => r.id === routeId);
  if (i < 0) return 0;
  return (i - (LANE_ROUTES.length - 1) / 2) * LANE_GAP;
};

// Stop pins are coloured by their line(s). A stop served by several lines shows
// a pin split into vertical bands — one per distinct serving-line colour — so
// interchange stops (e.g. Болница on Линија 1 + 2) read as multi-line at a glance.
// Colours of the lines serving this stop — restricted to `active` when given,
// so a stop shows only the bands of the currently-selected lines (e.g. only
// yellow when just the Недела line is on, even if Линија 2 also stops there).
const stopPinColors = (
  stop: (typeof BUS_STOPS)[number],
  active?: Set<string>,
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of BUS_ROUTES) {
    if (!stop.routeIds.includes(r.id)) continue;
    if (active && !active.has(r.id)) continue;
    if (seen.has(r.color)) continue;
    seen.add(r.color);
    out.push(r.color);
  }
  return out.length ? out : ["#27272a"];
};
// Every ordered non-empty subset of a colour list — the combos an active-line
// subset can produce, so all needed pin images exist regardless of selection.
const colorSubsets = (colors: string[]): string[][] => {
  const out: string[][] = [];
  for (let mask = 1; mask < 1 << colors.length; mask++) {
    const sub = colors.filter((_, i) => mask & (1 << i));
    out.push(sub);
  }
  return out;
};
// One pin image per distinct colour-combination that can occur (any subset of
// each stop's serving lines, plus the neutral fallback).
const STOP_PIN_COMBOS: string[][] = Array.from(
  new Map(
    [["#27272a"], ...BUS_STOPS.flatMap((s) => colorSubsets(stopPinColors(s)))].map(
      (c) => [c.join("|"), c] as const,
    ),
  ).values(),
);
const STOP_IMG_PREFIX = "bus-stop-";
const stopImageName = (colors: string[]) => `${STOP_IMG_PREFIX}${colors.join("|")}`;

// Stop features for the map source. `pinImg` is recomputed from the active
// lines so a stop's colour bands match the current selection; the source is
// re-fed via setData whenever the selection changes.
const buildStopFeatures = (
  active: Set<string>,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: "FeatureCollection",
  features: BUS_STOPS.map((stop) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: stop.coordinates },
    properties: {
      id: stop.id,
      name: stop.name,
      routeIds: stop.routeIds.join(","),
      pinImg: stopImageName(stopPinColors(stop, active)),
    },
  })),
});

// The stop icon's inner markup (public/bus-stop.svg, viewBox 0 0 24 24), inlined
// so the popup can render it in the line's colour without a second request.
// Children inherit `fill` from the parent <svg>, so colouring is one attribute.
const STOP_ICON_VIEWBOX = "0 0 24 24";
const STOP_ICON_INNER =
  '<path d="m15.5 7h-7a.50034.50034 0 0 0 -.5.5v3.091a22.81158 22.81158 0 0 0 4 .409 22.81158 22.81158 0 0 0 4-.409v-3.091a.50034.50034 0 0 0 -.5-.5z"/>' +
  '<circle cx="14" cy="14" r="1"/><circle cx="10" cy="14" r="1"/>' +
  '<path d="m12 0a12 12 0 1 0 12 12 12.01375 12.01375 0 0 0 -12-12zm6 10.5a.5.5 0 0 1 -1 0v5a1.49758 1.49758 0 0 1 -1 1.4079v.5921a.49971.49971 0 0 1 -.5.5h-1a.49971.49971 0 0 1 -.5-.5v-.5h-4v.5a.49971.49971 0 0 1 -.5.5h-1a.49971.49971 0 0 1 -.5-.5v-.5921a1.49758 1.49758 0 0 1 -1-1.4079v-5a.5.5 0 0 1 -1 0v-1a.49971.49971 0 0 1 .5-.5h.5v-1.5a1.50164 1.50164 0 0 1 1.5-1.5h7a1.50164 1.50164 0 0 1 1.5 1.5v1.5h.5a.49971.49971 0 0 1 .5.5z"/>';

// Rasterise the (monochrome) pin image recoloured to `color`, for map.addImage.
// Drawn at 2x for crispness (paired with pixelRatio: 2). A solid white disc is
// painted behind it so the icon's transparent cut-outs (the bus "windows") read
// as white instead of showing the basemap through — clean, not see-through.
function recolorIcon(img: HTMLImageElement, colors: string[], px: number): ImageData {
  // Recolour the icon on its own canvas. Paint the colour bands as opaque
  // rectangles first (plain source-over), then clip them to the icon's alpha in a
  // single destination-in pass. Per-band source-in would wipe the previous bands
  // (each pass clears everything outside its own rect), leaving a blank pin.
  const tmp = document.createElement("canvas");
  tmp.width = px;
  tmp.height = px;
  const tctx = tmp.getContext("2d")!;
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    tctx.fillStyle = colors[i];
    tctx.fillRect(Math.round((px * i) / n), 0, Math.ceil(px / n) + 1, px);
  }
  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(img, 0, 0, px, px);

  // Composite: white disc background, then the recoloured icon on top.
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2); // inset 2px to avoid a white rim
  ctx.fill();
  ctx.drawImage(tmp, 0, 0);
  return ctx.getImageData(0, 0, px, px);
}
const STOP_ICON_PX = 96; // source raster size (→ 48 logical px at pixelRatio 2)

// (Re)register one recoloured pin image per line colour. setStyle wipes images,
// so this runs again on every basemap swap.
function registerStopImages(map: maplibregl.Map, img: HTMLImageElement) {
  for (const colors of STOP_PIN_COMBOS) {
    const name = stopImageName(colors);
    if (map.hasImage(name)) map.removeImage(name);
    map.addImage(name, recolorIcon(img, colors, STOP_ICON_PX), { pixelRatio: 2 });
  }
}

function busTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "~15 секунди доцни сигналот од автобусот";
  if (min < 60) return `пред ${min} мин`;
  return `пред ${Math.round(min / 60)} ч`;
}

// Marker: a coloured rounded pill carrying a white circle with the line number
// and the bus photo (public/bus.png), matching the requested design.
function makeBusEl(short: string, color: string): BusEls {
  const root = document.createElement("div");
  root.style.cssText = "cursor:pointer;";

  const pill = document.createElement("div");
  // Built at the largest (zoomed-in) size; markerScale() only ever shrinks it,
  // which keeps every part of the pill sharp at all zoom levels.
  pill.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:6px 16px 6px 6px;" +
    `border-radius:999px;background:${color};border:3px solid #fff;` +
    "box-shadow:0 2px 8px rgba(0,0,0,0.3);transform-origin:center;will-change:transform;";

  const circle = document.createElement("span");
  circle.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:36px;height:36px;" +
    "flex:0 0 auto;border-radius:999px;background:#fff;font:800 22px/1 system-ui,sans-serif;";
  const numEl = document.createElement("span");
  numEl.textContent = short;
  numEl.style.color = color;
  circle.appendChild(numEl);

  const img = document.createElement("img");
  img.src = "/bus.png";
  img.alt = "";
  img.draggable = false;
  img.style.cssText = "height:24px;width:auto;display:block;flex:0 0 auto;";

  pill.appendChild(circle);
  pill.appendChild(img);
  root.appendChild(pill);
  return { marker: null as unknown as maplibregl.Marker, root, pill, numEl };
}

// One collapsible timetable section in the stop panel (Редовна линија / Недела).
// React-controlled open state — the panel re-renders on every bus poll and on a
// 30s clock tick, so relying on a native <details>'s DOM-only open flag left the
// dropdown wedged after a re-render; explicit state keeps toggling deterministic.
// `active` = this timetable runs today, so past times grey out and the next
// departure is highlighted; the off-day one renders neutral.
function TimetableSection({
  label,
  entries,
  active,
  color,
  nowMin,
}: {
  label: string;
  entries: { routeId: string; schedules: StopSchedule[] }[];
  active: boolean;
  color: string;
  nowMin: number;
}) {
  const [open, setOpen] = useState(false);
  const toMin = hhmmToMin;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-white/60 px-2.5 py-2 text-[12px] font-bold text-zinc-600">
        <span className="flex items-center gap-1.5">
          <Clock size={13} className="text-zinc-400" />
          {label}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 pt-2.5 pb-1">
          {entries.map(({ routeId, schedules }) => {
            const route = BUS_ROUTES.find((r) => r.id === routeId);
            return (
              <div key={routeId} className="flex flex-col gap-2">
                {schedules.map((sched) => {
                  // First departure still ahead of us today (if any).
                  const nextIdx = active
                    ? sched.times.findIndex((t) => toMin(t) >= nowMin)
                    : -1;
                  return (
                    <div key={sched.direction} className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        <span
                          className="inline-block h-1.5 w-4 rounded-full"
                          style={{ background: route?.color ?? color }}
                        />
                        {sched.direction}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sched.times.map((t, i) => {
                          const past = active && toMin(t) < nowMin;
                          const isNext = i === nextIdx;
                          return (
                            <span
                              key={t + i}
                              className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                                isNext
                                  ? "text-white"
                                  : past
                                    ? "bg-white/50 text-zinc-400"
                                    : "bg-white/70 text-zinc-700"
                              }`}
                              style={
                                isNext
                                  ? { background: route?.color ?? color }
                                  : undefined
                              }>
                              {t}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BusRouteMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Which bus / stop the detail panel is showing (null = closed). The panel is
  // a fixed window (left dock on lg+, bottom drawer on mobile/tablet), not
  // glued to the marker, so we only need the id — React renders the panel from
  // data. Bus and stop are mutually exclusive: opening one closes the other.
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const busStateRef = useRef<Map<number, BusAnim>>(new Map());
  const busElsRef = useRef<Map<number, BusEls>>(new Map());
  // Loaded stop-pin image (public/bus-stop.svg). Held in a ref so it can be
  // (re-)registered with the map after every basemap swap (setStyle wipes images).
  const stopImgRef = useRef<HTMLImageElement | null>(null);
  // The visitor's own pulsing location marker + the geolocation watch id, so we
  // can keep the dot in sync as they move and clean the watch up on unmount.
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  // The visitor's location in React state (mirrors the marker) so the
  // nearest-stop suggestion can react to it. `nowTick` bumps every 30s so the
  // "next bus" time rolls over even when the visitor stands still.
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  // Default line selection follows the day: Sundays/holidays (and festival
  // overrides like Пиво Фест, via isSundayService) pre-select only the Недела
  // line; the rest of the week the regular lines. The other lines still appear
  // in the filter — users can toggle any line on/off.
  const [activeRoutes, setActiveRoutes] = useState<Set<string>>(
    () =>
      new Set(
        isSundayService()
          ? [SUNDAY_ROUTE_ID]
          : BUS_ROUTES.filter((r) => r.id !== SUNDAY_ROUTE_ID).map(
              (r) => r.id,
            ),
      ),
  );
  // Mirror of activeRoutes for the map callbacks (which live outside React and
  // must re-apply visibility after a basemap swap wipes the layers).
  const activeRoutesRef = useRef(activeRoutes);
  useEffect(() => {
    activeRoutesRef.current = activeRoutes;
  }, [activeRoutes]);
  const [mapReady, setMapReady] = useState(false);
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([]);
  // Live polling pauses itself after a stretch of no interaction, so a tab left
  // open on a desk (or a forgotten owner window) stops spending requests. Any
  // interaction resumes it.
  const [idlePaused, setIdlePaused] = useState(false);

  // Basemap choice (blue Fiord ↔ light Positron), remembered per browser. Starts at the default
  // for SSR parity, then the saved choice is applied after mount (the map itself
  // is built directly from the saved style in the init effect, so no flicker).
  const [mapStyle, setMapStyle] = useState<MapStyleId>(DEFAULT_STYLE);
  const appliedStyleRef = useRef<MapStyleId>(readSavedStyle());
  useEffect(() => {
    // Defer to a microtask so this post-mount sync isn't flagged as a cascading
    // render; the map itself is already built from the saved style, so this only
    // brings the toggle highlight in line.
    const saved = readSavedStyle();
    if (saved === DEFAULT_STYLE) return;
    const t = setTimeout(() => setMapStyle(saved), 0);
    return () => clearTimeout(t);
  }, []);
  function chooseStyle(id: MapStyleId) {
    setMapStyle(id);
    try {
      localStorage.setItem("pp_map_style", id);
    } catch {
      /* ignore */
    }
  }

  // Owner-only extras: live speed in the popup, plus offline buses shown greyed
  // at their last known location. Gated to a single account (see OWNER_EMAIL).
  const { user } = useAuthContext();
  const isOwner = user?.email === OWNER_EMAIL;
  // Private fleet detail: registration plates, visible to the owner and the
  // Јавен превоз operator only. Fetched from a server-gated endpoint (the plate
  // strings never reach anyone else's browser).
  const canSeePlates = isOwner || user?.email === FLEET_OPERATOR_EMAIL;
  const [plates, setPlates] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!canSeePlates) return;
    let cancelled = false;
    fetch("/api/buses/plates", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { plates: {} }))
      .then((j) => {
        if (!cancelled) setPlates((j.plates ?? {}) as Record<number, string>);
      })
      .catch(() => {
        /* leave plates empty on a transient error */
      });
    return () => {
      cancelled = true;
      setPlates({}); // clear on sign-out / gate change so plates never linger
    };
  }, [canSeePlates]);
  const [showSpeed, setShowSpeed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("pp_admin_show_speed") === "1";
    } catch {
      return false;
    }
  });
  function toggleSpeed() {
    setShowSpeed((s) => {
      const next = !s;
      try {
        localStorage.setItem("pp_admin_show_speed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[readSavedStyle()],
      center: [21.555, 41.347],
      zoom: 13.3,
      minZoom: 11, // raised to the fitted zoom on load (see fitBounds below)
      maxZoom: 18,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
      ...COOPERATIVE_MAP_OPTIONS,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // (Re)add our route + stop layers on top of the basemap. Runs on first load
    // AND after every basemap swap (setStyle wipes custom sources/layers), so it
    // must be idempotent and re-apply the current line-visibility filter.
    const addOverlays = () => {
      const active = activeRoutesRef.current;

      // ── Route lines ──────────────────────────────────────────────────────────
      BUS_ROUTES.forEach((route) => {
        if (!map.getSource(`route-${route.id}`)) {
          map.addSource(`route-${route.id}`, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: route.path },
              properties: {},
            },
          });
        }
        const vis = active.has(route.id) ? "visible" : "none";
        // Each line sits in its own lane (constant px offset) so shared roads
        // render as parallel ribbons rather than one line hiding the others.
        const offset = laneOffset(route.id);
        // White halo so routes are legible over the basemap
        if (!map.getLayer(`route-${route.id}-halo`)) {
          map.addLayer({
            id: `route-${route.id}-halo`,
            type: "line",
            source: `route-${route.id}`,
            layout: { "line-join": "round", "line-cap": "round", visibility: vis },
            paint: {
              "line-color": "#ffffff",
              "line-width": 8,
              "line-opacity": 0.7,
              "line-offset": offset,
            },
          });
        }
        if (!map.getLayer(`route-${route.id}-line`)) {
          map.addLayer({
            id: `route-${route.id}-line`,
            type: "line",
            source: `route-${route.id}`,
            layout: { "line-join": "round", "line-cap": "round", visibility: vis },
            paint: { "line-color": route.color, "line-width": 5, "line-offset": offset },
          });
        }
      });

      // ── Bus stops ─────────────────────────────────────────────────────────────
      if (!map.getSource("bus-stops")) {
        map.addSource("bus-stops", {
          type: "geojson",
          data: buildStopFeatures(active),
        });
      }

      // Invisible large hit target — makes stops easy to tap on mobile
      if (!map.getLayer("stops-hit")) {
        map.addLayer({
          id: "stops-hit",
          type: "circle",
          source: "bus-stops",
          paint: { "circle-radius": 18, "circle-color": "transparent", "circle-opacity": 0 },
        });
      }

      // Stop pins (public/bus-stop.svg), one image per line colour. Re-register
      // them here since setStyle wipes images, then a symbol layer that picks its
      // image per-feature by line colour and grows as you zoom in.
      const stopImg = stopImgRef.current;
      if (stopImg) registerStopImages(map, stopImg);
      if (!map.getLayer("stops-sym")) {
        map.addLayer({
          id: "stops-sym",
          type: "symbol",
          source: "bus-stops",
          layout: {
            "icon-image": ["get", "pinImg"],
            "icon-anchor": "center", // round icon sits centred on the stop coordinate
            "icon-allow-overlap": true,
            "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.35, 14, 0.56, 16, 1.0],
          },
        });
      }

      // Re-apply the current stop filter (which routes are visible).
      const activeStopIds = BUS_STOPS.filter((s) =>
        s.routeIds.some((rid) => active.has(rid)),
      ).map((s) => s.id);
      const stopFilter: maplibregl.FilterSpecification = [
        "in",
        ["get", "id"],
        ["literal", activeStopIds],
      ];
      map.setFilter("stops-hit", stopFilter);
      map.setFilter("stops-sym", stopFilter);
    };

    // Stop hover/click + background-click handlers. Bound once to the map (they
    // survive style swaps), keyed by layer id which addOverlays re-creates.
    const registerInteractions = () => {
      // Bind to both the invisible tap target AND the pin itself, since the pin
      // is anchored at its tip — its head sits above the hit circle.
      const STOP_LAYERS = ["stops-hit", "stops-sym"];
      for (const layer of STOP_LAYERS) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Click → open the React stop panel (same glassy dock/drawer the bus
      // panel uses); closes the bus panel since they share the window.
      const onStopClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as { id: string };
        setSelectedBusId(null);
        setSelectedStopId(props.id);
      };
      map.on("click", "stops-hit", onStopClick);
      map.on("click", "stops-sym", onStopClick);

      // Dismiss the panel when clicking the map background
      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: STOP_LAYERS });
        if (!features.length) {
          setSelectedBusId(null);
          setSelectedStopId(null);
        }
      });
    };

    // Place / move the visitor's pulsing location dot.
    const updateUserMarker = (ll: [number, number]) => {
      setUserLoc(ll);
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maplibregl.Marker({
          element: makeUserEl(),
          anchor: "center",
        })
          .setLngLat(ll)
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat(ll);
      }
    };
    // Ask the browser for location. If granted, drop the dot, ease onto it (when
    // in the served area), and keep it in sync as they move. Denied → stay put.
    const locateUser = () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          updateUserMarker(ll);
          if (withinExtent(ll)) {
            map.easeTo({ center: ll, zoom: USER_VIEW_ZOOM, duration: 800 });
          }
          geoWatchRef.current = navigator.geolocation.watchPosition(
            (p) => updateUserMarker([p.coords.longitude, p.coords.latitude]),
            undefined,
            { enableHighAccuracy: false, maximumAge: 10_000 },
          );
        },
        undefined,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    };

    // 'style.load' fires on the initial style and again after every setStyle, so
    // re-add our overlays each time. One-time setup (framing, zoom floor, event
    // handlers) runs only on the first style load.
    let initialized = false;
    map.on("style.load", () => {
      addOverlays();
      if (!initialized) {
        initialized = true;
        // Generate stop-pin images on demand. Covers the production cold-load
        // race where the basemap style finishes before /bus-stop.svg, so the
        // symbol layer asks for an icon that isn't registered yet. Bound once —
        // it survives basemap swaps.
        map.on("styleimagemissing", (e) => {
          const id = e.id;
          if (!id.startsWith(STOP_IMG_PREFIX) || map.hasImage(id)) return;
          const src = stopImgRef.current;
          if (!src) return; // SVG not loaded yet — the load handler re-resolves
          const colors = id.slice(STOP_IMG_PREFIX.length).split("|");
          map.addImage(id, recolorIcon(src, colors, STOP_ICON_PX), { pixelRatio: 2 });
        });
        // Frame the whole network once to derive the zoom-out floor…
        map.fitBounds(FIT_BOUNDS, { padding: 24, duration: 0 });
        // Floor a bit tighter than the full-network fit so the map can't be
        // zoomed out into empty surroundings past where the buses run.
        map.setMinZoom(map.getZoom() + 0.7);
        // …then open zoomed IN on the town centre (not the whole-network fit),
        // and try to recentre on the visitor's own location if they allow it.
        map.jumpTo({
          center: TOWN_CENTER,
          zoom: Math.max(DEFAULT_VIEW_ZOOM, map.getMinZoom()),
        });
        locateUser();
        registerInteractions();
        // Scale every marker with the zoom level (small when out, larger when in).
        map.on("zoom", () => {
          const s = markerScale(map.getZoom());
          for (const el of busElsRef.current.values())
            el.pill.style.transform = `scale(${s})`;
        });
        setMapReady(true);
      }
    });

    mapRef.current = map;
    const els = busElsRef.current;
    const states = busStateRef.current;
    return () => {
      if (geoWatchRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      els.clear();
      states.clear();
    };
  }, []);

  // ── Load the stop-pin image once, then register it with the map ─────────────
  // Kept in a ref so addOverlays can re-register it after each basemap swap.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      stopImgRef.current = img;
      const map = mapRef.current;
      if (map && map.isStyleLoaded()) {
        registerStopImages(map, img);
        // Force the symbol layer to re-resolve its icons. If the basemap loaded
        // before the SVG (the prod cold-load race), the stops were laid out as
        // "image missing" and styleimagemissing won't re-fire for those ids —
        // re-setting the layout property re-lays them out now the images exist.
        if (map.getLayer("stops-sym")) {
          map.setLayoutProperty("stops-sym", "icon-image", ["get", "pinImg"]);
        }
        map.triggerRepaint();
      }
    };
    img.src = "/bus-stop.svg";
  }, []);

  // ── Swap basemap when the user picks a different style ───────────────────────
  // setStyle wipes custom layers; the 'style.load' handler above re-adds them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (appliedStyleRef.current === mapStyle) return;
    appliedStyleRef.current = mapStyle;
    map.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle, mapReady]);

  // ── Sync route layer visibility ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    BUS_ROUTES.forEach((route) => {
      const vis = activeRoutes.has(route.id) ? "visible" : "none";
      if (map.getLayer(`route-${route.id}-line`)) {
        map.setLayoutProperty(`route-${route.id}-line`, "visibility", vis);
        map.setLayoutProperty(`route-${route.id}-halo`, "visibility", vis);
      }
    });

    // Recolour each pin to the active lines' bands…
    const src = map.getSource("bus-stops") as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildStopFeatures(activeRoutes));

    // …and show only stops that belong to at least one active route.
    if (map.getLayer("stops-sym")) {
      const activeIds = BUS_STOPS.filter((s) =>
        s.routeIds.some((rid) => activeRoutes.has(rid)),
      ).map((s) => s.id);

      const filter: maplibregl.FilterSpecification = [
        "in",
        ["get", "id"],
        ["literal", activeIds],
      ];
      map.setFilter("stops-hit", filter);
      map.setFilter("stops-sym", filter);
    }
  }, [activeRoutes, mapReady]);

  // ── Poll live bus positions (only while the tab is visible) ─────────────────
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let polling = false; // guards against overlapping self-scheduled loops
    let idlePausedLocal = false; // paused specifically for inactivity
    let lastActivity = Date.now();
    let lastCount = 0; // buses seen in the last successful fetch
    let lastBusesSeenAt = 0; // ms of the last fetch that had ≥1 bus (engine on)

    // The owner gets the authenticated endpoint, which also returns offline
    // buses (parked at their last fix); everyone else gets the public one.
    // In production the public fetch goes to the Cloudflare-cached twin host
    // (buses.mojprilep.mk, ~10s edge cache) instead of same-origin www — so every
    // web viewer's poll is a free CDN hit and Vercel is touched ~once per 10s, the
    // same saving the mobile app gets. Dev stays same-origin against next dev.
    const publicUrl =
      process.env.NODE_ENV === "production"
        ? "https://buses.mojprilep.mk/api/buses/positions"
        : "/api/buses/positions";
    const url = isOwner ? "/api/buses/positions/admin" : publicUrl;

    async function load() {
      // Off-hours: no bus is running, so skip the request entirely and clear the
      // map. The loop keeps ticking (free) and resumes fetching once service
      // opens. The owner is exempt so parked buses stay watchable any time.
      if (!isOwner && !inServiceHours()) {
        if (!cancelled) setLiveBuses((prev) => (prev.length ? [] : prev));
        lastCount = 0;
        return;
      }
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const buses = (json.buses ?? []) as LiveBus[];
        if (!cancelled) setLiveBuses(buses);
        lastCount = buses.length;
        if (buses.length > 0) lastBusesSeenAt = Date.now();
      } catch {
        /* keep last known positions on a transient error */
      }
    }

    // Cadence follows the fleet: brisk while buses run, attentive for 15 min
    // after the last engine goes off, then a slow heartbeat. Off-hours ticks are
    // free (load skips the network), so their cadence only sets how fast we'd
    // notice service resuming.
    function nextDelay() {
      if (!isOwner && !inServiceHours()) return DORMANT_POLL_MS;
      // Owner idle: never freeze the fleet view — drop to the slow heartbeat so a
      // bus coming back online is still picked up within a few minutes untouched,
      // instead of the map silently stalling on a stale (offline) frame.
      if (isOwner && idlePausedLocal) return DORMANT_POLL_MS;
      if (lastCount > 0) return ACTIVE_POLL_MS;
      // Engines currently off. Stay attentive only within the grace window after
      // the last bus we saw; beyond that (end of service, or none seen yet) drop
      // to the heartbeat so an open tab doesn't fetch all evening.
      if (lastBusesSeenAt && Date.now() - lastBusesSeenAt < ENGINE_OFF_GRACE_MS) {
        return QUIET_POLL_MS;
      }
      return DORMANT_POLL_MS;
    }
    async function tick() {
      timer = null;
      await load();
      if (cancelled || !polling || document.hidden) return;
      // Non-owner idle fully stops (caps request cost on forgotten tabs); the
      // owner keeps looping at the heartbeat cadence set by nextDelay().
      if (idlePausedLocal && !isOwner) return;
      timer = setTimeout(tick, nextDelay());
    }
    function start() {
      if (polling) return;
      polling = true;
      tick(); // immediate fetch, then self-schedules
    }
    function stop() {
      polling = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function goIdle() {
      if (idlePausedLocal) return;
      idlePausedLocal = true;
      // Owner: keep polling — the already-scheduled loop downshifts to the
      // heartbeat via nextDelay(), so the fleet view never freezes and no
      // "paused" pill is shown. Everyone else fully stops (and shows the pill).
      if (isOwner) return;
      stop();
      if (!cancelled) setIdlePaused(true);
    }
    function resumeFromIdle() {
      if (!idlePausedLocal) return;
      idlePausedLocal = false;
      if (!cancelled) setIdlePaused(false);
      // Stale animation state after any pause — drop it so buses snap to their
      // real spot instead of tweening across the map.
      busStateRef.current.clear();
      if (!polling) {
        start(); // non-owner was fully stopped — restart the loop
      } else if (timer) {
        // Owner kept the heartbeat — pull the next tick to now so the active
        // cadence resumes immediately on interaction.
        clearTimeout(timer);
        timer = setTimeout(tick, 0);
      }
    }
    function onActivity() {
      lastActivity = Date.now();
      if (idlePausedLocal && !document.hidden) resumeFromIdle();
    }
    function onVisibility() {
      if (document.hidden) {
        stop();
      } else if (!idlePausedLocal || isOwner) {
        // Returning after the tab/app was hidden: rAF was paused, so the
        // animation state is stale. Drop it so the next fix places each bus
        // instantly at its real spot instead of "catching up" with a long,
        // wrong tween across the map. The owner resumes even while idle (at the
        // heartbeat cadence nextDelay picks) so their fleet view is never left
        // frozen; a non-owner idle tab stays paused until it's touched.
        if (!idlePausedLocal) lastActivity = Date.now();
        busStateRef.current.clear();
        start();
      }
    }

    // Inactivity watchdog — client-only, no network. Trips the pause once the
    // tab has been visible but untouched for IDLE_MS.
    const idleCheck = setInterval(() => {
      if (document.hidden) return;
      // Operating hours (06:00–17:00): never auto-pause — and if a pause carried
      // over from before 06:00, lift it now so the map is live for the day.
      if (inNoIdleHours()) {
        if (idlePausedLocal) resumeFromIdle();
        return;
      }
      if (idlePausedLocal) return;
      if (Date.now() - lastActivity >= IDLE_MS) goIdle();
    }, 15_000);

    const activityEvents = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "mousemove",
      "scroll",
    ] as const;
    activityEvents.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      clearInterval(idleCheck);
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOwner]);

  // ── Reconcile live buses → markers + animation state ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const els = busElsRef.current;
    const states = busStateRef.current;
    const live = new Set<number>();
    const now = Date.now();

    for (const bus of liveBuses) {
      // Hide a bus when its line is toggled off (consistent with route lines).
      if (!activeRoutes.has(bus.routeId)) continue;
      live.add(bus.id);

      const route = BUS_ROUTES.find((r) => r.id === bus.routeId);
      const baseColor = route?.color ?? "#52525b";
      // Line number for the glyph; non-numbered lines (Недела) use their initial.
      const short = route ? route.name.replace(/[^0-9]/g, "") || route.name[0] : "";
      const stale = bus.lastSeen
        ? now - new Date(bus.lastSeen).getTime() > STALE_MS
        : true;
      const color = stale ? GREY : baseColor;

      const geom = ROUTE_GEOM[bus.routeId];
      const snap = geom ? snapToLine(geom, bus.lng, bus.lat) : null;
      const onRoute = !!snap && snap.gap <= SNAP_MAX_M;

      // Ensure a marker exists.
      let e = els.get(bus.id);
      if (!e) {
        e = makeBusEl(short, baseColor);
        e.marker = new maplibregl.Marker({ element: e.root, anchor: "center" })
          .setLngLat([bus.lng, bus.lat])
          .addTo(map);
        e.pill.style.transform = `scale(${markerScale(map.getZoom())})`;
        els.set(bus.id, e);
      }
      // The pill ALWAYS carries the line colour (blue = line 2, etc.) so the line
      // is identifiable at a glance even when the bus is reassigned. Staleness is
      // shown by dimming the pill, not by greying the colour away.
      e.pill.style.background = baseColor;
      e.pill.style.opacity = stale ? "0.5" : "1";
      e.numEl.style.color = baseColor;
      e.numEl.textContent = short;

      // Click → open the React detail panel for this bus (closes any stop panel).
      e.root.onclick = (ev) => {
        ev.stopPropagation();
        setSelectedStopId(null);
        setSelectedBusId(bus.id);
      };

      // Update prediction state.
      const fixKey = bus.lastSeen ?? `${bus.lat},${bus.lng}`;
      const prev = states.get(bus.id);

      // Ground speed for forward projection: trust the reported speed
      // (km/h → m/s); fall back to distance/time between the last two fixes;
      // 0 (parked) so a stopped bus doesn't drift ahead of its fix.
      const speedMps = (() => {
        // Stale/offline: the last fix is old, so its speed is meaningless — pin
        // the marker to that fix instead of dead-reckoning a ghost forward (which
        // makes a bus that's stopped reporting look like it's still driving).
        if (stale) return 0;
        if (bus.speed != null && bus.speed > 0)
          return Math.min(bus.speed / 3.6, MAX_SPEED_MPS);
        if (prev && prev.onRoute && onRoute && prev.lastSeen && bus.lastSeen) {
          const dt =
            (new Date(bus.lastSeen).getTime() -
              new Date(prev.lastSeen).getTime()) /
            1000;
          if (dt > 0)
            return Math.min(Math.abs(snap!.along - prev.fixAlong) / dt, MAX_SPEED_MPS);
        }
        return 0;
      })();

      if (!prev) {
        // First sighting: place instantly at the fix.
        const along = onRoute ? snap!.along : 0;
        const lngLat: LngLat = onRoute ? [snap!.lng, snap!.lat] : [bus.lng, bus.lat];
        let forward = true;
        if (onRoute && geom && bus.course != null) {
          forward = angleDiff(bearingAt(geom, along, true), bus.course) <= 90;
        }
        const brg =
          onRoute && geom ? bearingAt(geom, along, forward) : bus.course ?? 0;
        states.set(bus.id, {
          routeId: bus.routeId, label: bus.label, color, onRoute, forward,
          fixAlong: along, fixLngLat: [bus.lng, bus.lat], fixRecvT: now, speedMps,
          renderAlong: along, renderLngLat: lngLat, bearing: brg,
          speed: bus.speed, lastSeen: bus.lastSeen, fixKey,
        });
      } else if (prev.fixKey !== fixKey) {
        // New fix: re-anchor the prediction. Keep the current rendered position
        // so the marker EASES to the correction (via the rAF loop) instead of
        // teleporting.
        if (onRoute && geom) {
          const newAlong = snap!.along;
          if (!prev.onRoute) prev.renderAlong = newAlong; // just re-attached to the line
          // Direction: trust the movement between fixes when meaningful, else the
          // reported course, else keep the last direction.
          prev.forward =
            Math.abs(newAlong - prev.fixAlong) > 1
              ? newAlong >= prev.fixAlong
              : bus.course != null
                ? angleDiff(bearingAt(geom, newAlong, true), bus.course) <= 90
                : prev.forward;
          prev.onRoute = true;
          prev.fixAlong = newAlong;
        } else {
          if (prev.onRoute) prev.renderLngLat = [bus.lng, bus.lat]; // just left the line
          prev.onRoute = false;
          prev.fixLngLat = [bus.lng, bus.lat];
          if (bus.course != null) prev.bearing = bus.course;
        }
        prev.routeId = bus.routeId;
        prev.label = bus.label;
        prev.color = color;
        prev.fixRecvT = now;
        prev.speedMps = speedMps;
        prev.speed = bus.speed;
        prev.lastSeen = bus.lastSeen;
        prev.fixKey = fixKey;
      } else {
        // Same fix between polls: refresh meta only — keep predicting from the
        // original fix time so motion stays continuous.
        prev.routeId = bus.routeId;
        prev.label = bus.label;
        prev.color = color;
        // If the bus has since gone stale (tracker stopped reporting), halt the
        // projection and snap it back onto its last real fix so an offline bus
        // sits still instead of coasting away on its final speed.
        if (stale && prev.speedMps !== 0) {
          prev.speedMps = 0;
          if (prev.onRoute) prev.renderAlong = prev.fixAlong;
          else prev.renderLngLat = prev.fixLngLat;
        }
      }
    }

    // Drop markers + state for buses no longer present or whose line is hidden.
    for (const [id, e] of els) {
      if (!live.has(id)) {
        e.marker.remove();
        els.delete(id);
        states.delete(id);
        // If the panel was showing this (now-gone) bus, close it.
        setSelectedBusId((cur) => (cur === id ? null : cur));
      }
    }
  }, [liveBuses, activeRoutes, mapReady, isOwner, showSpeed]);

  // ── Animate markers by predicting forward every frame ───────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let raf = 0;
    let lastT = 0;
    const tick = () => {
      const now = Date.now();
      const dt = lastT ? (now - lastT) / 1000 : 0;
      lastT = now;
      // Frame-rate-independent exponential smoothing: renderAlong chases the
      // predicted target, so a correction when a new fix lands eases in instead
      // of snapping. dt=0 on the first frame → snap straight to target.
      const smooth = dt > 0 ? 1 - Math.exp(-dt / SMOOTH_TAU_S) : 1;

      for (const [id, st] of busStateRef.current) {
        // Isolate each bus: one bad frame (e.g. a NaN coordinate from a stray
        // fix) must never throw out of tick, or the rAF loop below stops being
        // rescheduled and EVERY bus freezes until a page reload.
        try {
          const e = busElsRef.current.get(id);
          if (!e) continue;

          let lngLat: LngLat;
          if (st.onRoute) {
            const geom = ROUTE_GEOM[st.routeId];
            if (!geom) {
              lngLat = st.renderLngLat;
            } else {
              // Project the fix forward by speed × time since the fix, capped by
              // the horizon so a missed fix can't fling the marker across town.
              const elapsed = Math.min((now - st.fixRecvT) / 1000, PREDICT_HORIZON_S);
              const dir = st.forward ? 1 : -1;
              const target = Math.max(
                0,
                Math.min(
                  geom.length,
                  st.fixAlong + dir * st.speedMps * PREDICT_SPEED_FACTOR * elapsed,
                ),
              );
              const delta = target - st.renderAlong;
              // Only ever ease FORWARD (in the travel direction). If the target
              // lands behind the marker (prediction overshot, or a stray fix), we
              // HOLD — never animate a reverse, which looks like the bus driving
              // backwards. It self-heals: a forward-running bus's next fixes push
              // fixAlong past the marker, so motion resumes on its own.
              if (dir * delta > 0) {
                st.renderAlong += delta * smooth;
                st.bearing = bearingAt(geom, st.renderAlong, st.forward);
              }
              lngLat = pointAt(geom, st.renderAlong);
            }
          } else {
            // Off route: ease toward the raw fix, no forward projection.
            lngLat = [
              st.renderLngLat[0] + (st.fixLngLat[0] - st.renderLngLat[0]) * smooth,
              st.renderLngLat[1] + (st.fixLngLat[1] - st.renderLngLat[1]) * smooth,
            ];
          }
          // Guard: MapLibre throws on a non-finite LngLat. Skip this frame for
          // this bus and keep its last good position rather than crash the loop.
          if (!Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) continue;
          st.renderLngLat = lngLat;
          e.marker.setLngLat(lngLat);
        } catch {
          /* one bus glitched this frame — keep animating the rest */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapReady]);

  // Close the line dropdown when clicking anywhere outside it.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const d = detailsRef.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function toggleRoute(id: string) {
    setActiveRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Center + zoom the map onto a chosen bus's current position (its live
  // animated spot if we have it, else its last fix). Re-shows its line first.
  function flyToBus(id: number) {
    const map = mapRef.current;
    const bus = liveBuses.find((b) => b.id === id);
    if (!map || !bus) return;
    if (!activeRoutes.has(bus.routeId)) {
      setActiveRoutes((prev) => new Set(prev).add(bus.routeId));
    }
    const st = busStateRef.current.get(id);
    const center: LngLat = st ? st.renderLngLat : [bus.lng, bus.lat];
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 15.5), duration: 900, essential: true });
  }

  // Center the map on a stop and open its timetable panel — from the
  // nearest-stop suggestion.
  function flyToStop(stop: (typeof BUS_STOPS)[number]) {
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: stop.coordinates,
        zoom: Math.max(map.getZoom(), 16),
        duration: 800,
        essential: true,
      });
    }
    setSelectedBusId(null);
    setSelectedStopId(stop.id);
  }

  // The visible stop closest to the visitor (within NEAREST_MAX_M) + the next
  // departures there today, powering the nearest-stop suggestion. Recomputes as
  // they move (userLoc), when lines are toggled (activeRoutes), and every 30s
  // (nowTick) so the "next bus" time stays current.
  const nearest = useMemo(() => {
    if (!userLoc) return null;
    let best: { stop: (typeof BUS_STOPS)[number]; dist: number } | null = null;
    for (const s of BUS_STOPS) {
      if (!s.routeIds.some((rid) => activeRoutes.has(rid))) continue;
      const d = distMeters(userLoc, s.coordinates);
      if (!best || d < best.dist) best = { stop: s, dist: d };
    }
    if (!best || best.dist > NEAREST_MAX_M) return null;
    return best;
  }, [userLoc, activeRoutes]);
  const nearestDepartures = useMemo(
    () => (nearest ? nextDeparturesAtStop(nearest.stop.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowTick drives the refresh
    [nearest, nowTick],
  );

  // ── Detail panel ────────────────────────────────────────────────────────────
  // The bus the panel is showing (drops out if the bus disappears between polls).
  const selectedBus =
    selectedBusId != null
      ? liveBuses.find((b) => b.id === selectedBusId) ?? null
      : null;

  // A stop node on the vertical rail: a coloured dot (ringed so the connector
  // line reads as passing cleanly behind it) + the stop name.
  const stopNode = (
    dotColor: string,
    size: number,
    name: string | null,
    strong: boolean,
    time?: string | null,
  ) => (
    <div className="flex min-h-8 items-center gap-2.5">
      <span className="relative z-1 flex w-6 shrink-0 justify-center">
        <span
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: dotColor,
            boxShadow: "0 0 0 3px #fff",
          }}
        />
      </span>
      <span
        className="min-w-0 text-[13px]"
        style={{ color: strong ? "#18181b" : "#71717a", fontWeight: strong ? 700 : 500 }}>
        {name ?? "—"}
      </span>
      {time && (
        <span className="ml-auto shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600">
          {time}
        </span>
      )}
    </div>
  );

  // The middle node: the bus glyph on the rail + speed (owner) / time beside it.
  // When live, the glyph gently bobs toward the next stop (paired with the
  // flowing rail) to read as "on its way"; offline it sits still.
  const busNode = (color: string, bus: LiveBus, animate: boolean) => (
    <div className="flex min-h-10 items-center gap-2.5">
      <span className="relative z-1 flex w-6 shrink-0 justify-center">
        <span
          className={`flex h-7.5 w-7.5 items-center justify-center rounded-full ${
            animate ? "pp-bus-bob" : ""
          }`}
          style={{ background: color, boxShadow: "0 1px 5px rgba(0,0,0,.25),0 0 0 3px #fff" }}>
          {/* public/bus icon.svg, recoloured white to sit on the coloured dot */}
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static inline SVG glyph */}
          <img
            src="/bus%20icon.svg"
            alt=""
            width={16}
            height={16}
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </span>
      </span>
      <span className="flex flex-col gap-1">
        {isOwner && showSpeed && (
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-700">
            <Gauge size={13} /> {Math.round(bus.speed ?? 0)} км/ч
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Clock size={13} /> {busTimeAgo(bus.lastSeen)}
        </span>
      </span>
    </div>
  );

  // Inner content of the panel — shared by the desktop dock and the mobile drawer.
  const panelInner = (() => {
    if (!selectedBus) return null;
    const bus = selectedBus;
    const route = BUS_ROUTES.find((r) => r.id === bus.routeId);
    const baseColor = route?.color ?? "#52525b";
    const offline = bus.offline === true;
    const color = offline ? GREY : baseColor;

    // Prev/next only make sense when the bus sits on the line. Derive purely from
    // the latest fix (snap + course) so the panel needs no animation-ref access.
    const geom = ROUTE_GEOM[bus.routeId];
    const snap = geom ? snapToLine(geom, bus.lng, bus.lat) : null;
    // Resolve prev/next from the nearest point on the line regardless of how far
    // the raw fix sits from the polyline — otherwise GPS jitter blanks the stops.
    const forward =
      snap && geom && bus.course != null
        ? angleDiff(bearingAt(geom, snap.along, true), bus.course) <= 90
        : true;
    const { prev, next } = snap
      ? aroundStops(bus.routeId, snap.along, forward)
      : { prev: null, next: null };

    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
          <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color }}>
            {route?.name ?? ""}
            {plates[bus.id] && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-px font-mono text-[11px] font-semibold tracking-wide text-zinc-600">
                {plates[bus.id]}
              </span>
            )}
            {offline && (
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-px text-[10px] font-bold text-zinc-500">
                ОФЛАЈН
              </span>
            )}
          </span>
          <button
            onClick={() => setSelectedBusId(null)}
            title="Затвори"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
            <X size={22} />
          </button>
        </div>
        <div className="relative flex flex-col gap-2 px-4 pb-4">
          {/* Connector rail: live → a downward-flowing gradient in the line's
              colour (lighter → full); offline → a plain grey line. */}
          {offline ? (
            <div className="absolute left-6.75 top-4 bottom-4 w-0.5 bg-zinc-200" />
          ) : (
            <div
              className="pp-rail-flow absolute left-6.75 top-4 bottom-4 w-0.5"
              style={
                {
                  "--line": baseColor,
                  "--line-light": tint(baseColor, 0.6),
                } as CSSProperties
              }
            />
          )}
          {stopNode(offline ? GREY : "#cbd5e1", 11, prev, false)}
          {busNode(color, bus, !offline)}
          {stopNode(
            offline ? GREY : baseColor,
            13,
            next,
            true,
            // Scheduled time at the upcoming stop (this route + travel direction)
            next && !offline ? nextDepartureAt(bus.routeId, next, forward) : null,
          )}
        </div>
      </div>
    );
  })();

  // ── Stop panel — name, serving lines, and the возен ред for this stop ────────
  const selectedStop = selectedStopId
    ? BUS_STOPS.find((s) => s.id === selectedStopId) ?? null
    : null;

  const stopPanelInner = (() => {
    if (!selectedStop) return null;
    const routes = selectedStop.routeIds
      .map((rid) => BUS_ROUTES.find((r) => r.id === rid))
      .filter((r): r is (typeof BUS_ROUTES)[number] => !!r);
    const color = routes[0]?.color ?? "#3b82f6";
    const allTimetables = timetableForStop(selectedStop.id);

    // Two dropdowns, both always visible: Редовна линија (lines 1–3, Mon–Sat)
    // and Недела (Sundays + holidays). Only the one running today highlights
    // past/next departures.
    const sundayToday = isSundayService();
    const weekdayTimetables = allTimetables.filter(
      (t) => t.routeId !== SUNDAY_ROUTE_ID,
    );
    const sundayTimetables = allTimetables.filter(
      (t) => t.routeId === SUNDAY_ROUTE_ID,
    );

    // "Now" as minutes-since-midnight, to highlight the next departure. A run
    // stays "next" for GRACE_MIN after its time (a bus a few minutes off
    // shouldn't skip the panel to the next hour).
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes() - GRACE_MIN;

    return (
      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-1">
          <span className="flex items-center gap-2.5 min-w-0">
            <svg
              viewBox={STOP_ICON_VIEWBOX}
              width="30"
              height="30"
              fill={color}
              className="shrink-0"
              dangerouslySetInnerHTML={{ __html: STOP_ICON_INNER }}
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-bold" style={{ color }}>
                {selectedStop.name}
              </span>
              <span className="text-[12px] font-semibold text-zinc-500">
                {routes.map((r) => r.name).join(" · ")}
              </span>
            </span>
          </span>
          <button
            onClick={() => setSelectedStopId(null)}
            title="Затвори"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
            <X size={22} />
          </button>
        </div>

        {weekdayTimetables.length > 0 || sundayTimetables.length > 0 ? (
          <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-1">
            {weekdayTimetables.length > 0 && (
              // keyed by stop id so switching stops always starts collapsed
              <TimetableSection
                key={selectedStop.id + "wk"}
                label="Редовна линија"
                entries={weekdayTimetables}
                active={!sundayToday}
                color={color}
                nowMin={nowMin}
              />
            )}
            {sundayTimetables.length > 0 && (
              <TimetableSection
                key={selectedStop.id + "su"}
                label="Недела"
                entries={sundayTimetables}
                active={sundayToday}
                color={color}
                nowMin={nowMin}
              />
            )}
          </div>
        ) : (
          <div className="pb-3.5" />
        )}
      </div>
    );
  })();

  return (
    <div className="space-y-3">
      {/* Temporary service notice (e.g. festival) — shown only while an override
          is active; drives, and is driven by, the same SERVICE_OVERRIDES that
          force the Недела line. */}
      {activeServiceNotice() && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] font-semibold text-amber-900">
          <Info size={16} className="shrink-0" />
          <span>{activeServiceNotice()}</span>
        </div>
      )}

      {/* Quick bus picker — one button per active bus; flies the map to it.
          Mobile: a single row of quarter-width buttons; ≥sm: natural wrap. */}
      {liveBuses.length > 0 && (
        <div
          className="grid gap-2 sm:flex sm:flex-wrap"
          style={{
            gridTemplateColumns: `repeat(${Math.min(liveBuses.length, 4)}, minmax(0, 1fr))`,
          }}>

          {(() => {
            const sorted = [...liveBuses].sort((a, b) => {
              // Order the chips by line number (Линија 1, 2, 3…), then by bus id
              // so the per-line sequence below is stable across polls.
              const ai = BUS_ROUTES.findIndex((r) => r.id === a.routeId);
              const bi = BUS_ROUTES.findIndex((r) => r.id === b.routeId);
              const byLine =
                (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
              return byLine !== 0 ? byLine : a.id - b.id;
            });
            const lineSeq: Record<string, number> = {};
            return sorted.map((bus) => {
              const route = BUS_ROUTES.find((r) => r.id === bus.routeId);
              lineSeq[bus.routeId] = (lineSeq[bus.routeId] ?? 0) + 1;
              const short =
                route?.name.replace(/[^0-9]/g, "") || route?.name[0] || bus.label;
              // The Недела line has no number, so its chip shows the full name
              // plus a 1-based per-line index (Недела 1, Недела 2) — there are
              // only a couple of buses on it, so it fits even on mobile.
              const isNamedLine = bus.routeId === SUNDAY_ROUTE_ID;
              const fullLabel = isNamedLine
                ? `${route?.name} ${lineSeq[bus.routeId]}`
                : (route?.name ?? bus.label);
              return (
                <button
                  key={bus.id}
                  onClick={() => flyToBus(bus.id)}
                  title={`Зумирај на ${bus.label}`}
                  className="flex min-w-0 items-center justify-center gap-1 rounded-sm  bg-white px-2 py-2 text-[13px]  sm:px-3"
                  style={{ borderColor: "#000000 " }}>
                  <Bus size={15} className="shrink-0" />
                  {/* mobile: line number, or the full "Недела N" for the named
                      Sunday line; ≥sm: always the full line name */}
                  <span className="truncate sm:hidden">
                    {isNamedLine ? fullLabel : short}
                  </span>
                  <span className="hidden truncate sm:inline">{fullLabel}</span>
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Route filter — dropdown list (toggle each line's visibility) */}
      <details ref={detailsRef} className="group relative z-20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Bus size={15} className="text-zinc-400" />
            Линии на превоз
            <span className="text-[11px] font-normal text-zinc-400">
              ({activeRoutes.size}/{BUS_ROUTES.length} прикажани)
            </span>
          </span>
          <ChevronDown
            size={16}
            className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="absolute left-0 right-0 top-full z-30 mt-1 space-y-0.5 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
          {BUS_ROUTES.map((route) => {
            const active = activeRoutes.has(route.id);
            return (
              <button
                key={route.id}
                onClick={() => toggleRoute(route.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-50">
                <span
                  className="inline-block h-2 w-5 shrink-0 rounded-full transition-opacity"
                  style={{ background: route.color, opacity: active ? 1 : 0.3 }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] font-semibold ${
                      active ? "text-zinc-700" : "text-zinc-400"
                    }`}>
                    {route.name}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    {route.description}
                  </span>
                </span>
                {active ? (
                  <Check size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <span className="shrink-0 text-[10px] font-medium text-zinc-300">
                    скриено
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </details>

      {/* Nearest-stop suggestion — appears once the visitor shares location.
          Names the closest stop + next departure; click to fly there and open
          its timetable. */}
      {nearest && (
        <button
          onClick={() => flyToStop(nearest.stop)}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
              Најблиска постојка
              <span className="font-mono text-[11px] font-semibold text-zinc-400">
                {fmtDist(nearest.dist)}
              </span>
            </span>
            <span className="truncate text-sm font-bold text-zinc-800">
              {nearest.stop.name}
            </span>
          </span>
          {nearestDepartures.length > 0 ? (
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Следен
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      BUS_ROUTES.find((r) => r.id === nearestDepartures[0].routeId)
                        ?.color ?? "#3b82f6",
                  }}
                />
                <span className="font-mono text-sm font-bold text-zinc-800">
                  {nearestDepartures[0].time}
                </span>
              </span>
            </span>
          ) : (
            <span className="shrink-0 text-[11px] font-medium text-zinc-400">
              Нема повеќе денес
            </span>
          )}
        </button>
      )}

      {/* Map frame */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-200 h-115 lg:h-153">
        <div ref={containerRef} className="w-full h-full" />

        {/* Detail panel (bus or stop) — left dock on lg+, bottom drawer on
            mobile/tablet. Shared glassy window; bus and stop are exclusive. */}
        {(selectedBus || stopPanelInner) && (
          <>
            {/* Desktop: slides in from the left edge */}
            <div className="pp-panel-left absolute top-0 bottom-0 left-3 z-40 my-auto hidden h-fit max-h-[calc(100%-1.5rem)] w-60 overflow-y-auto rounded-2xl border border-white/60 bg-linear-to-b from-white/85 to-white/55 shadow-xl ring-1 ring-white/40 backdrop-blur-2xl lg:block">
              {selectedBus ? panelInner : stopPanelInner}
            </div>
            {/* Mobile / tablet: slides up like a bottom drawer (10% smaller content,
                inset 5% on each side) */}
            <div className="pp-panel-up absolute right-[5%] bottom-0 left-[5%] z-40 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-white/60 bg-linear-to-b from-white/90 to-white/60 shadow-2xl ring-1 ring-white/40 backdrop-blur-2xl lg:hidden">
              <div style={{ zoom: 0.9 }}>{selectedBus ? panelInner : stopPanelInner}</div>
            </div>
          </>
        )}

        {/* Idle pause — polling stopped after inactivity to save requests.
            Any interaction already resumes it; this is the visible cue + a tap
            target. Sits above the map, below the detail panel. */}
        {idlePaused && (
          <button
            type="button"
            onClick={() => setIdlePaused(false)}
            className="absolute inset-x-0 bottom-3 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-xs font-medium text-zinc-600 shadow-lg backdrop-blur-sm transition-colors hover:bg-white">
            <span className="relative flex h-2 w-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Ажурирањето е паузирано — допри за да продолжи
          </button>
        )}

        {/* Top-left controls: basemap switch (everyone) + speed toggle (owner) */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
          {/* Basemap style switch */}
          <div className="flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white/85 p-0.5 shadow-sm backdrop-blur-sm">
            {([
              ["positron", "Дневна", Sun],
              ["fiord", "Ноќна", Moon],
            ] as [MapStyleId, string, typeof Sun][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => chooseStyle(id)}
                title={`Изглед на мапа: ${label}`}
                aria-label={label}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  mapStyle === id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100"
                }`}>
                <Icon size={15} />
              </button>
            ))}
          </div>

          {/* Owner-only: toggle live speed in the bus popup */}
          {isOwner && (
            <button
              onClick={toggleSpeed}
              title="Само за тебе — прикажи брзина во прозорчето"
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm transition-colors ${
                showSpeed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white/85 text-zinc-500"
              }`}>
              <Gauge size={13} />
              Брзина {showSpeed ? "вкл." : "иск."}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
