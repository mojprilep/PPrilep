"use client";

import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { OWNER_EMAIL } from "./config/owner";

export type Viewer = {
  /** Signed-in user's id, or null for guests / before the check finishes. */
  userId: string | null;
  isAdmin: boolean;
  /** First name for greetings, or null if unknown. */
  firstName: string | null;
  /** Full name from the profile, for pre-filling forms. */
  fullName: string | null;
  /** Street from the profile, for pre-filling forms. */
  streetName: string | null;
  /** Institution account this user operates, if any. */
  agencyId: string | null;
};

const GUEST: Viewer = {
  userId: null,
  isAdmin: false,
  firstName: null,
  fullName: null,
  streetName: null,
  agencyId: null,
};

// Several components on one page can call useViewer at once; they share a
// single in-flight lookup instead of each hitting Supabase separately.
let pending: Promise<Viewer> | null = null;

async function loadViewer(): Promise<Viewer> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return GUEST;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username, is_admin, agency_id, street_name")
    .eq("id", user.id)
    .maybeSingle();
  const rawName =
    profile?.full_name ??
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ??
    profile?.username ??
    null;
  return {
    userId: user.id,
    // The owner is always an admin — mirrors the server's ADMIN_EMAIL rule.
    isAdmin: user.email === OWNER_EMAIL || profile?.is_admin === true,
    firstName: rawName ? rawName.trim().split(/\s+/)[0] : null,
    fullName: profile?.full_name ?? null,
    streetName: profile?.street_name ?? null,
    agencyId: profile?.agency_id ?? null,
  };
}

/**
 * Who is looking at the page, resolved in the BROWSER.
 *
 * Pages used to call getUser() on the server, which reads cookies and forces
 * every visit to render per request (uncached on Vercel). Reading the viewer
 * here lets those pages be cached like any public page, and only the small
 * personal bits (greeting, admin controls) fill in after hydration.
 *
 * This is display-only. Anything that writes still has to be authorised by
 * the server / RLS, exactly as before.
 */
export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>(GUEST);

  useEffect(() => {
    let mounted = true;
    if (!pending) {
      pending = loadViewer().finally(() => {
        pending = null;
      });
    }
    pending
      .then((v) => {
        if (mounted && v.userId) setViewer(v);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return viewer;
}
