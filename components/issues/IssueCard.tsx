"use client";

import { useState, useRef, useEffect } from "react";
import BlurImage from "../ui/BlurImage";
import { IMAGE_QUALITY } from "../../lib/imageQuality";
import Link from "@/components/ui/Link";
import { Send, X, Link2 } from "lucide-react";
import StatusPill from "../ui/StatusPill";
import StatusTimelinePopup from "../ui/StatusTimelinePopup";
import AvatarInitials from "../ui/AvatarInitials";
import { formatDays, cn, getIssuePath } from "../../lib/utils";
import { incrementIssueViews } from "../../lib/views";
import type { Issue } from "../../lib/types/database";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const HelperModal = dynamic(() => import("./HelperModal"), { ssr: false });

function IstaMakaIcon({ className }: { className?: string }) {
  return (
    <svg
      width="35"
      height="49"
      viewBox="0 0 35 49"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M31.6967 22.5259C31.437 22.1027 18.8969 1.5043 18.3718 0.667791C17.811 -0.221342 16.509 -0.22525 15.9447 0.671986C14.889 2.36722 2.58627 22.5886 2.58627 22.5886C0.893804 25.3019 0 28.4341 0 31.6487C9.5329e-05 41.1111 7.69734 48.8084 17.1597 48.8084C26.622 48.8084 34.3193 41.1112 34.3193 31.6488C34.3193 28.4105 33.4117 25.2559 31.6967 22.5259ZM17.1597 43.0886C16.3693 43.0886 15.7298 42.449 15.7298 41.6587C15.7298 40.8683 16.3693 40.2287 17.1597 40.2287C21.8909 40.2287 25.7395 36.3801 25.7395 31.6489C25.7395 30.8586 26.379 30.219 27.1694 30.219C27.9598 30.219 28.5994 30.8586 28.5994 31.6489C28.5994 37.9567 23.4688 43.0886 17.1597 43.0886Z"
        fill="currentColor"
      />
    </svg>
  );
}

function KomentariIcon({ className }: { className?: string }) {
  return (
    <svg
      width="55"
      height="48"
      viewBox="0 0 55 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true">
      <path
        d="M32.1406 3.21976C28.7723 1.14232 24.7809 0 20.6578 0C9.43416 0 0 8.36197 0 19.0688C0 22.8226 1.16616 26.4212 3.38131 29.5291L0.286879 39.2442C-0.0400444 40.2704 0.728638 41.3156 1.80126 41.3156C2.0465 41.3156 2.29334 41.259 2.5211 41.1431L11.9317 36.3582C12.3128 36.5223 12.6986 36.6749 13.0884 36.8167C10.9095 33.4159 9.74625 29.5121 9.74625 25.425C9.74625 13.2531 19.9881 3.89553 32.1406 3.21976Z"
        fill="currentColor"
      />
      <path
        d="M50.8591 35.8855C53.0743 32.7776 54.2404 29.179 54.2404 25.4251C54.2404 14.7144 44.8022 6.35632 33.5826 6.35632C22.359 6.35632 12.9248 14.7183 12.9248 25.4251C12.9248 36.1358 22.363 44.4938 33.5826 44.4938C36.593 44.4938 39.5927 43.8803 42.3082 42.7143L51.7193 47.4994C52.2904 47.7898 52.9803 47.7087 53.4686 47.2938C53.9568 46.8788 54.1482 46.2112 53.9537 45.6007L50.8591 35.8855ZM27.1204 27.0141C26.2428 27.0141 25.5314 26.3027 25.5314 25.4251C25.5314 24.5475 26.2428 23.836 27.1204 23.836C27.998 23.836 28.7095 24.5475 28.7095 25.4251C28.7095 26.3027 27.998 27.0141 27.1204 27.0141ZM33.4767 27.0141C32.5991 27.0141 31.8876 26.3027 31.8876 25.4251C31.8876 24.5475 32.5991 23.836 33.4767 23.836C34.3543 23.836 35.0657 24.5475 35.0657 25.4251C35.0657 26.3027 34.3543 27.0141 33.4767 27.0141ZM39.8329 27.0141C38.9553 27.0141 38.2439 26.3027 38.2439 25.4251C38.2439 24.5475 38.9553 23.836 39.8329 23.836C40.7105 23.836 41.422 24.5475 41.422 25.4251C41.422 26.3027 40.7105 27.0141 39.8329 27.0141Z"
        fill="currentColor"
      />
    </svg>
  );
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
        d="M45.9744 25.6748C49.0811 22.3975 44.4512 17.8594 41.1035 20.9029L42.3191 19.709C45.4258 16.4286 40.7966 11.8937 37.4396 14.937L38.6638 13.7432C41.7731 10.4599 37.135 5.92765 33.7844 8.97032L35.0086 7.77732C38.1197 4.49237 33.4749 -0.0371303 30.1291 3.00457L27.3444 5.72967L29.7823 8.11729C33.3551 11.5221 31.4979 17.7049 26.6251 18.677C26.1633 20.9584 24.1155 22.9887 21.7549 23.4475C21.293 25.7332 19.2416 27.7652 16.875 28.2218C15.861 32.9889 9.60033 34.8115 6.08725 31.3015C6.08725 31.3016 3.65104 28.9157 3.65104 28.9157L0.433365 32.0644C-0.144521 32.6299 -0.144422 33.5468 0.433463 34.1123L14.1944 47.5761C14.7723 48.1414 15.7091 48.1413 16.2868 47.5757L21.5944 42.3792C26.2756 42.3792 30.7671 40.5584 34.0775 37.3178C39.1035 32.4016 45.9744 25.6748 45.9744 25.6748Z"
        fill="currentColor"
      />
      <path
        d="M7.64044 29.9682C10.9655 33.0935 15.5598 28.4359 12.4782 25.0675C15.8034 28.1926 20.3975 23.5352 17.3159 20.1667C20.6383 23.293 25.224 18.6283 22.1451 15.2667C25.4658 18.3906 30.0662 13.7376 26.9827 10.3659L19.7347 3.01426C18.3928 1.66191 16.2303 1.66191 14.8971 3.01426C13.5636 4.36662 13.5636 6.56275 14.8971 7.91511L16.1021 9.14009C12.7844 6.01275 8.17779 10.6854 11.273 14.0409L12.4781 15.2667C9.15451 12.1403 4.55843 16.7986 7.64044 20.1667L8.77998 21.3211C5.42347 18.3362 0.970948 22.9733 4.01629 26.2925C4.01639 26.2924 7.64044 29.9682 7.64044 29.9682Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ViewsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="42"
      height="46"
      viewBox="0 0 42 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}>
      <rect y="14" width="7" height="32" rx="2" fill="#636671" />
      <rect x="9" width="7" height="46" rx="2" fill="#636671" />
      <rect x="35" width="7" height="46" rx="2" fill="#636671" />
      <rect x="18" y="14" width="6" height="32" rx="2" fill="#636671" />
      <rect x="26" y="22" width="7" height="24" rx="2" fill="#636671" />
    </svg>
  );
}

function ClickHintIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}>
      <path
        fill="currentColor"
        d="m437.162 447.059-63.202 36.503c-21.239 12.269-44.049 18.405-66.85 18.406-22.807.001-45.606-6.134-66.851-18.406l-143.766-82.984c-6.377-3.684-10.942-9.654-12.857-16.81-1.916-7.156-.942-14.608 2.741-20.983 8.409-14.578 21.622-25.107 37.203-29.643 15.881-4.624 32.67-2.522 47.273 5.919l40.667 23.474-125.576-217.512c-5.554-9.631-7.017-20.882-4.124-31.684 2.897-10.814 9.801-19.824 19.438-25.373 9.61-5.559 20.866-7.03 31.679-4.134 10.808 2.894 19.825 9.788 25.392 19.412l58.078 100.625c3.215-9.795 9.807-17.934 18.757-23.086 15.144-8.744 33.563-6.89 46.596 3.247 2.443-11.065 9.335-21.11 19.888-27.203 16.92-9.74 37.887-6.294 50.897 7.112 2.954-9.358 9.189-17.144 17.705-22.051 8.984-5.204 19.503-6.589 29.61-3.888 10.121 2.704 18.565 9.164 23.776 18.189l62.484 108.215c36.857 63.874 14.893 145.812-48.958 182.656zm-357.093-395.771c40.215-23.21 91.818-9.387 115.037 30.819 4.677 8.09 7.954 16.833 9.74 25.986 1.586 8.131 9.46 13.438 17.595 11.851 8.131-1.586 13.437-9.463 11.851-17.595-2.423-12.423-6.869-24.286-13.21-35.252-31.486-54.522-101.472-73.27-156.013-41.791-54.521 31.486-73.27 101.472-41.803 155.99 6.334 11.012 14.386 20.795 23.931 29.08 2.839 2.464 6.34 3.672 9.826 3.672 4.195 0 8.369-1.751 11.335-5.168 5.43-6.257 4.76-15.731-1.497-21.161-7.01-6.084-12.929-13.278-17.601-21.399-23.21-40.214-9.387-91.817 30.809-115.031z"
      />
    </svg>
  );
}

interface UserEntry {
  user_id: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    membership_tier?: string | null;
    points?: number;
  } | null;
}

function UserListPopup({
  users,
  onClose,
}: {
  users: UserEntry[];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-xl shadow-xl border border-zinc-200 w-52 max-h-56 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
        <p className="text-xs font-semibold text-zinc-700">
          {users.length} луѓе
        </p>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 transition-colors">
          <X size={12} />
        </button>
      </div>
      {users.map((u) => {
        const name =
          u.profiles?.full_name ?? u.profiles?.username ?? "Анонимно";
        const href = u.profiles?.username
          ? `/${u.profiles.username}`
          : `/${u.user_id}`;
        return (
          <Link
            key={u.user_id}
            href={href}
            className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors">
            <AvatarInitials
              name={name}
              avatarUrl={u.profiles?.avatar_url ?? null}
              size="sm"
              membershipTier={u.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={u.profiles?.points}
            />
            <span className="text-xs text-zinc-700 truncate">{name}</span>
          </Link>
        );
      })}
    </div>
  );
}

interface Props {
  issue: Issue;
  userId?: string;
  onClick?: () => void;
  eagerImage?: boolean;
  // legacy — kept for callers that still pass it, ignored
  embeddedMobile?: boolean;
  selected?: boolean;
  onAffectedToggle?: (affected: boolean, count: number) => void;
}

export default function IssueCard({
  issue,
  userId,
  onClick,
  eagerImage = false,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [affectedCount, setAffectedCount] = useState(issue.affected_count ?? 0);
  const [helperCount, setHelperCount] = useState(issue.helper_count ?? 0);
  const [isAffected, setIsAffected] = useState(issue.is_affected ?? false);
  const [isHelper, setIsHelper] = useState(issue.is_helper ?? false);

  // Sync local optimistic state with the parent's `issue` prop whenever it
  // changes. Without this, the card stays visually "unliked" after the user
  // toggles, because the parent's updated issue object can't reach our
  // useState (it only runs on mount). Adding this is the proper fix for the
  // remount-on-key approach we removed for perf.
  useEffect(() => {
    const id = setTimeout(() => {
      setAffectedCount(issue.affected_count ?? 0);
      setHelperCount(issue.helper_count ?? 0);
      setIsAffected(issue.is_affected ?? false);
      setIsHelper(issue.is_helper ?? false);
    }, 0);
    return () => clearTimeout(id);
  }, [
    issue.affected_count,
    issue.helper_count,
    issue.is_affected,
    issue.is_helper,
  ]);
  const [helperOpen, setHelperOpen] = useState(false);
  const [loadingAff, setLoadingAff] = useState(false);

  const [affectedUsers, setAffectedUsers] = useState<UserEntry[]>([]);
  const [helperUsers, setHelperUsers] = useState<UserEntry[]>([]);
  const [showAffectedPop, setShowAffectedPop] = useState(false);
  const [showHelperPop, setShowHelperPop] = useState(false);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [showViewsPopup, setShowViewsPopup] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [sharePos, setSharePos] = useState({ top: 0, right: 0 });
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  const issuePath = getIssuePath(issue.id, issue.title);
  const authorHref = issue.profiles?.username
    ? `/${issue.profiles.username}`
    : issue.profiles?.id
      ? `/${issue.profiles.id}`
      : "#";

  function redirectToAuth() {
    if (typeof window === "undefined") return;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      toast.info("Најавете се за да продолжите");
      return;
    }
    const next = `${location.pathname}${location.search}`;
    location.href = `/auth/login?next=${encodeURIComponent(next)}`;
  }

  function openShareSheet() {
    if (shareButtonRef.current) {
      const r = shareButtonRef.current.getBoundingClientRect();
      setSharePos({
        top: r.bottom + 8,
        right: window.innerWidth - r.right - 15,
      });
    }
    setShareSheetOpen(true);
  }

  function closeShareSheet() {
    setShareSheetOpen(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}${issuePath}`);
    toast.success("Линкот е копиран!");
    closeShareSheet();
  }

  function shareInstagram() {
    navigator.clipboard.writeText(`${location.origin}${issuePath}`);
    toast.message("Линкот е копиран — залепи го во Instagram порака или bio.");
    closeShareSheet();
  }

  async function toggleAffected(e: React.MouseEvent) {
    e.stopPropagation();
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (loadingAff) return;
    setLoadingAff(true);
    const { createClient } = await import("../../lib/supabase/client");
    const supabase = createClient();
    if (isAffected) {
      await supabase
        .from("issue_affected")
        .delete()
        .eq("issue_id", issue.id)
        .eq("user_id", userId);
      const { count } = await supabase
        .from("issue_affected")
        .select("*", { count: "exact", head: true })
        .eq("issue_id", issue.id);
      setIsAffected(false);
      setAffectedCount(count ?? 0);
    } else {
      await supabase
        .from("issue_affected")
        .insert({ issue_id: issue.id, user_id: userId });
      const { count } = await supabase
        .from("issue_affected")
        .select("*", { count: "exact", head: true })
        .eq("issue_id", issue.id);
      setIsAffected(true);
      setAffectedCount(count ?? 0);
      toast.success("Означени сте како засегнати");
    }
    setLoadingAff(false);
  }

  function openHelper(e: React.MouseEvent) {
    e.stopPropagation();
    if (!userId) {
      redirectToAuth();
      return;
    }
    setHelperOpen(true);
  }

  async function showHelpers(e: React.MouseEvent) {
    e.stopPropagation();
    if (helperCount === 0) return;
    const { createClient } = await import("../../lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("issue_helpers")
      .select("user_id, profiles:user_id(full_name, avatar_url, username)")
      .eq("issue_id", issue.id);
    setHelperUsers(
      (data ?? []).map((r) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
      })) as UserEntry[],
    );
    setShowHelperPop(true);
    setShowAffectedPop(false);
  }

  async function showAffected(e: React.MouseEvent) {
    e.stopPropagation();
    if (affectedCount === 0) return;
    const { createClient } = await import("../../lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("issue_affected")
      .select("user_id, profiles:user_id(full_name, avatar_url, username)")
      .eq("issue_id", issue.id);
    setAffectedUsers(
      (data ?? []).map((r) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
      })) as UserEntry[],
    );
    setShowAffectedPop(true);
    setShowHelperPop(false);
  }

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof window === "undefined") return;

    let hasCounted = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.6) return;
        if (hasCounted) return;
        hasCounted = true;
        observer.disconnect();
        void incrementIssueViews(issue.id);
      },
      { threshold: [0.6] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [issue.id]);

  const hasPhoto = !!(issue.photo_url || issue.after_photo_url);

  return (
    <>
      {(showAffectedPop || showHelperPop) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowAffectedPop(false);
            setShowHelperPop(false);
          }}
        />
      )}

      <article
        ref={cardRef}
        onClick={onClick}
        className="issue-feed-card cursor-pointer bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href={authorHref}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 group min-w-0">
            <AvatarInitials
              name={issue.profiles?.full_name}
              avatarUrl={issue.profiles?.avatar_url}
              size="sm"
              membershipTier={issue.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={issue.profiles?.points}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-800 group-hover:underline leading-tight truncate">
                {issue.profiles?.full_name ?? "Анонимно"}
              </p>
              <p className="text-[11px] text-zinc-400 leading-tight">
                {formatDays(issue.created_at)}
              </p>
            </div>
          </Link>

          <div className="shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusPopup(true);
              }}
              className="group cursor-pointer p-0.5 focus-visible:outline-none"
              title="Кликни за статус детали"
              aria-label="Прикажи статус детали">
              <span className="inline-flex items-center gap-1.5 leading-none">
                {issue.status === "open" && (
                  <span className="h-1.5 w-1.5 self-center animate-[pulse_0.8s_ease-in-out_infinite] rounded-full bg-red-500" />
                )}
                <span className="inline-flex items-center self-center rounded-full transition-colors group-hover:bg-zinc-100">
                  <StatusPill status={issue.status} />
                </span>
                <ClickHintIcon className="h-3.5 w-3.5 self-center text-zinc-400 transition-colors group-hover:text-zinc-600" />
              </span>
            </button>
          </div>
        </div>

        {/* ── Image ──────────────────────────────────────── */}
        {hasPhoto &&
          (issue.photo_url && issue.after_photo_url ? (
            <div className="relative grid grid-cols-2">
              <div className="relative">
                <BlurImage
                  quality={IMAGE_QUALITY.feed}
                  src={issue.photo_url}
                  alt="Пред"
                  width={1200}
                  height={900}
                  loading={eagerImage ? "eager" : "lazy"}
                  priority={eagerImage}
                  sizes="50vw"
                  rounded="rounded-none"
                  className="h-[26rem] w-full object-cover lg:h-[32rem]"
                />
                <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Пред
                </span>
              </div>
              <div className="relative">
                <BlurImage
                  quality={IMAGE_QUALITY.feed}
                  src={issue.after_photo_url}
                  alt="Потоа"
                  width={1200}
                  height={900}
                  loading={eagerImage ? "eager" : "lazy"}
                  priority={eagerImage}
                  sizes="50vw"
                  rounded="rounded-none"
                  className="h-[26rem] w-full object-cover lg:h-[32rem]"
                />
                <span className="absolute top-2 left-2 rounded-md bg-teal-600/90 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Потоа
                </span>
              </div>
              {/* Solver bar — spans both images on mobile, confined to the
                  "Потоа" image (no avatar) on desktop. The free-text label wins
                  over the registered resolver (and shows no avatar). */}
              {(issue.resolved_by_label?.trim() || issue.resolver) && (
                <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/85 to-black/35 px-3 py-2 backdrop-blur-sm lg:left-1/2">
                  <span className="text-[30px] leading-none">🏆</span>
                  {!issue.resolved_by_label?.trim() && issue.resolver && (
                    <AvatarInitials
                      name={
                        issue.resolver.full_name ??
                        issue.resolver.username ??
                        ""
                      }
                      avatarUrl={issue.resolver.avatar_url}
                      size="sm"
                      className="w-8! h-8! text-[11px]!"
                    />
                  )}
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[8px] font-medium uppercase tracking-wide text-white/70">
                      Решено од
                    </span>
                    <span className="truncate text-sm font-bold text-white">
                      {issue.resolved_by_label?.trim() ||
                        issue.resolver?.full_name ||
                        issue.resolver?.username ||
                        "Херој"}
                    </span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <BlurImage
              quality={IMAGE_QUALITY.feed}
              src={(issue.photo_url ?? issue.after_photo_url)!}
              alt="Фотографија"
              width={1600}
              height={900}
              loading={eagerImage ? "eager" : "lazy"}
              priority={eagerImage}
              sizes="(max-width: 768px) 100vw, 640px"
              rounded="rounded-none"
              className="h-[28rem] w-full object-cover lg:h-[34rem]"
            />
          ))}

        {/* ── Title ──────────────────────────────────────── */}
        <div className={cn("px-4", hasPhoto ? "pt-3 pb-1" : "pt-2 pb-1")}>
          <p className="text-base font-semibold text-zinc-800 line-clamp-2 leading-snug lg:text-lg">
            {issue.title}
          </p>
        </div>

        {/* ── Action bar ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-1.5 pb-4">
          <div className="flex items-center gap-2.5 lg:gap-3">
            {/* Иста мака */}
            <div className="relative flex items-center gap-1 lg:gap-1.5">
              <button
                onClick={showAffected}
                className={cn(
                  "text-[10px] lg:text-[13px] font-bold tabular-nums transition-colors",
                  affectedCount > 0
                    ? "text-zinc-700 hover:text-[#427FFF] cursor-pointer"
                    : "text-zinc-400 cursor-default",
                )}>
                {affectedCount}
              </button>
              <button
                onClick={toggleAffected}
                disabled={loadingAff}
                className={cn(
                  "flex items-center gap-1 text-[9px] lg:text-[13px] font-medium transition-colors",
                  isAffected
                    ? "text-[#427FFF]"
                    : "text-zinc-500 hover:text-[#427FFF]",
                )}>
                <IstaMakaIcon className="h-4.5 w-4.5 lg:h-4 lg:w-4" />
                <span className="hidden min-[380px]:inline">Иста мака</span>
              </button>
              {showAffectedPop && affectedUsers.length > 0 && (
                <UserListPopup
                  users={affectedUsers}
                  onClose={() => setShowAffectedPop(false)}
                />
              )}
            </div>

            {/* Помогни */}
            <div className="relative flex items-center gap-1 lg:gap-1.5">
              <button
                onClick={showHelpers}
                className={cn(
                  "text-[10px] lg:text-[13px] font-bold tabular-nums transition-colors",
                  helperCount > 0
                    ? "text-zinc-700 hover:text-[#427FFF] cursor-pointer"
                    : "text-zinc-400 cursor-default",
                )}>
                {helperCount}
              </button>
              <button
                onClick={openHelper}
                className={cn(
                  "flex items-center gap-1 text-[9px] lg:text-[13px] font-medium transition-colors",
                  isHelper
                    ? "text-[#427FFF]"
                    : "text-zinc-500 hover:text-[#427FFF]",
                )}>
                <PomogniIcon className="h-4.5 w-4.5 lg:h-4 lg:w-4" />
                <span className="hidden min-[380px]:inline">Помогни</span>
              </button>
              {showHelperPop && helperUsers.length > 0 && (
                <UserListPopup
                  users={helperUsers}
                  onClose={() => setShowHelperPop(false)}
                />
              )}
            </div>

            {/* Коментари */}
            <div className="flex items-center gap-1.5 lg:gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
                className="flex items-center gap-1 text-[9px] lg:text-[13px] font-medium text-zinc-500 hover:text-[#427FFF] transition-colors">
                <span
                  className={cn(
                    "text-[10px] lg:text-[13px] font-bold tabular-nums",
                    (issue.comment_count ?? 0) > 0
                      ? "text-zinc-700"
                      : "text-zinc-400",
                  )}>
                  {issue.comment_count ?? 0}
                </span>
                <KomentariIcon className="h-4.5 w-4.5 lg:h-4 lg:w-4" />
                <span className="hidden min-[380px]:inline">Коментари</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewsPopup(true);
                }}
                className="ml-1.5 lg:ml-2.5 flex items-center gap-1 text-[9px] lg:text-[13px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
                aria-label="Информации за прегледи">
                <ViewsIcon className="h-3.5 w-auto lg:h-3.5 lg:w-auto opacity-75" />
                <span className="tabular-nums text-zinc-500">
                  {issue.views ?? 0}
                </span>
              </button>
            </div>
          </div>

          {/* Сподели */}
          <div className="relative">
            <button
              ref={shareButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                openShareSheet();
              }}
              className="flex items-center gap-1 text-[9px] lg:text-[13px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors">
              <Send size={13} className="lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">Сподели</span>
            </button>

            {shareSheetOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeShareSheet();
                  }}
                />
                <div
                  className="fixed z-50 w-48 overflow-hidden rounded-xl bg-white shadow-lg"
                  style={{ top: sharePos.top, right: sharePos.right }}
                  onClick={(e) => e.stopPropagation()}>
                  {[
                    {
                      label: "Копирај линк",
                      icon: <Link2 size={15} />,
                      href: null as string | null,
                      action: copyLink,
                    },
                    {
                      label: "Facebook",
                      icon: (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-3.75 h-3.75">
                          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                        </svg>
                      ),
                      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? `${window.location.origin}${issuePath}` : issuePath)}`,
                      action: null as (() => void) | null,
                    },
                    {
                      label: "Instagram",
                      icon: (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          className="w-3.75 h-3.75">
                          <rect
                            x="2"
                            y="2"
                            width="20"
                            height="20"
                            rx="5"
                            ry="5"
                          />
                          <circle cx="12" cy="12" r="4" />
                          <circle
                            cx="17.5"
                            cy="6.5"
                            r="0.5"
                            fill="currentColor"
                            stroke="none"
                          />
                        </svg>
                      ),
                      href: null,
                      action: shareInstagram,
                    },
                    {
                      label: "WhatsApp",
                      icon: (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-3.75 h-3.75">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                      ),
                      href: `https://wa.me/?text=${encodeURIComponent(`${issue.title} ${typeof window !== "undefined" ? `${window.location.origin}${issuePath}` : issuePath}`)}`,
                      action: null,
                    },
                    {
                      label: "Viber",
                      icon: (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-3.75 h-3.75">
                          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14.5c-.28 0-.53-.11-.71-.29l-2-2a1 1 0 0 1 0-1.42l.5-.5c.2-.2.2-.51 0-.71l-2-2a.5.5 0 0 0-.71 0l-.5.5C7.08 11.08 7 12 7 12c0 2.76 2.24 5 5 5 0 0 .92-.08 1.92-1.08l.5-.5c.2-.2.2-.51 0-.71l-2-2a.5.5 0 0 0-.71 0l-.5.5c-.2.2-.51.2-.71 0z" />
                        </svg>
                      ),
                      href: `viber://forward?text=${encodeURIComponent(`${issue.title} ${typeof window !== "undefined" ? `${window.location.origin}${issuePath}` : issuePath}`)}`,
                      action: null,
                    },
                  ].map((item) =>
                    item.href ? (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeShareSheet}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-700 lg:hover:bg-zinc-50 transition-colors">
                        <span className="text-zinc-400">{item.icon}</span>
                        {item.label}
                      </a>
                    ) : (
                      <button
                        key={item.label}
                        onClick={item.action ?? closeShareSheet}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-700 lg:hover:bg-zinc-50 transition-colors">
                        <span className="text-zinc-400">{item.icon}</span>
                        {item.label}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </article>

      {showViewsPopup && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowViewsPopup(false)}
          />
          <div className="fixed inset-0 z-51 flex items-center justify-center px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Прегледи
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    Овој број покажува колку пати пријавата е видена во feed или
                    отворена во детали.
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    За повеќе информации, отвори{" "}
                    <Link
                      href="/info/views"
                      className="font-semibold text-slate-800 underline underline-offset-2 hover:text-slate-900"
                      onClick={() => setShowViewsPopup(false)}>
                      Центар за помош
                    </Link>
                    .
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                  onClick={() => setShowViewsPopup(false)}
                  aria-label="Затвори">
                  <X size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowViewsPopup(false)}
                className="mt-5 w-full rounded-full bg-[#e4e7eb] py-2.5 text-sm font-semibold text-slate-800 hover:bg-[#d9dde2] transition-colors">
                Во ред
              </button>
            </div>
          </div>
        </>
      )}

      {helperOpen && userId && (
        <HelperModal
          issueId={issue.id}
          issueTitle={issue.title}
          userId={userId}
          onClose={() => setHelperOpen(false)}
          onSuccess={(count) => {
            setIsHelper(true);
            setHelperCount(count);
            setHelperOpen(false);
          }}
        />
      )}

      {showStatusPopup && (
        <StatusTimelinePopup
          issue={issue}
          onClose={() => setShowStatusPopup(false)}
        />
      )}
    </>
  );
}
