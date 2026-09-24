"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "@/components/ui/Link";
import { Lightbulb, Trophy, Building2, Users, HandHeart } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import AvatarInitials, { type MembershipTier } from "../../../components/ui/AvatarInitials";
import MembershipAdminPanel from "../../../components/sponsors/MembershipAdminPanel";
import PartnersAdminPanel from "../../../components/sponsors/PartnersAdminPanel";
import {
  COMPANY_TIERS,
  fetchManualPartners,
  manualToCard,
  profileToCard,
  sortPartnerCards,
  type ManualPartner,
  type PartnerCard,
} from "../../../lib/partners";

// ── Impact items ─────────────────────────────────────────────────────────────

const IMPACT_ITEMS = [
  { icon: <HandHeart size={20} />, title: "Волонтерство & Труд",       desc: "Секој час поминат во подобрување на градот е придонес. Не треба пари — треба посветеност." },
  { icon: <Lightbulb size={20} />, title: "Знаење & Вештини",          desc: "Архитекти, програмери, правници, едукатори — вашата струка е вредна за заедницата." },
  { icon: <Trophy size={20} />,    title: "Видливост & Угледност",      desc: "Партнерите добиваат место во апликацијата, признанија и благодарност од граѓаните." },
  { icon: <Building2 size={20} />, title: "Финансиска Поддршка",        desc: "Членарини и донации финансираат конкретни акции: садење дрва, фарбање игралишта, јавни настани." },
];

// ── Tier label ────────────────────────────────────────────────────────────────

const TIER_SHORT: Record<string, string> = {
  volunteer:         "Волонтер",
  monthly:           "Месечен",
  yearly:            "Годишен",
  mega_donor:        "МегаГига",
  mega_donator:      "Мега",
  company_basic:     "Партнер",
  company_preferred: "Партнер+",
  company_premium:   "Премиум",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  membership_tier: string | null;
  points: number;
  is_company: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SponsorsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers]   = useState<Member[]>([]);
  const [manual, setManual]     = useState<ManualPartner[]>([]);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [loading, setLoading]   = useState(true);
  // Bumped by the admin panel so a newly added partner shows up immediately.
  const [refresh, setRefresh]   = useState(0);

  useEffect(() => {
    Promise.all([
      // Real members: anyone with a membership_tier
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, membership_tier, points, is_company")
        .not("membership_tier", "is", null)
        .order("points", { ascending: false }),
      // Check admin
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return false;
        return supabase.from("profiles").select("is_admin").eq("id", user.id).single()
          .then(({ data }) => data?.is_admin ?? false);
      }),
      fetchManualPartners(supabase),
    ]).then(([membersRes, adminRes, manualRes]) => {
      setMembers((membersRes.data ?? []) as Member[]);
      setIsAdmin(adminRes as boolean);
      setManual(manualRes);
      setLoading(false);
    });
  }, [supabase, refresh]);

  const people = members.filter(
    (m) => !m.is_company && !COMPANY_TIERS.includes(m.membership_tier as typeof COMPANY_TIERS[number]),
  );
  // Applied-and-approved businesses and hand-entered ones share one list.
  const companies: PartnerCard[] = sortPartnerCards([
    ...members
      .filter((m) => m.is_company || COMPANY_TIERS.includes(m.membership_tier as typeof COMPANY_TIERS[number]))
      .map(profileToCard),
    ...manual.map(manualToCard),
  ]);

  return (
    <div className="space-y-6">

      {/* ── Info hero ── */}
      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl px-5 py-7 text-white sm:rounded-3xl sm:px-8 sm:py-10" style={{ background: "#2aa99d" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
          <div className="relative space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
              🤝 Партнери & Членови
            </div>
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">Заедно за подобар Прилеп</h1>
            <p className="text-sm leading-relaxed text-white/75 max-w-xl sm:text-base">
              Мој Прилеп е граѓанска платформа — без политика, без пари на тезга.
              Напредуваме само ако луѓето и бизнисите во градот веруваат во идејата
              и вложуваат со своето <strong className="text-white">време</strong>,{" "}
              <strong className="text-white">знаење</strong> или{" "}
              <strong className="text-white">ресурси</strong>.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {IMPACT_ITEMS.map((item) => (
            <div key={item.title} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                {item.icon}
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-900 sm:text-sm">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 sm:text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Members ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-zinc-500" />
          <h2 className="text-base font-bold text-zinc-900">Членови</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">{people.length}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />)}
          </div>
        ) : people.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
            Сè уште нема членови. Бидете први!
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {people.map((m) => (
              <Link
                key={m.id}
                href={`/${m.username ?? m.id}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50">
                <AvatarInitials
                  name={m.full_name}
                  avatarUrl={m.avatar_url}
                  size="md"
                  membershipTier={m.membership_tier as MembershipTier}
                  points={m.points}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900">{m.full_name ?? m.username ?? "Анонимен"}</p>
                  {m.username && <p className="truncate text-xs text-zinc-400">@{m.username}</p>}
                </div>
                {m.membership_tier && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: "#2aa99d" }}>
                    {TIER_SHORT[m.membership_tier] ?? m.membership_tier}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Company partners ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-zinc-500" />
          <h2 className="text-base font-bold text-zinc-900">Компании партнери</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">{companies.length}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100" />)}
          </div>
        ) : companies.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
            Сè уште нема компании партнери.
          </p>
        ) : (
          // Matches the Членови grid above: one column on phones, two from lg.
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {companies.map((c) => {
              const inner = (
                <>
                  {/* A logo is not an avatar: AvatarInitials crops to a 40px
                      circle with object-cover and stamps a tier badge on it,
                      which mangled wordmarks. This is a plain contained box. */}
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                      <Building2 size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900" title={c.name}>{c.name}</p>
                    {c.username && <p className="truncate text-[11px] text-zinc-400">@{c.username}</p>}
                    {/* One label for every company tier — the packages are no
                        longer advertised, so "Партнер+" / "Премиум" would name
                        a distinction the site no longer makes. */}
                    {c.tier && (
                      <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: "#2aa99d" }}>
                        Партнер
                      </span>
                    )}
                  </div>
                </>
              );
              const cls =
                "flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors";
              const hover = " hover:border-zinc-300 hover:bg-zinc-50";

              // A hand-entered partner with no website links nowhere — rendering
              // it as a link would send people to a profile page that does not
              // exist for it.
              if (!c.href) return <div key={c.key} className={cls}>{inner}</div>;
              if (c.external)
                return (
                  <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer" className={cls + hover}>
                    {inner}
                  </a>
                );
              return (
                <Link key={c.key} href={c.href} className={cls + hover}>
                  {inner}
                </Link>
              );
            })}
          </div>
        )}

        {/* Open slot */}
        <button 
          onClick={() => window.dispatchEvent(new Event("open-partner-modal"))}
          className="flex w-full min-h-18 items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-sm transition-colors hover:bg-[#d8f4ef80]" 
          style={{ borderColor: "#2aa99d", color: "#2aa99d", background: "#d8f4ef33" }}>
          <Building2 size={16} />
          Слободно место за нов партнер — контактирајте нè
        </button>
      </section>

      {/* ── Admin panel ── */}
      {isAdmin && <PartnersAdminPanel onChange={() => setRefresh((n) => n + 1)} />}
      {isAdmin && <MembershipAdminPanel />}
    </div>
  );
}
