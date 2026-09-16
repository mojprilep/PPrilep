// POST /api/push/prefs
//
// The native app writes this device's per-category notification preferences.
// Master on/off lives on `enabled` (set at register time / OS permission); this
// endpoint sets the finer-grained `notif_prefs` JSONB — a map of
// { <category>: boolean } where a category is ON unless explicitly false. See
// lib/push/prefs.ts for how senders read it.
//
// Body (JSON): { token: string, prefs: Record<string, boolean> }
// The device must already be registered (PushCard registers on permission
// grant); we update its row by expo_token via the service role.

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { NOTIF_CATEGORIES } from "../../../../lib/push/prefs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXPO_TOKEN_RE = /^ExponentPushToken\[.+\]$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      prefs?: Record<string, unknown>;
    };

    const token = body.token?.trim();
    if (!token || !EXPO_TOKEN_RE.test(token)) {
      return NextResponse.json({ error: "Invalid Expo push token." }, { status: 400 });
    }

    // Keep only known categories, coerced to booleans — never trust the client
    // to decide the schema. An omitted category stays "on" (absent = opted in).
    const prefs: Record<string, boolean> = {};
    for (const cat of NOTIF_CATEGORIES) {
      if (typeof body.prefs?.[cat] === "boolean") prefs[cat] = body.prefs[cat] as boolean;
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("push_subscriptions")
      .update({ notif_prefs: prefs, last_seen_at: new Date().toISOString() })
      .eq("expo_token", token);

    if (error) {
      console.error("[push/prefs]", error);
      return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/prefs]", err);
    return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
  }
}
