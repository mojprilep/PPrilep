"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

// How long an agency alert stays in the banner after it's posted. There's no
// expires_at column on agency_posts, so recency is the auto-clear mechanism.
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// Scroll speed in px/s. The animation duration is derived from the text's
// width, so one short alert and three long ones move at the same pace (a fixed
// duration made long text race across).
const SPEED_PX_PER_S = 40;

// Icon per sending institution; red alerts override with a warning sign.
const AGENCY_ICON: Record<string, string> = {
  vodovod: "💧",
  komunalec: "🗑️",
  osvetluvanje: "💡",
  evn: "⚡",
  transport_parking: "🚧",
  municipality: "🏛️",
};

interface AgencyAlert {
  id: number;
  agency_id: string;
  title: string;
  body: string | null;
  is_red_alert: boolean;
  created_at: string;
}

function iconFor(a: AgencyAlert): string {
  if (a.is_red_alert) return "⚠️";
  return AGENCY_ICON[a.agency_id] ?? "📢";
}

function label(a: AgencyAlert): string {
  const text = a.body ? `${a.title} — ${a.body}` : a.title;
  return `${iconFor(a)}  ${text}`;
}

export default function MarqueeBanner() {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<AgencyAlert[]>([]);
  const textRef = useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("agency_posts")
        .select("id, agency_id, title, body, is_red_alert, created_at, starts_at, ends_at")
        .gte("created_at", since)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("is_red_alert", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (!alive || error) return;
      setAlerts((data ?? []) as AgencyAlert[]);
    }

    void load();

    // Live-update the banner when a new alert is published.
    const channel = supabase
      .channel(`marquee-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agency_posts" },
        () => void load(),
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Duplicate the list so the marquee loop is seamless.
  const full = alerts.length ? [...alerts, ...alerts].map(label).join("     ·     ") : "";

  // Distance travelled = start offset (20vw, see @keyframes marquee) + the
  // text's own width; duration = distance / speed. Re-measured on resize.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => {
      const distance = window.innerWidth * 0.2 + el.scrollWidth;
      setDuration(Math.max(10, distance / SPEED_PX_PER_S));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [full]);

  // No active alerts → no banner (the layout simply has no bar).
  if (alerts.length === 0) return null;

  return (
    <div className="bg-theme-ink text-theme-on-dark h-11 flex items-center overflow-hidden border-b border-zinc-700 shrink-0 ">
      <span className="text-[10px] font-bold uppercase tracking-widest px-3 text-theme-accent shrink-0 border-r border-zinc-700 mr-3 h-full flex items-center">
        LIVE
      </span>
      <div className="overflow-hidden flex-1 relative">
        <span
          ref={textRef}
          className="animate-marquee text-[11px] tracking-wide text-theme-on-dark"
          style={duration ? { animationDuration: `${duration}s` } : undefined}
        >
          {full}
        </span>
      </div>
    </div>
  );
}
