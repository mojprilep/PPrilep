// Minimal Expo Push API client.
//
// Sends notifications to Expo push tokens via https://exp.host/--/api/v2/push/send.
// No SDK dependency — the endpoint is a plain JSON POST that accepts up to 100
// messages per request, so we chunk. Expo also recommends gzip + an access
// token, but neither is required; we keep it dependency-free.

import { after } from "next/server";
import { createAdminClient } from "../supabase/admin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK = 100;
const RECEIPT_CHUNK = 1000;
/**
 * Receipt checks after the response: most land within seconds, a few later.
 * Kept well under the 60s maxDuration of the broadcast routes — `after` dies
 * with the function, which would only lose the log, never a send.
 */
const RECEIPT_DELAYS_MS = [10_000, 20_000];

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  /**
   * iOS app-icon badge number to display. Delivered by APNs with the push, so
   * the icon shows the right count even when the app is fully closed. Android
   * ignores it (launcher-dependent); the app maintains its own badge there.
   */
  badge?: number;
};

export type PushTicket = { status: "ok" | "error"; id?: string; message?: string; details?: unknown };

/** Send a batch of messages, chunked. Returns the flattened tickets array. */
export async function sendExpoPush(messages: PushMessage[]): Promise<PushTicket[]> {
  const tickets: PushTicket[] = [];

  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      // priority "high" → APNs priority 10 / FCM high. Without it Expo sends at
      // normal priority (APNs 5), which lets iOS delay delivery to save power:
      // the notification arrives minutes later with no banner at send time, and
      // looks indistinguishable from a delivery failure. These are civic alerts
      // — a water outage or an issue update is worth waking the radio for.
      body: JSON.stringify(chunk.map((m) => ({ sound: "default", priority: "high", ...m }))),
    });

    const json = (await res.json().catch(() => ({}))) as { data?: PushTicket[] };
    if (Array.isArray(json.data)) tickets.push(...json.data);
  }

  logTicketErrors(tickets);
  scheduleReceiptCheck(messages, tickets);
  return tickets;
}

type PushReceipt = { status: "ok" | "error"; message?: string; details?: { error?: string } };

function errorCode(t: { message?: string; details?: unknown }): string {
  return (t.details as { error?: string } | undefined)?.error ?? t.message ?? "unknown";
}

/**
 * Send-time errors other than a dead token are configuration faults that hit
 * EVERY recipient on a platform — e.g. InvalidCredentials when EAS has no FCM
 * key, which silently broke all closed-app Android push. Callers only prune
 * DeviceNotRegistered, so surface the rest in the logs, grouped by code.
 */
function logTicketErrors(tickets: PushTicket[]) {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    if (t.status !== "error") continue;
    const code = errorCode(t);
    if (code === "DeviceNotRegistered") continue;
    counts[code] = (counts[code] ?? 0) + 1;
  }
  if (Object.keys(counts).length) {
    const sample = tickets.find((t) => t.status === "error" && errorCode(t) !== "DeviceNotRegistered");
    console.error("[push] ticket errors", counts, sample?.message);
  }
}

/**
 * A "ok" ticket only means Expo accepted the message. Whether FCM/APNs then
 * delivered it is in the receipt, fetched a little later. After the response
 * (so the caller never waits): log delivery errors and drop tokens the store
 * reports as uninstalled. Outside a request (scripts) `after` throws — skip.
 */
function scheduleReceiptCheck(messages: PushMessage[], tickets: PushTicket[]) {
  const tokenById = new Map<string, string>();
  tickets.forEach((t, i) => {
    if (t.status === "ok" && t.id && messages[i]) tokenById.set(t.id, messages[i].to);
  });
  if (tokenById.size === 0) return;

  try {
    after(async () => {
      let pending = [...tokenById.keys()];
      const counts: Record<string, number> = {};
      const dead: string[] = [];
      let sample: string | undefined;

      for (const delay of RECEIPT_DELAYS_MS) {
        if (pending.length === 0) break;
        await new Promise((r) => setTimeout(r, delay));
        const stillPending: string[] = [];
        for (let i = 0; i < pending.length; i += RECEIPT_CHUNK) {
          const ids = pending.slice(i, i + RECEIPT_CHUNK);
          const res = await fetch(EXPO_RECEIPTS_URL, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          }).catch(() => null);
          const json = (await res?.json().catch(() => ({}))) as { data?: Record<string, PushReceipt> } | undefined;
          const data = json?.data ?? {};
          for (const id of ids) {
            const r = data[id];
            if (!r) {
              stillPending.push(id);
              continue;
            }
            if (r.status !== "error") continue;
            const code = errorCode(r);
            counts[code] = (counts[code] ?? 0) + 1;
            sample ??= r.message;
            if (code === "DeviceNotRegistered") dead.push(tokenById.get(id)!);
          }
        }
        pending = stillPending;
      }

      if (Object.keys(counts).length) console.error("[push] receipt errors", counts, sample);
      if (dead.length) {
        await createAdminClient().from("push_subscriptions").delete().in("expo_token", dead);
      }
    });
  } catch {
    // Not inside a request — no background receipt check.
  }
}
