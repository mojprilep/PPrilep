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
};

const GUEST: Viewer = { userId: null, isAdmin: false, firstName: null };

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
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, is_admin")
        .eq("id", user.id)
        .maybeSingle();
      const rawName =
        profile?.full_name ??
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null) ??
        profile?.username ??
        null;
      if (!mounted) return;
      setViewer({
        userId: user.id,
        // The owner is always an admin — mirrors the server's ADMIN_EMAIL rule.
        isAdmin: user.email === OWNER_EMAIL || profile?.is_admin === true,
        firstName: rawName ? rawName.trim().split(/\s+/)[0] : null,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return viewer;
}
