/**
 * GET /api/buses/positions
 *
 * Public, CDN-cacheable snapshot of every live bus's latest position. Reads each
 * tracker's recent messages from Flespi and picks the newest VALID fix by
 * `server.timestamp` (Flespi's receive time).
 *
 * Why messages and not telemetry: these SinoTrack devices have a fast internal
 * clock and emit junk messages with a future timestamp + position.valid=false
 * before GPS locks. Flespi telemetry always returns the highest-timestamp
 * message, so that junk would freeze the position for ~30 min. server.timestamp
 * is immune to the device clock, and we drop invalid fixes outright.
 *
 * The `s-maxage` header lets Vercel's edge (and Cloudflare in front) serve one
 * cached response to all viewers — near-zero egress no matter how many watch.
 *
 * Setup: add FLESPI_TOKEN (a read-only Flespi token) to the env. Which device
 * runs which line lives in the `buses` table (operator-editable at runtime).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { lastFix, num, type FleetRow } from "../../../../lib/buses/flespi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Our audience is entirely in Macedonia, but Cloudflare-in-front can make Vercel
// route this to a US region (iad1). Pin it to Frankfurt — the closest region to
// both our users and our Supabase — so it never runs across the Atlantic.
export const preferredRegion = "fra1";

const TOKEN = process.env.FLESPI_TOKEN;
// Hide a bus from the PUBLIC feed once its tracker has gone quiet for 15 min.
// Trackers emit every ~30s while the engine is on, so long silences only happen
// when the engine is off (end of shift, extended break). 15 min tolerates a
// generous coverage dip or a quick engine-off stop without blinking the bus off
// the map mid-route, and hides the "parked at home / at depot" location once a
// shift really ends. Engine-on but stationary buses (traffic, layover) keep
// transmitting and stay visible indefinitely, regardless of speed. The last-
// known position of a truly-off bus stays visible to the owner ONLY, via
// /api/buses/positions/admin.
const MAX_AGE_S = 15 * 60;

const CACHE_HEADERS = {
  // 10s shared cache: the fleet's fastest tracker emits a new fix every ~2-3s, so
  // a 10s window keeps positions fresh while still collapsing all viewers into
  // ~one origin run per window. BOTH the web map and the mobile app poll this
  // through the Cloudflare-proxied host buses.mojprilep.mk.
  //
  // `max-age=10` on top of s-maxage is a defence-in-depth against Cloudflare's
  // default Browser Cache TTL (4h) rewriting the wire response to
  // `max-age=14400` when a Cache Rule isn't in place — that once left the mobile
  // app showing frozen bus positions for 4h at a time. Also emit
  // `CDN-Cache-Control` (Cloudflare-specific; overrides Cache-Control at the
  // edge) so the 10s edge TTL is enforced regardless of dashboard config.
  "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=20",
  "CDN-Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
  // Public, non-sensitive data. The web map runs on www.mojprilep.mk but fetches
  // this from the buses.mojprilep.mk cache host — a cross-origin GET — so the
  // browser needs this to read the response. Simple GET, no preflight.
  "Access-Control-Allow-Origin": "*",
};

// ── Service window (Europe/Skopje) ───────────────────────────────────────────
// Buses run ~06:00–20:00 local. Outside that nothing is on the road, so we
// short-circuit BEFORE touching Supabase or Flespi and hand the CDN a cache that
// lasts until service reopens — overnight the function is barely invoked and
// makes zero upstream calls. The owner endpoint (/admin) is exempt so parked
// buses stay watchable 24/7. Change these two numbers if the schedule changes.
const OPEN_MIN = 6 * 60; // 06:00
const CLOSE_MIN = 20 * 60; // 20:00

/** Minutes-into-day in Europe/Skopje (DST-correct); the server itself runs UTC. */
function skopjeMinutes(d = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Skopje",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Seconds until service reopens when currently closed, else null (open now). */
function secondsUntilOpen(d = new Date()): number | null {
  const m = skopjeMinutes(d);
  if (m >= OPEN_MIN && m < CLOSE_MIN) return null; // open
  const untilMin = m < OPEN_MIN ? OPEN_MIN - m : 1440 - m + OPEN_MIN;
  return Math.max(60, untilMin * 60);
}

// Which bus runs which line changes a few times a day at most, but this route
// runs every ~10s. Keep the fleet in the (Fluid, reused) instance's memory for
// 30s so most runs skip the Supabase round-trip; a line reassignment shows up
// within 30s.
const FLEET_TTL_MS = 30_000;
let fleetCache: { rows: FleetRow[]; at: number } | null = null;

async function loadFleet(): Promise<FleetRow[] | null> {
  if (fleetCache && Date.now() - fleetCache.at < FLEET_TTL_MS) return fleetCache.rows;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("buses")
    .select("id,label,flespi_device_id,active_line_id")
    .eq("is_active", true)
    .not("active_line_id", "is", null);
  if (error) {
    console.error("[buses/positions] fleet", error.message);
    return null;
  }
  fleetCache = { rows: (data ?? []) as FleetRow[], at: Date.now() };
  return fleetCache.rows;
}

export async function GET() {
  // Off-hours: no bus runs. Skip all work and let the CDN hold this empty
  // response until service reopens — near-zero invocations, zero Supabase/Flespi.
  const closedFor = secondsUntilOpen();
  if (closedFor !== null) {
    return NextResponse.json(
      { buses: [], updatedAt: new Date().toISOString(), closed: true },
      {
        headers: {
          // Same defence-in-depth as CACHE_HEADERS: explicit max-age so CF's
          // Browser TTL can't rewrite, and CDN-Cache-Control for the edge.
          "Cache-Control": `public, max-age=${closedFor}, s-maxage=${closedFor}, stale-while-revalidate=60`,
          "CDN-Cache-Control": `public, s-maxage=${closedFor}, stale-while-revalidate=60`,
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const empty = NextResponse.json(
    { buses: [], updatedAt: new Date().toISOString() },
    { headers: CACHE_HEADERS },
  );
  if (!TOKEN) return empty;

  // In-service buses with a line assigned (operator-editable in the buses table).
  const fleet = await loadFleet();
  if (!fleet || fleet.length === 0) return empty;

  const nowS = Date.now() / 1000;
  // Only messages Flespi received within MAX_AGE_S — older fixes would be
  // dropped below anyway, so there's no point downloading them.
  const fixes = await Promise.all(
    fleet.map(async (b) => ({
      b,
      fix: await lastFix(b.flespi_device_id, TOKEN!, nowS - MAX_AGE_S),
    })),
  );

  const buses = fixes.flatMap(({ b, fix }) => {
    if (!fix) return [];
    const ts = num(fix["server.timestamp"]);
    if (ts === null || nowS - ts > MAX_AGE_S) return []; // stale / out of service
    return [
      {
        id: b.id,
        label: b.label,
        routeId: b.active_line_id,
        lat: num(fix["position.latitude"])!,
        lng: num(fix["position.longitude"])!,
        speed: num(fix["position.speed"]),
        course: num(fix["position.direction"]),
        lastSeen: new Date(ts * 1000).toISOString(),
      },
    ];
  });

  return NextResponse.json(
    { buses, updatedAt: new Date().toISOString() },
    { headers: CACHE_HEADERS },
  );
}
