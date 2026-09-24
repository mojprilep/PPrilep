// Shared Flespi helpers for the bus-position endpoints.
//
// Why messages and not telemetry: these SinoTrack devices have a fast internal
// clock and emit junk messages with a future timestamp + position.valid=false
// before GPS locks. Flespi telemetry always returns the highest-timestamp
// message, so that junk would freeze the position. server.timestamp is immune to
// the device clock, and we drop invalid fixes outright.

const FIELDS =
  "server.timestamp,position.latitude,position.longitude,position.speed,position.direction,position.valid";

export type Msg = {
  "server.timestamp"?: number;
  "position.latitude"?: number;
  "position.longitude"?: number;
  "position.speed"?: number;
  "position.direction"?: number;
  "position.valid"?: boolean;
};

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Newest valid fix for a device, by Flespi receive time. Null on error/no fix.
 *
 * `sinceS` (unix seconds) asks Flespi for only the messages it RECEIVED after
 * that moment, so a live bus needs a few dozen messages instead of 100 and a
 * parked one returns nothing at all. Filter on server.timestamp only — never
 * on position.valid: recent messages carry no such field, and Flespi treats a
 * missing field as a non-match, which returned hours-old fixes when tested.
 */
export async function lastFix(
  deviceId: number,
  token: string,
  sinceS?: number,
): Promise<Msg | null> {
  const data = encodeURIComponent(
    JSON.stringify(
      sinceS === undefined
        ? { reverse: true, count: 100, fields: FIELDS }
        : {
            reverse: true,
            count: 30,
            fields: FIELDS,
            filter: `server.timestamp>${Math.floor(sinceS)}`,
          },
    ),
  );
  try {
    const res = await fetch(
      `https://flespi.io/gw/devices/${deviceId}/messages?data=${data}`,
      { headers: { Authorization: `FlespiToken ${token}` }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`flespi ${res.status}`);
    const json = (await res.json()) as { result?: Msg[] };

    let best: Msg | null = null;
    let bestTs = -Infinity;
    for (const m of json.result ?? []) {
      if (m["position.valid"] === false) continue; // skip pre-lock junk
      if (num(m["position.latitude"]) === null) continue;
      if (num(m["position.longitude"]) === null) continue;
      const ts = num(m["server.timestamp"]);
      if (ts === null || ts <= bestTs) continue;
      bestTs = ts;
      best = m;
    }
    return best;
  } catch (e) {
    console.error("[buses/flespi]", deviceId, e);
    return null;
  }
}

export type FleetRow = {
  id: number;
  label: string;
  flespi_device_id: number;
  active_line_id: string | null;
};
