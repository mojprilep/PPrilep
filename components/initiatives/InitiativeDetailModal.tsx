"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { toast } from "sonner";
import {
  X,
  Coins,
  CircleCheck,
  Users,
  Calendar,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { deleteInitiative } from "../../app/actions/initiatives";
import {
  CATEGORY_LABELS_INIT,
  STAGE_BADGE,
  STAGE_LABEL,
  daysRemaining,
} from "../../lib/initiatives";
import { cn, DISTRICT_LABELS, formatDays, cdnUrl } from "../../lib/utils";
import Image from "next/image";
import AvatarInitials from "../ui/AvatarInitials";
import ShareSheet from "../ui/ShareSheet";
import SegmentedProgressBar from "./SegmentedProgressBar";
import InitiativeSupporters from "./InitiativeSupporters";
import InitiativeManagePanel from "./InitiativeManagePanel";
import InitiativeGallery from "./InitiativeGallery";
import type { InitiativeWithDetails } from "../../lib/types/database";

interface Props {
  initiative: InitiativeWithDetails;
  voted: boolean;
  voteCount: number;
  isVoting: boolean;
  canVote: boolean;
  onVote: () => void;
  onClose: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
  /** Called after a successful delete so the parent can refresh the list. */
  onDeleted?: () => void;
}

export default function InitiativeDetailModal({
  initiative,
  voted,
  voteCount,
  isVoting,
  canVote,
  onVote,
  onClose,
  currentUserId,
  isAdmin = false,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!currentUserId && currentUserId === initiative.user_id;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;
  const canManage = isOwner || isAdmin;

  async function handleDelete() {
    if (
      !window.confirm(
        "Дали сте сигурни дека сакате трајно да ја избришете оваа иницијатива?",
      )
    )
      return;
    setDeleting(true);
    const res = await deleteInitiative(initiative.id);
    setDeleting(false);
    if (!res.success) {
      toast.error(
        res.error === "NOT_AUTHENTICATED"
          ? "Најавете се повторно"
          : res.error,
      );
      return;
    }
    toast.success("Иницијативата е избришана");
    setMenuOpen(false);
    onClose();
    onDeleted?.();
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const stage = initiative.stage;
  const districtLabel = initiative.district
    ? DISTRICT_LABELS[initiative.district] ?? initiative.district
    : null;
  const authorName =
    initiative.author_full_name ?? initiative.author_username ?? "Анонимно";
  const days = daysRemaining(initiative.funding_deadline);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col min-w-0"
        onClick={(e) => e.stopPropagation()}>
        {/* Header bar with close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0",
                STAGE_BADGE[stage],
              )}>
              {STAGE_LABEL[stage]}
            </span>
            <span className="text-[11px] text-zinc-500 truncate">
              {CATEGORY_LABELS_INIT[initiative.category] ?? initiative.category}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ShareSheet
              url={`https://mojprilep.mk/initiatives/${initiative.id}`}
              title={initiative.title}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            />
            {(canEdit || canDelete) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Опции"
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                      {canEdit && (
                        <Link
                          href={`/initiatives/${initiative.id}/edit`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                          <Pencil size={14} /> Уреди
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
                          <Trash2 size={14} />
                          {deleting ? "Се брише…" : "Избриши"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Затвори"
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 wrap-break-word">
          {initiative.cover_image_url && (
            <div className="relative w-full h-52 sm:h-64 rounded-xl overflow-hidden bg-zinc-100">
              <Image
                src={cdnUrl(initiative.cover_image_url)}
                alt={initiative.title}
                fill
                sizes="(max-width: 640px) 100vw, 640px"
                className="object-cover"
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {initiative.title}
              </h2>
              {(districtLabel || initiative.street_name) && (
                <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 mt-1">
                  <MapPin size={12} />
                  {[initiative.street_name, districtLabel].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            {(stage === "idea" || stage === "voting") && (
              <button
                type="button"
                onClick={onVote}
                disabled={isVoting || !canVote}
                className={cn(
                  "inline-flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full text-sm font-medium transition-colors shrink-0 disabled:opacity-60",
                  voted
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "text-zinc-500 hover:text-primary",
                )}>
                <span className="text-base leading-none">👏</span>
                <span className="tabular-nums font-semibold">{voteCount}</span>
              </button>
            )}
          </div>

          {/* Author */}
          <div className="flex items-center gap-2">
            <AvatarInitials
              name={authorName}
              avatarUrl={initiative.author_avatar}
              size="sm"
              membershipTier={initiative.author_membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={initiative.author_points}
            />
            <div className="text-[12px] text-zinc-600">
              <span className="font-medium text-zinc-800">{authorName}</span>
              <span className="text-zinc-400"> · {formatDays(initiative.created_at)}</span>
            </div>
          </div>

          {/* Owner/admin management: change stage + progress photos */}
          {canManage && (
            <InitiativeManagePanel
              initiativeId={initiative.id}
              stage={stage}
              completionNote={initiative.completion_note}
              completionImages={initiative.completion_images ?? []}
              onChanged={() => router.refresh()}
            />
          )}

          {/* Vote progress for idea/voting */}
          {(stage === "idea" || stage === "voting") && (
            <SegmentedProgressBar votes={voteCount} />
          )}

          {/* Who supported (public list of Поддржи clicks) */}
          {(stage === "idea" || stage === "voting") && (
            <InitiativeSupporters initiativeId={initiative.id} />
          )}

          {/* Funding details */}
          {stage === "funding" && (
            <FundBlock
              raised={initiative.raised_amount}
              target={initiative.target_amount ?? 0}
              pct={initiative.fund_progress_pct}
              supporters={initiative.supporter_count}
              days={days}
              initiativeId={initiative.id}
            />
          )}

          {/*
            When there's a manager update (note or photos), that becomes the
            body — the story people came to see is "what's happening now",
            not the original pitch. The original description gets collapsed
            further down under „Оригинален опис".
          */}
          {(() => {
            const hasUpdate =
              !!initiative.completion_note ||
              initiative.completion_images?.length > 0 ||
              stage === "completed";
            if (hasUpdate) {
              return <CompletedBlock initiative={initiative} />;
            }
            return (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                  Опис
                </h3>
                <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                  {initiative.description}
                </p>
              </section>
            );
          })()}

          {initiative.problem_statement && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                Кој проблем го решава?
              </h3>
              <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                {initiative.problem_statement}
              </p>
            </section>
          )}

          {initiative.expected_impact && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                Очекуван ефект
              </h3>
              <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                {initiative.expected_impact}
              </p>
            </section>
          )}

          {/* Original description — collapsed at the bottom when a manager
              update has taken over the main body (so the pitch isn't lost). */}
          {(!!initiative.completion_note ||
            initiative.completion_images?.length > 0 ||
            stage === "completed") && (
            <details className="group rounded-lg border border-zinc-200 bg-zinc-50">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-zinc-600 flex items-center justify-between">
                <span>Оригинален опис</span>
                <span className="text-zinc-400 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="px-3 pb-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {initiative.description}
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function FundBlock({
  raised,
  target,
  pct,
  supporters,
  days,
  initiativeId,
}: {
  raised: number;
  target: number;
  pct: number;
  supporters: number;
  days: number | null;
  initiativeId: string;
}) {
  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="h-2 rounded-full bg-white overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-base font-semibold text-emerald-700">
          {raised.toLocaleString()} ден.
        </span>
        <span className="text-[12px] text-zinc-600">
          од {target.toLocaleString()} ден. · {pct}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[12px] text-zinc-600">
          {supporters > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> {supporters} поддржувачи
            </span>
          )}
          {days != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                days <= 0 ? "text-red-700 font-medium" : "",
              )}>
              <Calendar size={12} />
              {days <= 0 ? "Истекло" : `${days} дена`}
            </span>
          )}
        </div>
        <Link
          href={`/initiatives/${initiativeId}/donate`}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <Coins size={14} /> Донирај
        </Link>
      </div>
    </div>
  );
}

function CompletedBlock({ initiative }: { initiative: InitiativeWithDetails }) {
  const done = initiative.stage === "completed";
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        done ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-zinc-50",
      )}>
      <div
        className={cn(
          "flex items-center gap-1.5",
          done ? "text-emerald-700" : "text-zinc-700",
        )}>
        <CircleCheck size={16} />
        <span className="text-sm font-semibold">
          {done ? "Реализирано" : "Напредок"}
          {done && initiative.completed_at
            ? ` · ${formatDays(initiative.completed_at)}`
            : ""}
        </span>
      </div>
      {initiative.completion_note && (
        <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
          {initiative.completion_note}
        </p>
      )}
      {initiative.completion_images?.length > 0 && (
        <InitiativeGallery
          images={initiative.completion_images}
          alt={initiative.title}
        />
      )}
    </div>
  );
}
