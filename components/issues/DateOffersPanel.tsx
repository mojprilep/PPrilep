"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users, CalendarDays, ChevronRight, X, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { createClient } from "../../lib/supabase/client";
import AvatarInitials from "../ui/AvatarInitials";
import { cn } from "../../lib/utils";
import { useAuth } from "../../lib/hooks/useAuth";
import { toast } from "sonner";

interface VoterProfile {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface HelpOfferComment {
  id: number;
  offer_id: number;
  user_id: string;
  body: string;
  created_at?: string;
  profiles?: VoterProfile | null;
}

interface HelpOffer {
  id: number;
  user_id: string;
  note: string | null;
  service_date: string | null;
  vote_count: number;
  voted_by_me: boolean;
  voters: { user_id: string; profiles?: VoterProfile | null }[];
  comments: HelpOfferComment[];
  profiles?: VoterProfile | null;
}

interface Props {
  issueId: number;
  issueTitle: string;
  userId?: string;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString("mk-MK", { weekday: "long" }),
    dayMonth: dt.toLocaleDateString("mk-MK", { day: "numeric", month: "long" }),
    year: dt.getFullYear(),
  };
}

function PomogniIcon({ className }: { className?: string }) {
  return (
    <svg
      width="50"
      height="48"
      viewBox="0 0 50 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M28 1.30983L27.6266 0.974772C26.003 -0.481681 23.435 -0.252463 22 1.30535L25.0012 4L28 1.30983Z"
        fill="currentColor"
      />
      <path
        d="M49.576 32.1351L46.4281 29C44.2775 31.143 39.6334 35.77 35.9831 39.4042C34.2457 41.1353 32.2348 42.5166 30 43.5172L34.0774 47.5779C34.6426 48.1408 35.5588 48.1407 36.124 47.5776L49.5762 34.1737C50.1413 33.6107 50.1413 32.698 49.576 32.1351Z"
        fill="currentColor"
      />
      <path
        d="M45.9744 25.6748C49.0811 22.3975 44.4512 17.8594 41.1035 20.9029L42.3191 19.709C45.4258 16.4286 40.7966 11.8937 37.4396 14.937L38.6638 13.7432C41.7731 10.4599 37.135 5.92765 33.7844 8.97032L35.0086 7.77732C38.1197 4.49237 33.4749 -0.0371303 30.1291 3.00457L27.3444 5.72967L29.7823 8.11729C33.3551 11.5221 31.4979 17.7049 26.6251 18.677C26.1633 20.9584 24.1155 22.9887 21.7549 23.4475C21.293 25.7332 19.2416 27.7652 16.875 28.2218C15.861 32.9889 9.60033 34.8115 6.08725 31.3015L3.65104 28.9157L0.433365 32.0644C-0.144521 32.6299 -0.144422 33.5468 0.433463 34.1123L14.1944 47.5761C14.7723 48.1414 15.7091 48.1413 16.2868 47.5757L21.5944 42.3792C26.2756 42.3792 30.7671 40.5584 34.0775 37.3178C39.1035 32.4016 45.9744 25.6748 45.9744 25.6748Z"
        fill="currentColor"
      />
      <path
        d="M7.64044 29.9682C10.9655 33.0935 15.5598 28.4359 12.4782 25.0675C15.8034 28.1926 20.3975 23.5352 17.3159 20.1667C20.6383 23.293 25.224 18.6283 22.1451 15.2667C25.4658 18.3906 30.0662 13.7376 26.9827 10.3659L19.7347 3.01426C18.3928 1.66191 16.2303 1.66191 14.8971 3.01426C13.5636 4.36662 13.5636 6.56275 14.8971 7.91511L16.1021 9.14009C12.7844 6.01275 8.17779 10.6854 11.273 14.0409L12.4781 15.2667C9.15451 12.1403 4.55843 16.7986 7.64044 20.1667L8.77998 21.3211C5.42347 18.3362 0.970948 22.9733 4.01629 26.2925L7.64044 29.9682Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function DateOffersPanel({
  issueId,
  issueTitle,
  userId,
  onClose,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { profile: authProfile } = useAuth();
  const [offers, setOffers] = useState<HelpOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>(
    {},
  );
  const [savingFor, setSavingFor] = useState<number | null>(null);
  const [showVotersFor, setShowVotersFor] = useState<number | null>(null);
  const [deletingOffer, setDeletingOffer] = useState<number | null>(null);
  const [commentLimits, setCommentLimits] = useState<Record<number, number>>(
    {},
  );
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function loadOffers() {
    const { data: offersData, error } = await supabase
      .from("issue_help_offers")
      .select(
        "id, user_id, note, service_date, profiles:user_id(full_name, avatar_url, username)",
      )
      .eq("issue_id", issueId)
      .not("service_date", "is", null)
      .order("created_at", { ascending: true });

    if (error || !offersData) {
      setLoading(false);
      return;
    }

    const offerIds = offersData.map((o) => o.id);
    let voteRows: {
      offer_id: number;
      user_id: string;
      profiles?: VoterProfile | VoterProfile[] | null;
    }[] = [];
    let commentRows: (HelpOfferComment & { profiles: unknown })[] = [];

    if (offerIds.length > 0) {
      const [{ data: votes }, { data: comments }] = await Promise.all([
        supabase
          .from("issue_help_date_votes")
          .select(
            "offer_id, user_id, profiles:user_id(full_name, avatar_url, username)",
          )
          .in("offer_id", offerIds),
        supabase
          .from("issue_help_offer_comments")
          .select(
            "id, offer_id, user_id, body, created_at, profiles:user_id(full_name, avatar_url, username)",
          )
          .in("offer_id", offerIds)
          .order("created_at", { ascending: true }),
      ]);
      voteRows = (votes ?? []) as typeof voteRows;
      commentRows = (comments ?? []) as unknown as typeof commentRows;
    }

    const voteCount: Record<number, number> = {};
    const votedByMe = new Set<number>();
    const votersByOffer: Record<
      number,
      { user_id: string; profiles?: VoterProfile | null }[]
    > = {};
    for (const v of voteRows) {
      voteCount[v.offer_id] = (voteCount[v.offer_id] ?? 0) + 1;
      if (v.user_id === userId) votedByMe.add(v.offer_id);
      votersByOffer[v.offer_id] ??= [];
      votersByOffer[v.offer_id].push({
        user_id: v.user_id,
        profiles: Array.isArray(v.profiles)
          ? v.profiles[0]
          : (v.profiles ?? null),
      });
    }

    const commentsByOffer: Record<number, HelpOfferComment[]> = {};
    for (const c of commentRows) {
      commentsByOffer[c.offer_id] ??= [];
      commentsByOffer[c.offer_id].push({
        ...c,
        profiles: Array.isArray(c.profiles)
          ? c.profiles[0]
          : (c.profiles as HelpOfferComment["profiles"]),
      });
    }

    setOffers(
      offersData.map((o) => ({
        id: o.id,
        user_id: o.user_id,
        note: o.note,
        service_date: o.service_date,
        vote_count: voteCount[o.id] ?? 0,
        voted_by_me: votedByMe.has(o.id) || o.user_id === userId,
        voters: votersByOffer[o.id] ?? [],
        comments: commentsByOffer[o.id] ?? [],
        profiles: Array.isArray(o.profiles) ? o.profiles[0] : o.profiles,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void loadOffers();
    }, 0);
    return () => clearTimeout(id);
  }, [issueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleVote(offer: HelpOffer) {
    if (!userId) {
      toast.error("Најавете се прво");
      return;
    }
    if (votingFor) return;
    setVotingFor(offer.id);
    if (offer.voted_by_me) {
      await supabase
        .from("issue_help_date_votes")
        .delete()
        .eq("offer_id", offer.id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("issue_help_date_votes")
        .insert({ offer_id: offer.id, user_id: userId });
      await supabase
        .from("issue_helpers")
        .upsert(
          { issue_id: issueId, user_id: userId },
          { onConflict: "issue_id,user_id" },
        );
    }
    await loadOffers();
    setVotingFor(null);
  }

  async function deleteOffer(offer: HelpOffer) {
    if (!userId || deletingOffer) return;
    const ok = window.confirm(
      "Дали сигурно сакаш да го избришеш овoj предлог датум?",
    );
    if (!ok) return;
    setDeletingOffer(offer.id);
    const { error } = await supabase
      .from("issue_help_offers")
      .delete()
      .eq("id", offer.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      setDeletingOffer(null);
      return;
    }
    toast.success("Предлогот е избришан");
    await loadOffers();
    setDeletingOffer(null);
  }

  async function submitComment(offerId: number) {
    const body = (commentDrafts[offerId] ?? "").trim();
    if (!body || !userId || savingFor) return;
    setSavingFor(offerId);
    const { error } = await supabase
      .from("issue_help_offer_comments")
      .insert({ offer_id: offerId, user_id: userId, body });
    if (error) {
      toast.error(error.message);
      setSavingFor(null);
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [offerId]: "" }));
    await loadOffers();
    setSavingFor(null);
  }

  const votersOffer =
    showVotersFor !== null ? offers.find((o) => o.id === showVotersFor) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-4 shrink-0">
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors">
          <ChevronRight size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-teal-600 shrink-0" />
            <p className="text-sm font-semibold text-zinc-800">
              Предложени датуми
            </p>
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                offers.length >= 3
                  ? "bg-amber-100 text-amber-700"
                  : "bg-zinc-100 text-zinc-500",
              )}>
              {offers.length}/3
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {issueTitle}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200">
        {loading && (
          <div className="space-y-3 p-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-zinc-100"
              />
            ))}
          </div>
        )}

        {!loading && offers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <CalendarDays size={40} className="text-zinc-200" />
            <p className="text-sm font-medium text-zinc-400">
              Нема предложени датуми
            </p>
            <p className="text-xs text-zinc-300">
              Кликни Помогни за да предложиш датум за акција.
            </p>
          </div>
        )}

        {offers.map((offer) => {
          const name =
            offer.profiles?.full_name ?? offer.profiles?.username ?? "Анонимно";
          const isOwn = offer.user_id === userId;
          const { weekday, dayMonth, year } = formatDate(offer.service_date!);
          const authorHref = offer.profiles?.username
            ? `/${offer.profiles.username}`
            : `/${offer.user_id}`;

          return (
            <div key={offer.id}>
              {/* Date hero */}
              <div
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5 ",
                  offer.voted_by_me
                    ? "bg-primary"
                    : "bg-zinc-50 border-zinc-200",
                )}>
                {/* Date */}
                <div
                  className={
                    offer.voted_by_me ? "text-white" : "text-zinc-800"
                  }>
                  <p className="text-[10px] font-medium capitalize opacity-70">
                    {weekday}
                  </p>
                  <p className="text-lg font-bold leading-tight">{dayMonth}</p>
                  <p className="text-[10px] opacity-60">{year}</p>
                </div>

                {/* Author + attendees */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        offer.voted_by_me ? "text-white" : "text-zinc-700",
                      )}>
                      {name}
                    </p>
                    <p
                      className={cn(
                        "text-[10px]",
                        offer.voted_by_me ? "text-white/70" : "text-zinc-400",
                      )}>
                      предложил/а
                    </p>
                  </div>
                  <Link href={authorHref} onClick={(e) => e.stopPropagation()}>
                    <AvatarInitials
                      name={name}
                      avatarUrl={offer.profiles?.avatar_url ?? null}
                      size="md"
                      className="ring-2 ring-white hover:opacity-80 transition-opacity"
                    />
                  </Link>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-3">
                {offer.note && (
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {offer.note}
                  </p>
                )}

                {/* Join / attending indicator */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => !isOwn && toggleVote(offer)}
                    disabled={!!votingFor}
                    className={cn(
                      "flex items-center gap-1 lg:gap-1.5 text-[10px] lg:text-sm font-medium transition-colors disabled:opacity-50",
                      offer.voted_by_me
                        ? "text-[#427FFF]"
                        : "text-zinc-500 hover:text-[#427FFF]",
                      isOwn && "cursor-default",
                    )}>
                    <PomogniIcon className="h-5 w-5 lg:h-4.5 lg:w-4.5" />
                    <span>
                      {isOwn
                        ? "Твoj предлог"
                        : offer.voted_by_me
                          ? "Идам!"
                          : "Идам и јас!"}
                    </span>
                  </button>
                  {isOwn && (
                    <button
                      onClick={() => deleteOffer(offer)}
                      disabled={deletingOffer === offer.id}
                      className="flex items-center justify-center h-6 w-6 rounded-full text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Избриши предлог">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {offer.vote_count > 0 && (
                    <button
                      onClick={() => setShowVotersFor(offer.id)}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 hover:underline transition-colors tabular-nums">
                      {offer.vote_count}
                    </button>
                  )}
                </div>

                {/* Comments */}
                {offer.comments.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {(() => {
                      const limit = commentLimits[offer.id] ?? 4;
                      const total = offer.comments.length;
                      const startIdx = Math.max(0, total - limit);
                      const visible = offer.comments.slice(startIdx);
                      const hidden = startIdx;
                      return (
                        <>
                          {hidden > 0 && (
                            <button
                              onClick={() =>
                                setCommentLimits((p) => ({
                                  ...p,
                                  [offer.id]: limit + 10,
                                }))
                              }
                              className="w-full text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors text-center py-0.5">
                              ↑ Прикажи постари ({hidden})
                            </button>
                          )}
                          {visible.map((c) => {
                            const commentHref = c.profiles?.username
                              ? `/${c.profiles.username}`
                              : `/${c.user_id}`;
                            const commentName =
                              c.profiles?.full_name ??
                              c.profiles?.username ??
                              "Анонимно";
                            return (
                              <div
                                key={c.id}
                                className="flex items-start gap-2">
                                <Link
                                  href={commentHref}
                                  onClick={(e) => e.stopPropagation()}>
                                  <AvatarInitials
                                    name={commentName}
                                    avatarUrl={c.profiles?.avatar_url ?? null}
                                    size="sm"
                                    className="shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
                                  />
                                </Link>
                                <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm">
                                  <Link
                                    href={commentHref}
                                    className="text-[11px] font-semibold text-zinc-700 hover:underline">
                                    {commentName}
                                  </Link>
                                  <p className="text-zinc-700 leading-snug">
                                    {c.body}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Comment input */}
                {userId ? (
                  <div className="flex items-center gap-2">
                    <AvatarInitials
                      name={
                        authProfile?.full_name ?? authProfile?.username ?? null
                      }
                      avatarUrl={authProfile?.avatar_url ?? null}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="flex flex-1 items-center rounded-2xl bg-zinc-100 pl-3 pr-1.5 py-1.5 gap-2">
                      <input
                        ref={(el) => {
                          inputRefs.current[offer.id] = el;
                        }}
                        value={commentDrafts[offer.id] ?? ""}
                        onChange={(e) =>
                          setCommentDrafts((p) => ({
                            ...p,
                            [offer.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            (commentDrafts[offer.id] ?? "").trim()
                          ) {
                            e.preventDefault();
                            submitComment(offer.id);
                          }
                        }}
                        placeholder="Коментирај…"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                      />
                      <button
                        onClick={() => submitComment(offer.id)}
                        disabled={
                          savingFor === offer.id ||
                          !(commentDrafts[offer.id] ?? "").trim()
                        }
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center transition-all active:scale-95",
                          (commentDrafts[offer.id] ?? "").trim()
                            ? "text-[#427FFF] hover:text-[#3570ee]"
                            : "text-zinc-300 cursor-default",
                        )}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 64 64"
                          fill="none">
                          <path
                            d="m16.5656 45.5515-11.78364-6.267c-3.67422-1.9541-3.71814-7.2034-.07711-9.2187l49.50775-27.40232c3.8263-2.117817 8.4128 1.10184 7.7186 5.42067l-7.9566 49.50095c-.5709 3.5515-4.466 5.4869-7.6415 3.798l-10.9257-5.8107-3.3381 3.3377c-2.9508 2.9504-7.9992 1.4408-8.8448-2.6459l-1.6068-7.765 17.3823-21.4992z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-zinc-400">
                    Најавете се за да коментирате
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Voters popup */}
      {votersOffer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowVotersFor(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={13} className="text-teal-600" />
                Учесници
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {votersOffer.voters.length}
                </span>
              </h3>
              <button
                onClick={() => setShowVotersFor(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-zinc-50 px-4 py-2">
              {votersOffer.voters.map((v) => {
                const vName =
                  v.profiles?.full_name ?? v.profiles?.username ?? "Анонимно";
                const vHref = v.profiles?.username
                  ? `/${v.profiles.username}`
                  : `/${v.user_id}`;
                return (
                  <Link
                    key={v.user_id}
                    href={vHref}
                    onClick={() => setShowVotersFor(null)}
                    className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 -mx-4 px-4 transition-colors">
                    <AvatarInitials
                      name={vName}
                      avatarUrl={v.profiles?.avatar_url ?? null}
                      size="sm"
                    />
                    <span className="text-sm text-zinc-800">{vName}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
