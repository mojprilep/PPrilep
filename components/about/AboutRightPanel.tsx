"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { Heart } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useAuthContext as useAuth } from "../../lib/context/AuthContext";
import PartnerStrip from "../sponsors/PartnerStrip";

const COMPANY_TIERS = ["company_basic", "company_preferred", "company_premium"];

const GOAL = 50;

export default function AboutRightPanel() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // The partner list moved to PartnerStrip; this only feeds the
      // "Наша цел: N членови" progress bar.
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("membership_tier", "is", null)
        .not("membership_tier", "in", `(${COMPANY_TIERS.join(",")})`);

      if (!mounted) return;
      setMemberCount(count ?? 0);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const progress = Math.min(100, Math.round((memberCount / GOAL) * 100));
  const remaining = Math.max(0, GOAL - memberCount);

  return (
    <div className="space-y-4 lg:p-3">
      {/* ── Member CTA ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <p className="text-sm font-semibold text-slate-800">
            Наша цел: {GOAL} членови
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-semibold text-slate-700">
              {memberCount} членови
            </span>
            <span className="text-slate-400">уште {remaining}</span>
          </div>
        </div>

        <p className="text-[12px] text-slate-500 leading-relaxed">
          Со {GOAL} членови можеме да финансираме{" "}
          <span className="font-semibold text-slate-700">
            2 јавни акции годишно
          </span>{" "}
          — садење дрвја, фарбање паркови, чистење на дивите депонии.
        </p>

        {user ? (
          <Link
            href="/sponsors?join=1"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
            <Heart size={14} />
            Стани член
          </Link>
        ) : (
          <Link
            href="/auth/login?next=%2Fsponsors%3Fjoin%3D1"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
            <Heart size={14} />
            Придружете се
          </Link>
        )}
      </section>

      {/* ── Sponsors ───────────────────────────────────────── */}
      <PartnerStrip />

    </div>
  );
}
