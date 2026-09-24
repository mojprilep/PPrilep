"use client";

/**
 * The «Официјални партнери» block: a horizontal slider of partner logos with the
 * «Стани партнер» call to action underneath.
 *
 * Lives in one place because it appears in more than one right panel and the two
 * copies had already drifted — one listed manual partners, the other didn't.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import {
  COMPANY_TIERS,
  fetchManualPartners,
  manualToCard,
  profileToCard,
  sortPartnerCards,
  type PartnerCard,
} from "../../lib/partners";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  membership_tier: string | null;
  is_company?: boolean;
};

export default function PartnerStrip() {
  const supabase = useMemo(() => createClient(), []);
  const [partners, setPartners] = useState<PartnerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data }, manual] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, points, membership_tier, is_company")
          .or(`is_company.eq.true,membership_tier.in.(${COMPANY_TIERS.join(",")})`)
          // Draw the whole pool — the shuffle below decides who leads. A small
          // LIMIT here would hand the same partners to every visitor no matter
          // how the client sorts them.
          .limit(100),
        fetchManualPartners(supabase),
      ]);
      if (!mounted) return;
      setPartners(
        sortPartnerCards([
          ...((data as ProfileRow[] | null) ?? []).map(profileToCard),
          ...manual.map(manualToCard),
        ]),
      );
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Arrows only mean something when there is somewhere to scroll, so they track
  // the real scroll position rather than just the item count.
  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    syncArrows();
  }, [partners, syncArrows]);

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const showArrows = partners.length > 1;

  return (
    <section className="rounded-2xl border border-[#e4ece8] bg-white p-3">
      <div className="mb-1.5 flex items-center gap-2">
        {/* Same type as the Случувања header above it in the panel — these
            sections sit stacked, so they must read as one system. */}
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Наши партнери
        </span>
        {showArrows && (
          <div className="flex gap-1">
            <button
              onClick={() => scrollBy(-1)}
              disabled={atStart}
              aria-label="Претходен партнер"
              className="rounded-md border border-[#e4ece8] p-0.5 text-slate-500 transition-opacity hover:bg-slate-50 disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => scrollBy(1)}
              disabled={atEnd}
              aria-label="Следен партнер"
              className="rounded-md border border-[#e4ece8] p-0.5 text-slate-500 transition-opacity hover:bg-slate-50 disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="aspect-square w-[46%] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <p className="text-xs text-theme-muted">Нема активни партнери.</p>
      ) : (
        <div
          ref={trackRef}
          onScroll={syncArrows}
          className="scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {partners.map((p) => {
            // Logo only — the name is carried by the logo itself, and the
            // truncated caption ("Метало Пл…") added noise without information.
            // It survives as alt/title text so the tile stays readable to screen
            // readers and on hover.
            const inner = p.avatarUrl ? (
              <img
                src={p.avatarUrl}
                alt={p.name}
                title={p.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div
                title={p.name}
                className="flex h-full w-full items-center justify-center text-slate-400">
                <Building2 size={28} />
              </div>
            );

            // Square tiles. Two visible at a time, the third peeking in to show
            // the strip scrolls — the only affordance there is on touch.
            const cls =
              "flex aspect-square w-[46%] shrink-0 snap-start items-center justify-center rounded-xl border border-[#e4ece8] p-2 transition-colors";
            const hover = " hover:border-[#cfe0da] hover:bg-slate-50";

            // Hand-entered partners without a website have nowhere to go.
            if (!p.href) return <div key={p.key} className={cls}>{inner}</div>;
            if (p.external)
              return (
                <a
                  key={p.key}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls + hover}>
                  {inner}
                </a>
              );
            return (
              <Link key={p.key} href={p.href} className={cls + hover}>
                {inner}
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href="/sponsors"
        className="mt-2 block rounded-xl border border-dashed border-[#cfe0da] py-1.5 text-center text-[11px] font-semibold text-primary transition-colors hover:bg-[#f0faf7]">
        Стани партнер →
      </Link>
    </section>
  );
}
