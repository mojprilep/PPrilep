"use server";

/**
 * Admin side of Еко угостители: the venues that sort glass / cans with
 * ПАКОМАК, entered by hand or imported from ПАКОМАК's table, and promoted on
 * /recycle/eko-ugostiteli.
 *
 * Everything runs on the admin's own session, so RLS (public.is_admin()) is
 * the real gate; requireAdmin() just turns a non-admin into a clean error
 * instead of an empty result.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { VENUE_KIND_LABELS, type GreenVenue, type GreenVenueKind } from "../../lib/recycle";

type Result<T = undefined> = { data?: T; error?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Најавете се." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { supabase, error: "Само за администратори." };
  return { supabase, error: null };
}

function changed() {
  revalidatePath("/admin/recycle");
  revalidatePath("/recycle/eko-ugostiteli");
}

export interface VenueInput {
  name: string;
  kind?: string | null;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  phone?: string | null;
  website?: string | null;
  glass?: boolean | string | null;
  cans?: boolean | string | null;
  partner_since?: string | null;
  edb?: string | null;
  pakomak_ref?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

function clean(v: unknown, max = 200): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}

function coord(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** true/false from a checkbox or a table cell ("да", "x", "1", "yes"…); null if blank. */
function flag(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  return /^(да|da|x|✓|✔|1|yes|y|true|има)$/.test(s);
}

/** YYYY-MM-DD from "2026-03-01", "01.03.2026", "1.3.2026" or a bare year "2024". */
function date(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^(19|20)\d{2}$/.test(s)) return `${s}-01-01`;
  return null;
}

/** Accepts our keys or Macedonian/English labels ("Кафе", "restaurant", …). */
function kind(v: unknown): GreenVenueKind {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "cafe";
  for (const [key, label] of Object.entries(VENUE_KIND_LABELS)) {
    if (s === key || s === label.toLowerCase()) return key as GreenVenueKind;
  }
  if (/ресторан|restoran|restaurant|пицерија|скара/.test(s)) return "restaurant";
  if (/хотел|hotel|мотел/.test(s)) return "hotel";
  if (/бар|bar|клуб|pub|паб/.test(s)) return "bar";
  if (/кафе|cafe|caffe|кафич/.test(s)) return "cafe";
  return "other";
}

function venueRow(input: VenueInput) {
  return {
    name: clean(input.name, 160),
    kind: kind(input.kind),
    address: clean(input.address),
    lat: coord(input.lat, 40, 43),
    lng: coord(input.lng, 19, 24),
    phone: clean(input.phone, 40),
    website: clean(input.website, 300),
    glass: flag(input.glass),
    cans: flag(input.cans),
    partner_since: date(input.partner_since),
    edb: clean(input.edb, 40),
    pakomak_ref: clean(input.pakomak_ref, 80),
    contact_name: clean(input.contact_name, 120),
    contact_phone: clean(input.contact_phone, 40),
    email: clean(input.email, 160),
    notes: clean(input.notes, 1000),
  };
}

/** A new venue with no stream info is assumed to sort glass (ПАКОМАК's main HoReCa stream). */
function withDefaults(row: ReturnType<typeof venueRow>) {
  return { ...row, glass: row.glass ?? true, cans: row.cans ?? false };
}

export async function fetchGreenVenues(): Promise<Result<GreenVenue[]>> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const { data, error: e } = await supabase.from("green_venues").select("*").order("name");
  if (e) return { error: e.message };
  return { data: (data ?? []) as GreenVenue[] };
}

export async function saveGreenVenue(id: number | null, input: VenueInput): Promise<Result<GreenVenue>> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const row = withDefaults(venueRow(input));
  if (!row.name) return { error: "Називот е задолжителен." };

  const query = id
    ? supabase
        .from("green_venues")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", id)
    : supabase.from("green_venues").insert(row);
  const { data, error: e } = await query.select("*").single();
  if (e) return { error: e.message };
  changed();
  return { data: data as GreenVenue };
}

/**
 * Bulk import from ПАКОМАК's table (parsed client-side from a paste or CSV).
 * A row whose pakomak_ref or ЕДБ matches an existing venue updates it — so the
 * same file can be re-imported when ПАКОМАК sends an updated list — anything
 * else is inserted.
 */
export async function importGreenVenues(
  rows: VenueInput[],
): Promise<Result<{ inserted: number; updated: number; skipped: number }>> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  if (rows.length > 2000) return { error: "Најмногу 2000 редови одеднаш." };

  const { data: existing, error: e0 } = await supabase
    .from("green_venues")
    .select("id, pakomak_ref, edb");
  if (e0) return { error: e0.message };
  const byRef = new Map<string, number>();
  const byEdb = new Map<string, number>();
  for (const v of existing ?? []) {
    if (v.pakomak_ref) byRef.set(v.pakomak_ref, v.id);
    if (v.edb) byEdb.set(v.edb, v.id);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const fresh: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const input of rows) {
    const row = venueRow(input);
    if (!row.name) {
      skipped++;
      continue;
    }
    const matchId =
      (row.pakomak_ref && byRef.get(row.pakomak_ref)) || (row.edb && byEdb.get(row.edb)) || null;
    if (matchId) {
      // Only overwrite with values the file actually has.
      const patch = Object.fromEntries(
        Object.entries(row).filter(([k, v]) => v !== null && !(k === "kind" && !input.kind)),
      );
      const { error: e } = await supabase
        .from("green_venues")
        .update({ ...patch, updated_at: now })
        .eq("id", matchId);
      if (e) skipped++;
      else updated++;
    } else {
      fresh.push(withDefaults(row));
    }
  }

  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const { error: e } = await supabase.from("green_venues").insert(chunk);
    if (e) return { error: `Увезени ${inserted} нови, па грешка: ${e.message}` };
    inserted += chunk.length;
  }

  changed();
  return { data: { inserted, updated, skipped } };
}

export async function setGreenVenueActive(id: number, active: boolean): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const { error: e } = await supabase
    .from("green_venues")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (e) return { error: e.message };
  changed();
  return {};
}

export async function deleteGreenVenue(id: number): Promise<Result> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };
  const { error: e } = await supabase.from("green_venues").delete().eq("id", id);
  if (e) return { error: e.message };
  changed();
  return {};
}
