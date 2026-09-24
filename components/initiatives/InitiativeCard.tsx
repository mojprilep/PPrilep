"use client";

import Link from "@/components/ui/Link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition, useCallback } from "react";
import { Coins, CircleCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { castVoteOnInitiative } from "../../app/actions/initiatives";
import { useInitiativeVoteSync } from "../../lib/hooks/useInitiativeVoteSync";
import {
  CATEGORY_LABELS_INIT,
  STAGE_BADGE,
  STAGE_LABEL,
  daysRemaining,
} from "../../lib/initiatives";
import { cn, DISTRICT_LABELS, formatDays } from "../../lib/utils";
import AvatarInitials from "../ui/AvatarInitials";
import InitiativeDetailModal from "./InitiativeDetailModal";
import SegmentedProgressBar from "./SegmentedProgressBar";
import type { InitiativeWithDetails } from "../../lib/types/database";

interface Props {
  initiative: InitiativeWithDetails;
  currentUserId?: string;
  userVotedIds: string[];
  isAdmin?: boolean;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const next = `${location.pathname}${location.search}`;
  location.href = `/auth/login?next=${encodeURIComponent(next)}`;
}

export default function InitiativeCard({
  initiative,
  currentUserId,
  userVotedIds,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const initialVoted = userVotedIds.includes(initiative.id);

  // Local "truth" — updated by realtime + server action results
  const [truth, setTruth] = useState({
    voted: initialVoted,
    count: initiative.vote_count,
    stage: initiative.stage,
  });

  // Optimistic layer for instant UX
  const [optimistic, applyOptimistic] = useOptimistic(
    truth,
    (state, delta: 1 | -1) => ({
      ...state,
      voted: delta === 1,
      count: Math.max(0, state.count + delta),
    }),
  );

  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Reflect the open initiative in the address bar (shallow — no navigation) so
  // the URL is copy-paste shareable and the back button closes the modal.
  useEffect(() => {
    if (!open) return;
    const path = `/initiatives/${initiative.id}`;
    if (window.history.state?.initiativeModal !== initiative.id) {
      window.history.pushState({ initiativeModal: initiative.id }, "", path);
    }
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via the X/backdrop (URL still on the initiative) → restore.
      if (window.history.state?.initiativeModal) window.history.back();
    };
  }, [open, initiative.id]);

  useInitiativeVoteSync(
    initiative.id,
    truth.stage === "idea" || truth.stage === "voting",
    useCallback((next: { vote_count: number; stage: string }) => {
      setTruth((t) => ({
        ...t,
        count: next.vote_count,
        stage: (next.stage as typeof t.stage) ?? t.stage,
      }));
    }, []),
  );

  function onVote() {
    if (!currentUserId) {
      redirectToLogin();
      return;
    }
    const delta = optimistic.voted ? -1 : 1;
    startTransition(async () => {
      applyOptimistic(delta);
      const res = await castVoteOnInitiative(initiative.id);
      if (!res.success) {
        if (res.error === "NOT_AUTHENTICATED") redirectToLogin();
        else toast.error(res.error);
        return;
      }
      setTruth((t) => ({ ...t, voted: res.voted, count: res.count }));
    });
  }

  const districtLabel = initiative.district
    ? (DISTRICT_LABELS[initiative.district] ?? initiative.district)
    : null;

  const authorName =
    initiative.author_full_name ?? initiative.author_username ?? "Анонимно";
  const stage = truth.stage;
  const showVoteCluster = stage === "idea" || stage === "voting";

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="bg-white border border-zinc-200 rounded-xl overflow-hidden cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all">
        {(() => {
          // Prefer the "after" photo when the initiative is fixed — that's the
          // story people want to see in the feed. Falls back to the cover.
          const headerUrl =
            (stage === "completed" && initiative.completion_images?.[0]) ||
            initiative.cover_image_url ||
            null;
          if (!headerUrl) return null;
          return (
            <div className="relative w-full h-40 bg-zinc-100">
              <Image
                src={headerUrl}
                alt={initiative.title}
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-cover"
              />
            </div>
          );
        })()}
        <div className="p-4 space-y-3">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                  STAGE_BADGE[stage],
                )}>
                {STAGE_LABEL[stage]}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                {CATEGORY_LABELS_INIT[initiative.category] ??
                  initiative.category}
              </span>
              {districtLabel && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-600">
                  {districtLabel}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium mt-1.5 text-theme-ink">
              {initiative.title}
            </h3>
            {initiative.street_name && (
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {initiative.street_name}
              </p>
            )}
            <p className="text-[13px] text-theme-muted mt-1 line-clamp-2">
              {initiative.description}
            </p>
          </div>

          {showVoteCluster && (
            <span className="inline-flex items-center gap-1 text-zinc-400 shrink-0 text-sm">
              <span className="text-base leading-none">👏</span>
              <span className="tabular-nums font-semibold">{optimistic.count}</span>
            </span>
          )}
        </header>

        {(stage === "idea" || stage === "voting") && (
          <SegmentedProgressBar votes={optimistic.count} />
        )}

        {stage === "funding" && <FundingBlock initiative={initiative} />}

        {stage === "completed" && <CompletedBlock initiative={initiative} />}

        {stage === "rejected" && (
          <p className="text-[12px] text-red-700">
            Иницијативата е затворена без реализација.
          </p>
        )}

        <footer className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarInitials
              name={authorName}
              avatarUrl={initiative.author_avatar}
              size="sm"
              membershipTier={initiative.author_membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={initiative.author_points}
            />
            <span className="text-[11px] text-theme-subtle truncate">
              {authorName} · {formatDays(initiative.created_at)}
            </span>
          </div>
          {showVoteCluster ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVote();
              }}
              disabled={isPending}
              aria-pressed={optimistic.voted}
              className={cn(
                "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                optimistic.voted
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-primary/10 text-primary hover:bg-primary/20",
              )}>
              {optimistic.voted ? "Поддржано ✓" : "Поддржи"}
            </button>
          ) : stage === "funding" && initiative.supporter_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-theme-muted">
              <Users size={11} />
              {initiative.supporter_count} поддржувачи
            </span>
          ) : null}
        </footer>
        </div>
      </article>

      {open && (
        <InitiativeDetailModal
          initiative={{ ...initiative, vote_count: optimistic.count, stage }}
          voted={optimistic.voted}
          voteCount={optimistic.count}
          isVoting={isPending}
          canVote={!!currentUserId}
          onVote={onVote}
          onClose={() => setOpen(false)}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onDeleted={() => router.refresh()}
        />
      )}
    </>
  );
}

// ── Sub-blocks ──────────────────────────────────────────────────────

function FundingBlock({ initiative }: { initiative: InitiativeWithDetails }) {
  const target = initiative.target_amount ?? 0;
  const pct = initiative.fund_progress_pct;
  const days = daysRemaining(initiative.funding_deadline);

  return (
    <div className="space-y-2">
      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-emerald-700">
          {initiative.raised_amount.toLocaleString()} ден.
        </span>
        <span className="text-[11px] text-theme-muted">
          собрани од {target.toLocaleString()} ден.
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {days != null ? (
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded font-medium",
              days <= 0
                ? "bg-red-50 text-red-700"
                : "bg-zinc-100 text-zinc-700",
            )}>
            {days <= 0 ? "Истекло" : `${days} дена преостанати`}
          </span>
        ) : (
          <span />
        )}

        <Link
          href={`/initiatives/${initiative.id}/donate`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Coins size={14} /> Донирај
        </Link>
      </div>
    </div>
  );
}

function CompletedBlock({ initiative }: { initiative: InitiativeWithDetails }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-emerald-700">
        <CircleCheck size={14} />
        <span className="text-[12px] font-semibold">
          Реализирано{" "}
          {initiative.completed_at
            ? `· ${formatDays(initiative.completed_at)}`
            : ""}
        </span>
      </div>
      {initiative.completion_note && (
        <p className="text-[12px] text-theme-muted line-clamp-2">
          {initiative.completion_note}
        </p>
      )}
    </div>
  );
}
