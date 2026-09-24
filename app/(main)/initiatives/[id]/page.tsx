import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Users, Calendar, Coins, ExternalLink } from "lucide-react";
import { createPublicClient } from "../../../../lib/supabase/public";
import {
  CATEGORY_LABELS_INIT,
  STAGE_BADGE,
  STAGE_LABEL,
  daysRemaining,
} from "../../../../lib/initiatives";
import { cn, DISTRICT_LABELS, cdnUrl, formatDays } from "../../../../lib/utils";
import AvatarInitials, { type MembershipTier } from "../../../../components/ui/AvatarInitials";
import ShareSheet from "../../../../components/ui/ShareSheet";
import type { InitiativeWithDetails } from "../../../../lib/types/database";

const BASE_URL = "https://mojprilep.mk";

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchInitiative(id: string): Promise<InitiativeWithDetails | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("initiatives_with_details")
    .select("*")
    .eq("id", id)
    .single<InitiativeWithDetails>();
  return data ?? null;
}

// ── Metadata (Facebook / Viber / WhatsApp share cards) ───────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const i = await fetchInitiative(id);
  if (!i) return {};

  const image = i.cover_image_url ? cdnUrl(i.cover_image_url) : undefined;
  const description = (i.description ?? "").slice(0, 200);
  const url = `${BASE_URL}/initiatives/${i.id}`;

  return {
    title: i.title,
    description,
    alternates: { canonical: `/initiatives/${i.id}` },
    openGraph: {
      type: "article",
      title: i.title,
      description,
      url,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: i.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function InitiativeDetailPage({ params }: Props) {
  const { id } = await params;
  const i = await fetchInitiative(id);
  if (!i) notFound();

  const districtLabel = i.district
    ? DISTRICT_LABELS[i.district] ?? i.district
    : null;
  const authorName = i.author_full_name ?? i.author_username ?? "Анонимно";
  const cover = i.cover_image_url ? cdnUrl(i.cover_image_url) : null;
  const shareUrl = `${BASE_URL}/initiatives/${i.id}`;
  const days = daysRemaining(i.funding_deadline);

  return (
    <div className="space-y-4">
      <Link
        href="/initiatives"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-muted transition-colors hover:text-theme-heading">
        <ArrowLeft size={15} /> Сите иницијативи
      </Link>

      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {cover && (
          <div className="relative h-56 w-full sm:h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={i.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="space-y-4 p-5">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STAGE_BADGE[i.stage])}>
              {STAGE_LABEL[i.stage]}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
              {CATEGORY_LABELS_INIT[i.category] ?? i.category}
            </span>
            {districtLabel && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                {districtLabel}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-snug text-theme-heading">{i.title}</h1>

          {(i.street_name || districtLabel) && (
            <p className="inline-flex items-center gap-1 text-sm text-theme-muted">
              <MapPin size={14} className="text-zinc-400" />
              {[i.street_name, districtLabel].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Author */}
          <div className="flex items-center gap-2">
            <AvatarInitials
              name={authorName}
              avatarUrl={i.author_avatar}
              size="sm"
              membershipTier={i.author_membership_tier as MembershipTier}
              points={i.author_points}
            />
            <span className="text-[12px] text-zinc-600">
              <span className="font-medium text-zinc-800">{authorName}</span>
              <span className="text-zinc-400"> · {formatDays(i.created_at)}</span>
            </span>
          </div>

          {/* Funding snapshot */}
          {i.stage === "funding" && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${i.fund_progress_pct}%` }} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-emerald-700">
                  {i.raised_amount.toLocaleString()} ден.
                </span>
                <span className="text-[12px] text-zinc-600">
                  од {(i.target_amount ?? 0).toLocaleString()} ден. · {i.fund_progress_pct}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-zinc-600">
                {i.supporter_count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {i.supporter_count} поддржувачи
                  </span>
                )}
                {days != null && (
                  <span className={cn("inline-flex items-center gap-1", days <= 0 && "font-medium text-red-700")}>
                    <Calendar size={12} /> {days <= 0 ? "Истекло" : `${days} дена`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <section>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Опис</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{i.description}</p>
          </section>

          {i.problem_statement && (
            <section>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Кој проблем го решава?
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{i.problem_statement}</p>
            </section>
          )}

          {i.expected_impact && (
            <section>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Очекуван ефект</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{i.expected_impact}</p>
            </section>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
            <ShareSheet
              url={shareUrl}
              title={i.title}
              showLabel
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            />
            <Link
              href="/initiatives"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
              <ExternalLink size={14} /> Отвори во апликацијата
            </Link>
            {i.stage === "funding" && (
              <Link
                href={`/initiatives/${i.id}/donate`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                <Coins size={14} /> Донирај
              </Link>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
