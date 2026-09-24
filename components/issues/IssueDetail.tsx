"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const HelperModal = dynamic(() => import("./HelperModal"), { ssr: false });
import BlurImage from "../ui/BlurImage";
import { IMAGE_QUALITY } from "../../lib/imageQuality";
import { compressImage } from "../../lib/compressImage";
import Image from "next/image";
import Link from "@/components/ui/Link";
import {
  X,
  Share2,
  MapPin,
  MessageCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  HandHelping,
  Users,
  MoreHorizontal,
  Check,
  Camera,
  ImagePlus,
  X as XIcon,
  ChevronRight,
} from "lucide-react";

import SendIcon from "../ui/SendIcon";

import AvatarInitials from "../ui/AvatarInitials";
import ImageLightbox from "../ui/ImageLightbox";
import {
  formatDays,
  cn,
  getIssuePath,
  cdnUrl,
  bucketObjectPath,
  DISTRICT_LABELS,
} from "../../lib/utils";
import { incrementIssueViews } from "../../lib/views";
import { agencyHandlesCategory } from "../../lib/agencies";
import {
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_MENU_TEXT_CLASSES,
} from "../../lib/status";
import type { Issue, IssueStatus, District } from "../../lib/types/database";

// The Naselba (district) options an admin can reassign an issue to. Order
// mirrors the filter dropdown; labels come from DISTRICT_LABELS.
const DISTRICT_OPTIONS: District[] = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
  "KorzoMaalo",
];
import { toast } from "sonner";
import { createClient } from "../../lib/supabase/client";
import { useAuth } from "../../lib/hooks/useAuth";
import { createNotification } from "../../lib/notifications";
import {
  fetchIssueComments,
  fetchIssuePeopleStats,
  fetchIssueChangeRequests,
  fetchIssueResolverInfo,
  fetchIssueHelpOffers,
  type IssueComment,
  type HelpOffer,
  type PeopleUser,
  type ChangeRequest,
} from "../../lib/data/issues";

interface Props {
  issue: Issue;
  userId?: string;
  onClose?: () => void;
  onOpenDates?: () => void;
  variant?: "full" | "engagement";
  hideImage?: boolean;
}

// Types now live in lib/data/issues.ts (imported above) so they can be
// reused on mobile.

function PeoplePopup({
  title,
  icon,
  users,
  accentColor,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  users: PeopleUser[];
  accentColor: "slate" | "teal";
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {icon}
            {title}
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                accentColor === "teal"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-slate-100 text-slate-700"
              }`}>
              {users.length}
            </span>
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-zinc-50 px-4 py-2">
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
                onClick={onClose}
                className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-zinc-50 -mx-4 px-4 transition-colors">
                <AvatarInitials
                  name={name}
                  avatarUrl={u.profiles?.avatar_url ?? null}
                  size="sm"
                  membershipTier={u.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                  points={u.profiles?.points}
                />
                <span className="text-sm text-zinc-800">{name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ChangeRequest type imported from lib/data/issues.ts

export default function IssueDetail({
  issue,
  userId,
  onClose,
  onOpenDates,
  variant = "full",
  hideImage = false,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  function redirectToAuth() {
    if (typeof window === "undefined") return;
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  const [currentIssue, setCurrentIssue] = useState<Issue>(issue);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(issue.title);
  const [editDescription, setEditDescription] = useState(
    issue.description ?? "",
  );
  const [editStreet, setEditStreet] = useState(issue.street_name ?? "");
  const [editDistrict, setEditDistrict] = useState<District>(issue.district as District);
  const [savingIssue, setSavingIssue] = useState(false);
  const [deletingIssue, setDeletingIssue] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [savingComment, setSavingComment] = useState(false);
  const [commentsUnavailable, setCommentsUnavailable] = useState(false);
  const [affectedUsers, setAffectedUsers] = useState<PeopleUser[]>([]);
  const [helperUsers, setHelperUsers] = useState<PeopleUser[]>([]);
  const [showAffectedPopup, setShowAffectedPopup] = useState(false);
  const [showHelperPopup, setShowHelperPopup] = useState(false);
  const [helpOffers, setHelpOffers] = useState<HelpOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [offersUnavailable, setOffersUnavailable] = useState(false);
  const [offerCommentDrafts, setOfferCommentDrafts] = useState<
    Record<number, string>
  >({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savingOfferCommentFor, setSavingOfferCommentFor] = useState<
    number | null
  >(null);
  const [votingForOffer, setVotingForOffer] = useState<number | null>(null);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const approvingInFlight = useRef(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showModMenu, setShowModMenu] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<number>>(new Set());
  const [commentLimit, setCommentLimit] = useState(4);
  const [commentLikeCounts, setCommentLikeCounts] = useState<
    Record<number, number>
  >({});
  const [openCommentMenu, setOpenCommentMenu] = useState<number | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<number | null>(
    null,
  );
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [replyToUserId, setReplyToUserId] = useState<string | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<number | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const inlineReplyRef = useRef<HTMLTextAreaElement>(null);
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(
    null,
  );
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  // proposal modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeStatus, setProposeStatus] = useState<
    "progress" | "resolved" | null
  >(null);
  const [proposeDesc, setProposeDesc] = useState("");
  const [proposeFile, setProposeFile] = useState<File | null>(null);
  const [proposePreview, setProposePreview] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  // direct helper check (for full-page where is_helper may not be pre-loaded)
  const [isHelperDirect, setIsHelperDirect] = useState(
    Boolean(currentIssue.is_helper),
  );
  const [helperOpen, setHelperOpen] = useState(false);
  const [isAffected, setIsAffected] = useState(Boolean(issue.is_affected));
  // resolver info & upvote state
  const [resolver, setResolver] = useState<{
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    membership_tier?: string | null;
    points?: number;
  } | null>(null);
  const [resolverUpvotes, setResolverUpvotes] = useState<number>(0);
  const [hasUpvotedResolver, setHasUpvotedResolver] = useState(false);
  const [upvotingResolver, setUpvotingResolver] = useState(false);

  const { profile: authProfile } = useAuth();
  const isAdmin = Boolean(authProfile?.is_admin);
  const isOwner = Boolean(userId && currentIssue.reported_by === userId);
  const canModerate = isOwner || isAdmin;
  // Operator account whose institution handles this issue's category.
  const canAgencyHandle = agencyHandlesCategory(
    authProfile?.agency_id,
    currentIssue.category,
  );
  // Who may advance the status (owner, admin, or the responsible institution).
  const canManageStatus = canModerate || canAgencyHandle;

  // Ensure isHelperDirect is set for any authenticated user who has already
  // registered as a helper. Skip if the server-side prefetch (page.tsx) already
  // told us — only fire when is_helper is undefined on the input issue.
  useEffect(() => {
    if (!userId || isHelperDirect) return;
    if (typeof currentIssue.is_helper === "boolean") return; // server already resolved
    supabase
      .from("issue_helpers")
      .select("user_id")
      .eq("issue_id", currentIssue.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsHelperDirect(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id, userId]);

  useEffect(() => {
    // Sync external `issue` prop into local state. Defer to next tick so the
    // setState calls don't run synchronously during commit.
    const id = setTimeout(() => {
      setCurrentIssue(issue);
      setEditTitle(issue.title);
      setEditDescription(issue.description ?? "");
      setEditStreet(issue.street_name ?? "");
      setEditDistrict(issue.district as District);
      setIsEditing(false);
    }, 0);
    return () => clearTimeout(id);
  }, [issue]);

  const shareUrl = useMemo(() => {
    const path = getIssuePath(currentIssue.id, currentIssue.title);
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [currentIssue.id, currentIssue.title]);

  async function loadComments() {
    setLoadingComments(true);
    const result = await fetchIssueComments(supabase, currentIssue.id, userId);
    if (!result.ok) {
      if (result.tableMissing) setCommentsUnavailable(true);
      setLoadingComments(false);
      return;
    }
    setCommentsUnavailable(false);
    setComments(result.comments);
    setCommentLikeCounts(result.likeCounts);
    setLikedComments(result.likedComments);
    setLoadingComments(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadComments();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id]);

  async function loadPeopleStats() {
    const { affected, helpers } = await fetchIssuePeopleStats(
      supabase,
      currentIssue.id,
    );
    setAffectedUsers(affected);
    setHelperUsers(helpers);
  }

  useEffect(() => {
    const id = setTimeout(() => loadPeopleStats(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id]);

  async function loadChangeRequests() {
    const result = await fetchIssueChangeRequests(supabase, currentIssue.id);
    if (!result.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "loadChangeRequests error:",
          result.error.message,
          result.error.code,
        );
      }
      return;
    }
    setPendingRequests(result.requests);
  }

  useEffect(() => {
    if (!canModerate) return;
    const id = setTimeout(() => loadChangeRequests(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id, canModerate]);

  async function loadResolverInfo() {
    const info = await fetchIssueResolverInfo(supabase, currentIssue.id);
    if (!info) {
      setResolver(null);
      setResolverUpvotes(0);
      setHasUpvotedResolver(false);
      return;
    }
    setResolver(info.resolver);
    setResolverUpvotes(info.upvote_count);
    setHasUpvotedResolver(info.has_upvoted);
  }

  useEffect(() => {
    // Defer to next tick so async setState resolves don't fire synchronously
    // during the render commit phase.
    const id = setTimeout(() => {
      if (currentIssue.status === "resolved") {
        loadResolverInfo();
      } else {
        setResolver(null);
        setResolverUpvotes(0);
        setHasUpvotedResolver(false);
      }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id, currentIssue.status, currentIssue.resolved_by, userId]);

  const [savingResolver, setSavingResolver] = useState(false);
  // Free-text resolver name (admin-only), edited independently of the dropdown.
  const [resolvedLabel, setResolvedLabel] = useState(issue.resolved_by_label ?? "");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(
    issue.views ?? null,
  );

  useEffect(() => {
    incrementIssueViews(issue.id).then((data) => {
      if (typeof data === "number") setViewCount(data);
    });
  }, [issue.id]);

  async function setResolverFor(newResolverId: string | null) {
    if (!canModerate || !userId || savingResolver) return;
    setSavingResolver(true);
    let q = supabase
      .from("issues")
      .update({ resolved_by: newResolverId })
      .eq("id", currentIssue.id);
    if (!isAdmin) q = q.eq("reported_by", userId);
    const { error } = await q;
    if (error) {
      toast.error(error.message);
      setSavingResolver(false);
      return;
    }
    setCurrentIssue((prev) => ({ ...prev, resolved_by: newResolverId }));
    await loadResolverInfo();
    toast.success("Решавачот е променет");
    setSavingResolver(false);
  }

  async function saveResolverLabel() {
    // Admins only. Empty string clears the label back to null.
    if (!isAdmin || savingResolver) return;
    const value = resolvedLabel.trim() || null;
    if (value === (currentIssue.resolved_by_label ?? null)) return;
    setSavingResolver(true);
    const { error } = await supabase
      .from("issues")
      .update({ resolved_by_label: value })
      .eq("id", currentIssue.id);
    if (error) {
      toast.error(error.message);
      setSavingResolver(false);
      return;
    }
    setCurrentIssue((prev) => ({ ...prev, resolved_by_label: value }));
    toast.success("Зачувано");
    setSavingResolver(false);
  }

  async function toggleResolverUpvote() {
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (upvotingResolver) return;
    // Applause works for a free-text resolver too (no profile, but the upvote is
    // keyed by issue, not by the resolver's user id).
    const hasLabel = !!currentIssue.resolved_by_label?.trim();
    if (!resolver && !hasLabel) return;
    if (resolver && resolver.id === userId) {
      toast.error("Не можеш да гласаш за себе");
      return;
    }
    setUpvotingResolver(true);
    if (hasUpvotedResolver) {
      const { error } = await supabase
        .from("issue_resolution_upvotes")
        .delete()
        .eq("issue_id", currentIssue.id)
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        setUpvotingResolver(false);
        return;
      }
      setHasUpvotedResolver(false);
      setResolverUpvotes((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase
        .from("issue_resolution_upvotes")
        .insert({ issue_id: currentIssue.id, user_id: userId });
      if (error) {
        toast.error(error.message);
        setUpvotingResolver(false);
        return;
      }
      setHasUpvotedResolver(true);
      setResolverUpvotes((c) => c + 1);
      toast.success("Благодарност испратена!");
    }
    setUpvotingResolver(false);
  }

  async function loadHelpOffers() {
    setLoadingOffers(true);
    const result = await fetchIssueHelpOffers(
      supabase,
      currentIssue.id,
      userId,
    );
    if (!result.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[loadHelpOffers]",
          result.error.code,
          result.error.message,
        );
      }
      if (result.tableMissing) setOffersUnavailable(true);
      setLoadingOffers(false);
      return;
    }
    setOffersUnavailable(false);
    setHelpOffers(result.offers);
    setLoadingOffers(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHelpOffers();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIssue.id, userId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function toggleOfferVote(offer: HelpOffer) {
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (!offer.service_date) {
      toast.error("Овој помошник нема предложен датум");
      return;
    }
    if (votingForOffer) return;

    setVotingForOffer(offer.id);
    if (offer.voted_by_me) {
      const { error } = await supabase
        .from("issue_help_date_votes")
        .delete()
        .eq("offer_id", offer.id)
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        setVotingForOffer(null);
        return;
      }
    } else {
      const { error } = await supabase
        .from("issue_help_date_votes")
        .insert({ offer_id: offer.id, user_id: userId });
      if (error) {
        toast.error(error.message);
        setVotingForOffer(null);
        return;
      }
    }

    await loadHelpOffers();
    setVotingForOffer(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function submitOfferComment(offerId: number) {
    const body = (offerCommentDrafts[offerId] ?? "").trim();
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (!body) return;

    setSavingOfferCommentFor(offerId);
    const { error } = await supabase
      .from("issue_help_offer_comments")
      .insert({ offer_id: offerId, user_id: userId, body });

    if (error) {
      toast.error(error.message);
      setSavingOfferCommentFor(null);
      return;
    }

    setOfferCommentDrafts((prev) => ({ ...prev, [offerId]: "" }));
    await loadHelpOffers();
    setSavingOfferCommentFor(null);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Линкот е копиран!");
  }

  function openShareWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareFacebook() {
    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    );
  }

  function shareWhatsApp() {
    const text = `${currentIssue.title} - ${shareUrl}`;
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  function shareViber() {
    const text = `${currentIssue.title} - ${shareUrl}`;
    openShareWindow(`viber://forward?text=${encodeURIComponent(text)}`);
  }

  function shareInstagram() {
    copyLink();
    openShareWindow("https://www.instagram.com/");
    toast.message(
      "Линкот е копиран. Вметнете го во Instagram порака или story.",
    );
  }

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus>(
    currentIssue.status,
  );
  const autoAckRef = useRef(false);

  // Keep the operator's pending selection in sync when the live status changes
  // (e.g. the auto-acknowledge below, or a successful save).
  useEffect(() => {
    setSelectedStatus(currentIssue.status);
  }, [currentIssue.status]);

  async function changeStatus(newStatus: IssueStatus, note?: string) {
    if (!canManageStatus || !userId || changingStatus) return;
    if (newStatus === currentIssue.status && !note?.trim()) return;
    setChangingStatus(true);
    // Privileged write goes through the role-checked RPC, which also appends a
    // status-log row and notifies the reporter.
    const { error } = await supabase.rpc("agency_set_issue_status", {
      p_issue_id: currentIssue.id,
      p_status: newStatus,
      p_note: note?.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      setCurrentIssue((prev) => ({
        ...prev,
        status: newStatus,
        // Leaving resolved clears the resolver (mirrors the RPC).
        resolved_by:
          newStatus === "resolved" ? prev.resolved_by : null,
      }));
      toast.success("Статусот е променет");
      setStatusNote("");
      if (newStatus === "resolved") loadResolverInfo();
    }
    setChangingStatus(false);
  }

  // When the responsible institution opens a still-untouched ("open") issue,
  // auto-advance it to "Видено" once — so the reporter sees it was seen.
  useEffect(() => {
    if (autoAckRef.current) return;
    if (!canAgencyHandle || !userId) return;
    if (currentIssue.status !== "open") return;
    autoAckRef.current = true;
    changeStatus("acknowledged");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAgencyHandle, userId, currentIssue.status]);

  async function uploadAfterPhoto(file: File) {
    if (!canModerate || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Избери слика (jpg/png/webp)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Сликата е преголема (макс 8MB)");
      return;
    }
    setUploadingAfter(true);
    // Compressed for the same reason as the report photos: mobile downloads
    // the stored object itself, so its size is a recurring egress bill.
    const photo = await compressImage(file);
    const ext = photo.name.split(".").pop() ?? "jpg";
    const { data, error } = await supabase.storage
      .from("issue-photos")
      .upload(`${currentIssue.id}/after-${Date.now()}.${ext}`, photo, {
        contentType: photo.type,
        cacheControl: "31536000",
        upsert: true,
      });
    if (error) {
      toast.error(error.message);
      setUploadingAfter(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("issue-photos").getPublicUrl(data.path);
    const { error: upd } = await supabase
      .from("issues")
      .update({ after_photo_url: publicUrl })
      .eq("id", currentIssue.id);
    if (upd) {
      toast.error(upd.message);
      setUploadingAfter(false);
      return;
    }
    setCurrentIssue((prev) => ({ ...prev, after_photo_url: publicUrl }));
    toast.success("Фотографијата е прикачена");
    setUploadingAfter(false);
  }

  async function submitProposal() {
    if (!userId || !proposeStatus || !proposeDesc.trim() || proposing) return;
    setProposing(true);
    let afterPhotoUrl: string | null = null;
    if (proposeFile) {
      const photo = await compressImage(proposeFile);
      const ext = photo.name.split(".").pop() ?? "jpg";
      const { data, error } = await supabase.storage
        .from("issue-photos")
        .upload(
          `${userId}/proposals/${currentIssue.id}-${Date.now()}.${ext}`,
          photo,
          { contentType: photo.type, cacheControl: "31536000", upsert: true },
        );
      if (error) {
        toast.error(error.message);
        setProposing(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("issue-photos").getPublicUrl(data.path);
      afterPhotoUrl = publicUrl;
    }
    const { error } = await supabase.rpc("submit_change_request", {
      p_issue_id: currentIssue.id,
      p_payload: {
        status: proposeStatus,
        description: proposeDesc.trim(),
        after_photo_url: afterPhotoUrl,
      },
    });
    if (error) {
      toast.error(error.message);
      setProposing(false);
      return;
    }
    toast.success("Барањето е испратено до авторот за одобрување");
    setShowProposeModal(false);
    setProposeStatus(null);
    setProposeDesc("");
    setProposeFile(null);
    setProposePreview(null);
    setProposing(false);
  }

  async function saveIssueEdits() {
    if (!canModerate || !userId) return;

    const title = editTitle.trim();
    if (title.length < 4) {
      toast.error("Насловот мора да има барем 4 знаци");
      return;
    }

    setSavingIssue(true);

    const payload = {
      title,
      description: editDescription.trim() || null,
      street_name: editStreet.trim() || null,
      // Only admins may reassign the Naselba; for a plain author keep it as-is.
      ...(isAdmin ? { district: editDistrict } : {}),
    };

    let q = supabase.from("issues").update(payload).eq("id", currentIssue.id);
    if (!isAdmin) q = q.eq("reported_by", userId);
    const { data, error } = await q
      .select("*, profiles:reported_by(id, full_name, avatar_url, username)")
      .single();

    if (error) {
      toast.error(error.message);
      setSavingIssue(false);
      return;
    }

    setCurrentIssue((prev) => ({ ...prev, ...data }) as Issue);
    setIsEditing(false);
    setSavingIssue(false);
    toast.success("Пријавата е ажурирана");
  }

  // Remove an issue's photos from the `issue-photos` bucket: the before/after
  // shots on the post itself, plus every comment image under comments/<id>/
  // (comments cascade-delete with the issue, orphaning their files). Best-effort
  // — swallows errors so it can never block the deletion that already happened.
  async function cleanupIssuePhotos(
    issueId: number,
    issuePhotoUrls: (string | null | undefined)[],
  ) {
    try {
      const paths = new Set<string>();
      for (const url of issuePhotoUrls) {
        const p = bucketObjectPath(url, "issue-photos");
        if (p) paths.add(p);
      }
      // Comment images live in a per-issue folder — list and add them all.
      const { data: files } = await supabase.storage
        .from("issue-photos")
        .list(`comments/${issueId}`, { limit: 1000 });
      for (const f of files ?? []) paths.add(`comments/${issueId}/${f.name}`);

      if (paths.size > 0) {
        await supabase.storage.from("issue-photos").remove([...paths]);
      }
    } catch {
      // Orphaned files are harmless (and still captured by backups); ignore.
    }
  }

  async function deleteIssue() {
    if (!canModerate || !userId || deletingIssue) return;

    const ok = window.confirm(
      "Дали сигурно сакаш да ја избришеш оваа пријава?",
    );
    if (!ok) return;

    setDeletingIssue(true);

    let q = supabase.from("issues").delete().eq("id", currentIssue.id);
    if (!isAdmin) q = q.eq("reported_by", userId);
    const { error } = await q;

    if (error) {
      toast.error(error.message);
      setDeletingIssue(false);
      return;
    }

    // Storage has no DB cascade, so the row delete above leaves the photos
    // orphaned in the bucket. Clean them up best-effort — never block or undo
    // the (already done) deletion if a storage call fails.
    await cleanupIssuePhotos(currentIssue.id, [
      currentIssue.photo_url,
      currentIssue.after_photo_url,
    ]);

    toast.success("Пријавата е избришана");
    onClose?.();

    if (typeof window !== "undefined") {
      window.location.href = "/issues";
    }
  }

  async function submitComment() {
    const body = commentText.trim();
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (!body && !commentImage) return;

    setSavingComment(true);

    // Upload image if present
    let photoUrl: string | null = null;
    if (commentImage) {
      setUploadingCommentImage(true);
      const ext = commentImage.name.split(".").pop() ?? "jpg";
      const { data, error: upErr } = await supabase.storage
        .from("issue-photos")
        .upload(
          `comments/${currentIssue.id}/${userId}-${Date.now()}.${ext}`,
          commentImage,
          {
            contentType: commentImage.type,
            cacheControl: "31536000",
            upsert: false,
          },
        );
      if (!upErr && data) {
        photoUrl = supabase.storage.from("issue-photos").getPublicUrl(data.path)
          .data.publicUrl;
      }
      setUploadingCommentImage(false);
    }

    const { error } = await supabase.from("issue_comments").insert({
      issue_id: currentIssue.id,
      user_id: userId,
      body: body || null,
      photo_url: photoUrl,
    });

    if (error) {
      if (error.code === "42P01") {
        toast.error(
          "Недостига табелата за коментари. Пушти SQL migration за issue_comments.",
        );
        setCommentsUnavailable(true);
      } else {
        toast.error(error.message);
      }
      setSavingComment(false);
      return;
    }

    setCommentText("");
    setCommentImage(null);
    setCommentImagePreview(null);
    await loadComments();
    setSavingComment(false);
    toast.success("Коментарот е објавен");
  }

  const EMOJIS = [
    "😊",
    "😂",
    "❤️",
    "👍",
    "🙏",
    "😍",
    "😢",
    "😅",
    "🔥",
    "✅",
    "🤔",
    "👏",
    "😎",
    "🥰",
    "💪",
    "🙌",
    "😩",
    "🤣",
    "😭",
    "🎉",
    "👀",
    "💯",
    "🤦",
    "😡",
    "🥺",
    "💔",
    "😳",
    "🤝",
    "🙁",
    "😤",
  ];

  function insertEmoji(emoji: string) {
    const el = commentRef.current;
    if (!el) {
      setCommentText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? commentText.length;
    const end = el.selectionEnd ?? commentText.length;
    const next = commentText.slice(0, start) + emoji + commentText.slice(end);
    setCommentText(next);
    // restore cursor after emoji
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function toggleCommentLike(commentId: number) {
    if (!userId) {
      redirectToAuth();
      return;
    }
    const isLiked = likedComments.has(commentId);
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setCommentLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] ?? 0) + (isLiked ? -1 : 1)),
    }));
    if (isLiked) {
      supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId)
        .then(() => {});
    } else {
      supabase
        .from("comment_likes")
        .upsert(
          { comment_id: commentId, user_id: userId },
          { ignoreDuplicates: true },
        )
        .then(() => {});
      const target = comments.find((c) => c.id === commentId);
      if (target?.user_id) {
        createNotification(supabase, {
          recipientUserId: target.user_id,
          actorUserId: userId,
          type: "comment_like",
          title: currentIssue.title,
          body: "се допадна твојот коментар",
          link: getIssuePath(currentIssue.id, currentIssue.title),
        });
      }
    }
  }

  function replyToComment(
    authorName: string,
    authorUserId: string,
    commentId: number,
    rootParentId?: number | null,
  ) {
    setReplyToUserId(authorUserId);
    const rootId = rootParentId ?? commentId;
    setReplyToCommentId(rootId);
    setInlineReplyText(`@${authorName} `);
    // Focus the inline input after it renders
    setTimeout(() => inlineReplyRef.current?.focus(), 30);
  }

  async function submitInlineReply() {
    const body = inlineReplyText.trim();
    if (!userId || !body || !replyToCommentId || savingComment) return;
    setSavingComment(true);
    const { error } = await supabase.from("issue_comments").insert({
      issue_id: currentIssue.id,
      user_id: userId,
      body,
      parent_comment_id: replyToCommentId,
    });
    if (error) {
      toast.error(error.message);
      setSavingComment(false);
      return;
    }
    if (replyToUserId) {
      createNotification(supabase, {
        recipientUserId: replyToUserId,
        actorUserId: userId,
        type: "comment_reply",
        title: currentIssue.title,
        body: "одговори на твојот коментар",
        link: getIssuePath(currentIssue.id, currentIssue.title),
      });
    }
    setInlineReplyText("");
    setReplyToCommentId(null);
    setReplyToUserId(null);
    await loadComments();
    setSavingComment(false);
  }

  async function submitReport(commentId: number) {
    if (!userId || submittingReport) return;
    setSubmittingReport(true);
    const { error } = await supabase.from("comment_reports").insert({
      comment_id: commentId,
      issue_id: currentIssue.id,
      reported_by: userId,
      reason: reportReason.trim() || null,
    });
    setSubmittingReport(false);
    if (error && error.code !== "42P01") {
      toast.error("Грешка при пријавувањето");
      return;
    }
    toast.success("Коментарот е пријавен. Ти благодариме!");
    setReportingCommentId(null);
    setReportReason("");
  }

  async function deleteComment(commentId: number) {
    if (!userId) return;
    const { error } = await supabase
      .from("issue_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      toast.error("Грешка при бришење: " + error.message);
      return;
    }
    toast.success("Коментарот е избришан");
    setOpenCommentMenu(null);
    await loadComments();
  }

  const commentsSection = (
    <div className="border-t border-zinc-100 pt-3">
      {commentsUnavailable && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
          Коментари не се достапни додека не се пушти SQL migration за
          `issue_comments`.
        </p>
      )}

      {userId ? (
        <div className="relative mb-3">
          {/* Emoji picker */}
          {showEmojiPicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-2xl border border-zinc-200 bg-white shadow-xl p-2">
                <div className="grid grid-cols-10 gap-0.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        insertEmoji(e);
                        setShowEmojiPicker(false);
                      }}
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-base hover:bg-zinc-100 transition-colors">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-start gap-2">
            <AvatarInitials
              name={authProfile?.full_name ?? authProfile?.username ?? null}
              avatarUrl={authProfile?.avatar_url ?? null}
              size="sm"
              className="mt-1 shrink-0"
              membershipTier={authProfile?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={authProfile?.points}
            />
            {/* Unified input container */}
            <div className="flex-1 rounded-2xl bg-zinc-100 px-3 pt-2 pb-1.5">
              <textarea
                ref={commentRef}
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  // auto-grow
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                rows={1}
                maxLength={400}
                placeholder={`Коментирај како ${authProfile?.full_name ?? authProfile?.username ?? ""}…`}
                className="w-full resize-none bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 leading-snug"
                style={{ minHeight: "1.25rem", maxHeight: "8rem" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (commentText.trim()) submitComment();
                  }
                }}
              />
              {/* Image preview */}
              {commentImagePreview && (
                <div className="relative mt-1.5 mb-1 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={commentImagePreview}
                    alt="preview"
                    className="max-h-24 rounded-lg object-cover border border-zinc-200"
                  />
                  <button
                    onClick={() => {
                      setCommentImage(null);
                      setCommentImagePreview(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-900">
                    <XIcon size={10} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  {/* Emoji */}
                  <button
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-200 transition-colors text-xl leading-none">
                    😊
                  </button>
                  {/* Photo */}
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors">
                    <ImagePlus size={19} strokeWidth={2} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setCommentImage(f);
                          setCommentImagePreview(URL.createObjectURL(f));
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <button
                  onClick={submitComment}
                  disabled={
                    savingComment ||
                    uploadingCommentImage ||
                    (!commentText.trim() && !commentImage)
                  }
                  className={cn(
                    "flex h-8 w-8 items-center justify-center transition-all",
                    commentText.trim() || commentImage
                      ? "text-[#427FFF] hover:text-[#3570ee] active:scale-95"
                      : "text-zinc-300 cursor-default",
                  )}
                  aria-label="Испрати коментар">
                  <SendIcon
                    size={16}
                    active={Boolean(commentText.trim() || commentImage)}
                    disabled={
                      savingComment ||
                      uploadingCommentImage ||
                      (!commentText.trim() && !commentImage)
                    }
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-center text-sm">
          <button onClick={redirectToAuth} className="font-medium text-[#427FFF] hover:underline">
            Најавете се за да коментирате…
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loadingComments && (
          <p className="text-xs text-zinc-400">Се вчитуваат коментари...</p>
        )}
        {!loadingComments && comments.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <svg
              width="40"
              height="35"
              viewBox="0 0 55 48"
              fill="none"
              className="text-zinc-200">
              <path
                d="M32.1406 3.21976C28.7723 1.14232 24.7809 0 20.6578 0C9.43416 0 0 8.36197 0 19.0688C0 22.8226 1.16616 26.4212 3.38131 29.5291L0.286879 39.2442C-0.0400444 40.2704 0.728638 41.3156 1.80126 41.3156C2.0465 41.3156 2.29334 41.259 2.5211 41.1431L11.9317 36.3582C12.3128 36.5223 12.6986 36.6749 13.0884 36.8167C10.9095 33.4159 9.74625 29.5121 9.74625 25.425C9.74625 13.2531 19.9881 3.89553 32.1406 3.21976Z"
                fill="currentColor"
              />
              <path
                d="M50.8591 35.8855C53.0743 32.7776 54.2404 29.179 54.2404 25.4251C54.2404 14.7144 44.8022 6.35632 33.5826 6.35632C22.359 6.35632 12.9248 14.7183 12.9248 25.4251C12.9248 36.1358 22.363 44.4938 33.5826 44.4938C36.593 44.4938 39.5927 43.8803 42.3082 42.7143L51.7193 47.4994C52.2904 47.7898 52.9803 47.7087 53.4686 47.2938C53.9568 46.8788 54.1482 46.2112 53.9537 45.6007L50.8591 35.8855ZM27.1204 27.0141C26.2428 27.0141 25.5314 26.3027 25.5314 25.4251C25.5314 24.5475 26.2428 23.836 27.1204 23.836C27.998 23.836 28.7095 24.5475 28.7095 25.4251C28.7095 26.3027 27.998 27.0141 27.1204 27.0141ZM33.4767 27.0141C32.5991 27.0141 31.8876 26.3027 31.8876 25.4251C31.8876 24.5475 32.5991 23.836 33.4767 23.836C34.3543 23.836 35.0657 24.5475 35.0657 25.4251C35.0657 26.3027 34.3543 27.0141 33.4767 27.0141ZM39.8329 27.0141C38.9553 27.0141 38.2439 26.3027 38.2439 25.4251C38.2439 24.5475 38.9553 23.836 39.8329 23.836C40.7105 23.836 41.422 24.5475 41.422 25.4251C41.422 26.3027 40.7105 27.0141 39.8329 27.0141Z"
                fill="currentColor"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-400">
              Сe уште нема коментари
            </p>
            <p className="text-xs text-zinc-300">Биди прв/а да коментираш.</p>
          </div>
        )}
        {(() => {
          const topLevel = comments.filter((c) => !c.parent_comment_id);
          const visibleTopLevel = topLevel.slice(0, commentLimit);
          const hiddenCount = topLevel.length - commentLimit;
          const repliesMap: Record<number, IssueComment[]> = {};
          for (const c of comments) {
            if (c.parent_comment_id) {
              repliesMap[c.parent_comment_id] ??= [];
              repliesMap[c.parent_comment_id].push(c);
            }
          }

          const renderBubble = (comment: IssueComment, isReply: boolean) => {
            const cid = comment.id;
            const isLiked = likedComments.has(cid);
            const likeCount = commentLikeCounts[cid] ?? 0;
            const aName =
              comment.profiles?.full_name ??
              comment.profiles?.username ??
              "Анонимно";
            const rootParent = isReply ? comment.parent_comment_id : null;
            return (
              <div key={cid} className="flex items-start gap-2">
                <AvatarInitials
                  name={aName}
                  avatarUrl={comment.profiles?.avatar_url ?? null}
                  size="sm"
                  className="shrink-0 mt-0.5"
                  membershipTier={comment.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                  points={comment.profiles?.points}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 inline-block max-w-full",
                      isReply
                        ? "bg-zinc-50 border border-zinc-150"
                        : "bg-zinc-100",
                    )}>
                    <p className="text-xs font-semibold text-zinc-800 leading-tight">
                      {aName}
                    </p>
                    {comment.body && (
                      <p
                        className={cn(
                          "leading-snug text-zinc-700 mt-0.5",
                          isReply ? "text-xs" : "text-sm",
                        )}>
                        {comment.body}
                      </p>
                    )}
                    {(comment as { photo_url?: string | null }).photo_url && (
                      <button
                        onClick={() =>
                          setLightboxSrc(
                            (comment as { photo_url?: string | null })
                              .photo_url!,
                          )
                        }
                        className="mt-1.5 block cursor-zoom-in p-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            (comment as { photo_url?: string | null })
                              .photo_url!
                          }
                          alt="Слика во коментар"
                          className="max-h-48 rounded-xl object-cover"
                        />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 px-1">
                    {comment.created_at && (
                      <p className="text-[10px] text-zinc-400">
                        {formatDays(comment.created_at)}
                      </p>
                    )}
                    <button
                      onClick={() => toggleCommentLike(cid)}
                      className={cn(
                        "text-[10px] font-semibold transition-colors",
                        isLiked
                          ? "text-[#427FFF]"
                          : "text-zinc-400 hover:text-zinc-700",
                      )}>
                      {likeCount > 0 ? `А така · ${likeCount}` : "А така"}
                    </button>
                    <button
                      onClick={() =>
                        replyToComment(aName, comment.user_id, cid, rootParent)
                      }
                      className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-700 transition-colors">
                      Коментирај
                    </button>
                    <div className="relative ml-auto">
                      <button
                        onClick={() =>
                          setOpenCommentMenu(
                            openCommentMenu === cid ? null : cid,
                          )
                        }
                        className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 transition-colors">
                        <MoreHorizontal size={12} />
                      </button>
                      {openCommentMenu === cid && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenCommentMenu(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-xl bg-white shadow-xl border border-zinc-100 py-1 overflow-hidden">
                            <button
                              onClick={() => {
                                setReportingCommentId(cid);
                                setOpenCommentMenu(null);
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
                              <AlertTriangle size={12} />
                              Пријави коментар
                            </button>
                            {(isAdmin || comment.user_id === userId) && (
                              <button
                                onClick={() => deleteComment(cid)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 size={12} />
                                Избриши коментар
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {reportingCommentId === cid && (
                    <div className="mt-1.5 rounded-xl border border-red-100 bg-red-50 p-2.5 space-y-2">
                      <p className="text-[11px] font-semibold text-red-700">
                        Пријави го коментарот
                      </p>
                      <textarea
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder="Причина (опционално)..."
                        rows={2}
                        maxLength={300}
                        className="w-full resize-none rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setReportingCommentId(null);
                            setReportReason("");
                          }}
                          className="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                          Откажи
                        </button>
                        <button
                          onClick={() => submitReport(cid)}
                          disabled={submittingReport}
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                          {submittingReport ? "Се испраќа..." : "Пријави"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setCommentLimit((n) => n + 10)}
                  className="w-full py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors text-center">
                  ↑ Прикажи постари ({hiddenCount})
                </button>
              )}
              {visibleTopLevel.map((comment) => {
                const replies = repliesMap[comment.id] ?? [];
                const showInline = replyToCommentId === comment.id;
                return (
                  <div key={comment.id} className="space-y-1.5">
                    {renderBubble(comment, false)}
                    {(replies.length > 0 || showInline) && (
                      <div className="ml-8 space-y-2">
                        {replies.map((reply, idx) => {
                          const isLast =
                            idx === replies.length - 1 && !showInline;
                          return (
                            <div key={reply.id} className="relative pl-4">
                              {/* Curved L-connector */}
                              <div className="absolute left-0 top-0 h-4 w-4 border-l-2 border-b-2 border-zinc-200 rounded-bl-xl" />
                              {/* Vertical line continuing to next item */}
                              {!isLast && (
                                <div className="absolute left-0 top-4 -bottom-2 border-l-2 border-zinc-200" />
                              )}
                              {renderBubble(reply, true)}
                            </div>
                          );
                        })}

                        {/* Inline reply input */}
                        {showInline && (
                          <div className="relative pl-4">
                            <div className="absolute left-0 top-0 h-4 w-4 border-l-2 border-b-2 border-zinc-200 rounded-bl-xl" />
                            <div className="flex items-start gap-2">
                              <AvatarInitials
                                name={
                                  authProfile?.full_name ??
                                  authProfile?.username ??
                                  null
                                }
                                avatarUrl={authProfile?.avatar_url ?? null}
                                size="sm"
                                className="shrink-0 mt-0.5"
                                membershipTier={authProfile?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                                points={authProfile?.points}
                              />
                              <div className="flex-1 rounded-2xl bg-zinc-100 px-3 pt-2 pb-1.5">
                                <textarea
                                  ref={inlineReplyRef}
                                  value={inlineReplyText}
                                  onChange={(e) => {
                                    setInlineReplyText(e.target.value);
                                    e.target.style.height = "auto";
                                    e.target.style.height =
                                      e.target.scrollHeight + "px";
                                  }}
                                  rows={1}
                                  maxLength={400}
                                  placeholder="Одговори..."
                                  className="w-full resize-none bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 leading-snug"
                                  style={{
                                    minHeight: "1.25rem",
                                    maxHeight: "8rem",
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      if (inlineReplyText.trim())
                                        submitInlineReply();
                                    }
                                    if (e.key === "Escape") {
                                      setReplyToCommentId(null);
                                      setInlineReplyText("");
                                      setReplyToUserId(null);
                                    }
                                  }}
                                />
                                <div className="flex items-center justify-between mt-1">
                                  <button
                                    onClick={() => {
                                      setReplyToCommentId(null);
                                      setInlineReplyText("");
                                      setReplyToUserId(null);
                                    }}
                                    className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors">
                                    Откажи
                                  </button>
                                  <button
                                    onClick={submitInlineReply}
                                    disabled={
                                      !inlineReplyText.trim() || savingComment
                                    }
                                    className={cn(
                                      "flex items-center justify-center transition-all",
                                      inlineReplyText.trim()
                                        ? "text-primary hover:opacity-80 active:scale-95"
                                        : "text-zinc-300 cursor-default",
                                    )}>
                                    <SendIcon
                                      size={15}
                                      active={!!inlineReplyText.trim()}
                                      disabled={
                                        !inlineReplyText.trim() || savingComment
                                      }
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const shareSection = (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
      <button
        onClick={() => setShareOpen((prev) => !prev)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:border-teal-300 hover:text-teal-700 cursor-pointer">
        <Share2 size={13} /> Сподели
      </button>

      {shareOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={shareFacebook}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#8b9dc3]">
            Facebook
          </button>
          <button
            onClick={shareInstagram}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#d62976]">
            Instagram
          </button>
          <button
            onClick={shareViber}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#7360f2]">
            Viber
          </button>
          <button
            onClick={shareWhatsApp}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#25d366]">
            WhatsApp
          </button>
          <button
            onClick={copyLink}
            className="col-span-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300">
            Копирај линк
          </button>
        </div>
      )}
    </div>
  );

  const PEOPLE_PREVIEW = 5;

  function UserChip({
    u,
    accentColor,
  }: {
    u: {
      user_id: string;
      profiles?: {
        full_name: string | null;
        avatar_url: string | null;
        username: string | null;
        membership_tier?: string | null;
        points?: number;
      } | null;
    };
    accentColor: "slate" | "teal";
  }) {
    const name = u.profiles?.full_name ?? u.profiles?.username ?? "Анонимно";
    const href = u.profiles?.username
      ? `/${u.profiles.username}`
      : `/${u.user_id}`;

    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 cursor-pointer transition-colors ${
          accentColor === "teal"
            ? "bg-teal-50 border-teal-100 hover:border-teal-300"
            : "bg-zinc-50 border-zinc-100 hover:border-zinc-300"
        }`}>
        <AvatarInitials
          name={name}
          avatarUrl={u.profiles?.avatar_url ?? null}
          size="sm"
          membershipTier={u.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
          points={u.profiles?.points}
        />
        <span
          className={`text-xs ${accentColor === "teal" ? "text-teal-700" : "text-zinc-700"}`}>
          {name}
        </span>
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const peopleSection = (affectedUsers.length > 0 ||
    helperUsers.length > 0) && (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
      {affectedUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-slate-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Засегнати ({affectedUsers.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {affectedUsers.slice(0, PEOPLE_PREVIEW).map((u) => (
              <UserChip key={u.user_id} u={u} accentColor="slate" />
            ))}
            {affectedUsers.length > PEOPLE_PREVIEW && (
              <button
                onClick={() => setShowAffectedPopup(true)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors">
                +{affectedUsers.length - PEOPLE_PREVIEW} повеќе
              </button>
            )}
          </div>
        </div>
      )}

      {helperUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <HandHelping size={12} className="text-teal-600" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Сакаат да помогнат ({helperUsers.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {helperUsers.slice(0, PEOPLE_PREVIEW).map((u) => (
              <UserChip key={u.user_id} u={u} accentColor="teal" />
            ))}
            {helperUsers.length > PEOPLE_PREVIEW && (
              <button
                onClick={() => setShowHelperPopup(true)}
                className="flex items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-600 hover:border-teal-300 transition-colors">
                +{helperUsers.length - PEOPLE_PREVIEW} повеќе
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const helpPlanningSection = (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Users size={13} className="text-teal-600" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Предложени Датуми
        </p>
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            helpOffers.filter((o) => o.service_date).length >= 3
              ? "bg-amber-100 text-amber-700"
              : "bg-zinc-100 text-zinc-500",
          )}>
          {helpOffers.filter((o) => o.service_date).length}/3
        </span>
        {onOpenDates && (
          <button
            onClick={onOpenDates}
            className="ml-auto flex items-center gap-0.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Отвори <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Date hero cards only — full detail lives in the side panel */}
      {!loadingOffers &&
        helpOffers.filter((o) => o.service_date).length === 0 && (
          <p className="text-xs italic text-zinc-400 py-1">
            Сe уште нема предложени датуми.
          </p>
        )}
      {loadingOffers && (
        <div className="h-14 rounded-xl bg-zinc-100 animate-pulse" />
      )}
      <div className="space-y-2">
        {helpOffers
          .filter((o) => o.service_date)
          .map((offer) => {
            const name =
              offer.profiles?.full_name ??
              offer.profiles?.username ??
              "Анонимно";
            const [y, m, d] = (offer.service_date as string)
              .split("-")
              .map(Number);
            const dt = new Date(y, m - 1, d);
            return (
              <button
                key={offer.id}
                onClick={onOpenDates}
                className="w-full overflow-hidden rounded-xl text-left">
                <div
                  className={cn(
                    "px-4 py-3 flex items-center justify-between gap-3 border-l-[3px]",
                    offer.voted_by_me
                      ? "bg-primary border-primary"
                      : "bg-zinc-100 border-zinc-200",
                  )}>
                  <div
                    className={cn(
                      "min-w-0",
                      offer.voted_by_me ? "text-white" : "text-zinc-800",
                    )}>
                    <p className="text-[10px] opacity-70 capitalize">
                      {dt.toLocaleDateString("mk-MK", { weekday: "long" })}
                    </p>
                    <p className="text-sm font-bold leading-tight">
                      {dt.toLocaleDateString("mk-MK", {
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-[10px] opacity-60">{dt.getFullYear()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AvatarInitials
                      name={name}
                      avatarUrl={offer.profiles?.avatar_url ?? null}
                      size="sm"
                      className="ring-2 ring-white/40"
                      membershipTier={offer.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                      points={offer.profiles?.points}
                    />
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-[11px] font-semibold truncate max-w-20",
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
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );

  async function approveRequest(req: ChangeRequest) {
    if (!canModerate || !userId || approvingInFlight.current) return;
    approvingInFlight.current = true;
    setApprovingId(req.id);
    const { error } = await supabase.rpc("approve_change_request", {
      p_id: req.id,
    });
    if (error) {
      toast.error(error.message);
      approvingInFlight.current = false;
      setApprovingId(null);
      return;
    }
    // Award 1 applause to the helper when their "resolved" proposal is accepted
    if (req.payload.status === "resolved") {
      await supabase.rpc("award_applause", {
        p_user_id: req.requester_user_id,
      });
    }
    setCurrentIssue((prev) => ({
      ...prev,
      status: req.payload.status as IssueStatus,
      ...(req.payload.after_photo_url
        ? { after_photo_url: req.payload.after_photo_url }
        : {}),
    }));
    toast.success("Одобрено — статусот е променет");
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
    approvingInFlight.current = false;
    setApprovingId(null);
  }

  async function rejectRequest(req: ChangeRequest) {
    if (!canModerate || approvingId) return;
    setApprovingId(req.id);
    const { error } = await supabase.rpc("reject_change_request", {
      p_id: req.id,
    });
    if (error) {
      toast.error(error.message);
      setApprovingId(null);
      return;
    }
    toast.success("Одбиено");
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
    setApprovingId(null);
  }

  const STATUS_LABEL: Record<string, string> = {
    progress: "Во тек",
    resolved: "Завршено",
  };

  const pendingRequestsSection = canModerate && pendingRequests.length > 0 && (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
        🔔 Барања за одобрување ({pendingRequests.length})
      </p>
      {pendingRequests.map((req) => {
        const name =
          req.profiles?.full_name ?? req.profiles?.username ?? "Помошник";
        return (
          <div
            key={req.id}
            className="rounded-lg bg-white border border-amber-100 p-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <AvatarInitials
                name={name}
                avatarUrl={req.profiles?.avatar_url ?? null}
                size="sm"
                membershipTier={req.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                points={req.profiles?.points}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-800">{name}</p>
                <p className="text-xs text-zinc-500">
                  Предлага статус:{" "}
                  <span className="font-semibold text-teal-700">
                    {STATUS_LABEL[req.payload.status] ?? req.payload.status}
                  </span>
                </p>
                <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                  {req.payload.description}
                </p>
                {req.payload.after_photo_url && (
                  <Image
                    src={cdnUrl(req.payload.after_photo_url)}
                    alt="Потоа"
                    width={640}
                    height={360}
                    sizes="(max-width: 640px) 100vw, 360px"
                    className="mt-1.5 w-full max-h-36 object-cover rounded-lg border border-zinc-200"
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approveRequest(req)}
                disabled={approvingId === req.id}
                className="flex-1 rounded-lg bg-teal-600 text-white text-xs font-semibold py-1.5 hover:bg-teal-700 disabled:opacity-60 transition-colors">
                ✓ Одобри
              </button>
              <button
                onClick={() => rejectRequest(req)}
                disabled={approvingId === req.id}
                className="flex-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold py-1.5 hover:bg-red-50 disabled:opacity-60 transition-colors">
                ✕ Одбиј
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Free-text label wins over the registered resolver; only a registered
  // resolver (no label) gets an avatar + profile link.
  const heroLabel = currentIssue.resolved_by_label?.trim() || null;
  const heroName = heroLabel ?? resolver?.full_name ?? resolver?.username ?? null;
  const heroIsUser = !heroLabel && !!resolver;
  const resolverSection = currentIssue.status === "resolved" && heroName && (
    <div className="rounded-xl border border-teal-200 bg-linear-to-br from-teal-50 to-emerald-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🏆</span>
          {heroIsUser && resolver ? (
            <Link
              href={resolver.username ? `/${resolver.username}` : `/${resolver.id}`}
              className="flex items-center gap-2 min-w-0 group">
              <AvatarInitials
                name={resolver.full_name ?? resolver.username ?? "Херој"}
                avatarUrl={resolver.avatar_url}
                size="sm"
                membershipTier={resolver.membership_tier as import("../ui/AvatarInitials").MembershipTier}
                points={resolver.points}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-teal-800 leading-tight">
                  Решено од
                </p>
                <p className="text-sm font-bold text-zinc-900 group-hover:underline truncate">
                  {resolver.full_name ?? resolver.username ?? "Херој"}
                </p>
              </div>
            </Link>
          ) : (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-teal-800 leading-tight">
                Решено од
              </p>
              <p className="text-sm font-bold text-zinc-900 truncate">{heroName}</p>
            </div>
          )}
        </div>
        <button
          onClick={toggleResolverUpvote}
          disabled={upvotingResolver || (heroIsUser && resolver?.id === userId)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
            hasUpvotedResolver
              ? "bg-teal-600 text-white"
              : "bg-white border border-teal-300 text-teal-700 hover:bg-teal-50",
            heroIsUser && resolver?.id === userId && "opacity-50 cursor-not-allowed",
          )}
          title={
            heroIsUser && resolver?.id === userId
              ? "Не можеш да гласаш за себе"
              : "Дај поени на херојот"
          }>
          <span className="text-sm">👏</span>
          <span>{resolverUpvotes}</span>
        </button>
      </div>
    </div>
  );

  // Only offer a status-change proposal while the issue is still open — hide it
  // once it's in progress or resolved.
  const helpActionsSection = userId &&
    !isOwner &&
    !isAdmin &&
    currentIssue.status === "open" && (
      <button
        onClick={() => setShowProposeModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b9f95] hover:bg-[#338c84] text-white text-xs font-semibold py-2.5 transition-colors">
        <HandHelping size={13} /> Предложи промена на статус
      </button>
    );

  const proposeModal = showProposeModal && (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(4px)",
      }}
      onClick={() => {
        if (!proposing) {
          setShowProposeModal(false);
        }
      }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <HandHelping size={14} className="text-teal-600" />
            Предложи промена на статус
          </h3>
          <button
            onClick={() => setShowProposeModal(false)}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Status choice */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-1.5">
              Нов статус *
            </p>
            <div className="flex gap-2">
              {(["progress", "resolved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setProposeStatus(s)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors",
                    proposeStatus === s
                      ? s === "resolved"
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-amber-500 border-amber-500 text-white"
                      : s === "resolved"
                        ? "border-teal-200 text-teal-700 hover:bg-teal-50"
                        : "border-amber-200 text-amber-700 hover:bg-amber-50",
                  )}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-1.5">
              Опис / Порака *
            </p>
            <textarea
              value={proposeDesc}
              onChange={(e) => setProposeDesc(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Опиши ги извршените работи, кој поправил, кога..."
              className="w-full resize-none rounded-lg border border-zinc-200 px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400"
            />
          </div>
          {/* Photo */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-1.5">
              Фотографија после (опционално)
            </p>
            {proposePreview ? (
              <div className="relative">
                {/* Local blob URL from URL.createObjectURL — next/image can't optimize it */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proposePreview}
                  alt="preview"
                  className="w-full max-h-36 object-cover rounded-lg border border-zinc-200"
                />
                <button
                  onClick={() => {
                    setProposeFile(null);
                    setProposePreview(null);
                  }}
                  className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-xs font-semibold text-zinc-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
                + Додади слика
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setProposeFile(f);
                      setProposePreview(URL.createObjectURL(f));
                    }
                  }}
                />
              </label>
            )}
          </div>
          <button
            onClick={submitProposal}
            disabled={!proposeStatus || !proposeDesc.trim() || proposing}
            className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-colors">
            {proposing ? "Се испраќа..." : "Испрати барање"}
          </button>
        </div>
      </div>
    </div>
  );

  const statusOptions: {
    value: "open" | "progress" | "resolved";
    label: string;
    classes: string;
  }[] = [
    {
      value: "open",
      label: "Отворено",
      classes: "border-zinc-200 text-zinc-600 hover:border-zinc-400",
    },
    {
      value: "progress",
      label: "Во тек",
      classes: "border-amber-200 text-amber-700 hover:border-amber-400",
    },
    {
      value: "resolved",
      label: "Завршено",
      classes: "border-teal-200 text-teal-700 hover:border-teal-400",
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const statusSelector = (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mr-0.5">
          Статус:
        </span>
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => changeStatus(opt.value)}
            disabled={changingStatus}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-60",
              currentIssue.status === opt.value
                ? "bg-zinc-900 border-zinc-900 text-white"
                : `bg-white ${opt.classes}`,
            )}>
            {opt.label}
          </button>
        ))}
      </div>
      {/* Resolver picker — only when status is resolved */}
      {currentIssue.status === "resolved" && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide pt-1.5">
            Решено од:
          </span>
          <select
            value={currentIssue.resolved_by ?? ""}
            disabled={savingResolver}
            onChange={(e) => setResolverFor(e.target.value || null)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none focus:border-teal-400 disabled:opacity-60">
            <option value="">— Никој / Непознато —</option>
            {currentIssue.reported_by && (
              <option value={currentIssue.reported_by}>
                {currentIssue.profiles?.full_name ??
                  currentIssue.profiles?.username ??
                  "Авторот"}{" "}
                (автор)
              </option>
            )}
            {helperUsers
              .filter((h) => h.user_id !== currentIssue.reported_by)
              .map((h) => (
                <option key={h.user_id} value={h.user_id}>
                  {h.profiles?.full_name ?? h.profiles?.username ?? "Помошник"}
                </option>
              ))}
            {/* If current resolved_by isn't in the list, keep it visible */}
            {currentIssue.resolved_by &&
              currentIssue.resolved_by !== currentIssue.reported_by &&
              !helperUsers.some(
                (h) => h.user_id === currentIssue.resolved_by,
              ) &&
              resolver && (
                <option value={currentIssue.resolved_by}>
                  {resolver.full_name ?? resolver.username ?? "Решавач"}
                </option>
              )}
          </select>
          {isAdmin && (
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-[11px] font-medium text-zinc-400">или име:</span>
              <input
                type="text"
                value={resolvedLabel}
                disabled={savingResolver}
                onChange={(e) => setResolvedLabel(e.target.value)}
                onBlur={saveResolverLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="пр. Комуналец, ЈП Водовод…"
                className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none focus:border-teal-400 disabled:opacity-60"
              />
            </div>
          )}
        </div>
      )}
      {/* After photo upload */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
          Фото Потоа:
        </span>
        {currentIssue.after_photo_url ? (
          <span className="text-[11px] text-teal-600 font-medium">
            ✓ Прикачено
          </span>
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:border-teal-400 hover:text-teal-700 transition-colors">
          {uploadingAfter
            ? "Се прикачува..."
            : currentIssue.after_photo_url
              ? "Замени"
              : "+ Додади слика"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingAfter}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAfterPhoto(f);
            }}
          />
        </label>
      </div>
    </div>
  );

  // Dedicated status control for institution operators (who are not the owner
  // or a super-admin). Lets them advance the status and attach a short public
  // note that shows up in the citizen-facing timeline.
  const statusDirty =
    selectedStatus !== currentIssue.status || statusNote.trim().length > 0;
  const agencyStatusControl = canAgencyHandle && !canModerate && (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
        <span>🏛️</span> Управување (надлежна служба)
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {ISSUE_STATUSES.map((s) => {
          const isSelected = selectedStatus === s;
          const isCurrent = currentIssue.status === s;
          return (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              disabled={changingStatus}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
                isSelected
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-sky-200 bg-white text-sky-700 hover:border-sky-400",
              )}>
              {ISSUE_STATUS_LABELS[s]}
              {isCurrent ? " ✓" : ""}
            </button>
          );
        })}
      </div>
      <textarea
        value={statusNote}
        onChange={(e) => setStatusNote(e.target.value)}
        rows={2}
        placeholder="Забелешка (опционално) — се прикажува во времеплов"
        className="w-full resize-none rounded-lg border border-sky-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-sky-400"
      />
      <button
        type="button"
        onClick={() => changeStatus(selectedStatus, statusNote)}
        disabled={changingStatus || !statusDirty}
        className="mt-2 w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50">
        {changingStatus ? "Се зачувува…" : "Зачувај промена"}
      </button>
    </div>
  );

  if (variant === "engagement") {
    return (
      <div className="space-y-3 p-3">
        {agencyStatusControl}
        {canModerate && (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
              <p className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                {isAdmin && !isOwner && (
                  <span className="text-amber-500">⚠</span>
                )}
                Управување со пријава
              </p>
              <div className="relative">
                <button
                  onClick={() => setShowModMenu((v) => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors">
                  <MoreHorizontal size={15} />
                </button>
                {showModMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowModMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl bg-white shadow-2xl border border-zinc-100 overflow-hidden py-1.5">
                      <button
                        onClick={() => {
                          setIsEditing((v) => !v);
                          setEditTitle(currentIssue.title);
                          setEditDescription(currentIssue.description ?? "");
                          setEditStreet(currentIssue.street_name ?? "");
                          setEditDistrict(currentIssue.district as District);
                          setShowModMenu(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">
                        <Pencil size={14} className="text-zinc-400" />
                        {isEditing ? "Откажи измена" : "Измени пријава"}
                      </button>
                      <div className="my-1 h-px bg-zinc-100" />
                      <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Статус
                      </p>
                      {ISSUE_STATUSES.map((s) => {
                        const color = ISSUE_STATUS_MENU_TEXT_CLASSES[s];
                        const isCurrent = currentIssue.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              changeStatus(s);
                              setShowModMenu(false);
                            }}
                            disabled={isCurrent}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
                              isCurrent
                                ? "bg-zinc-50 font-semibold"
                                : "hover:bg-zinc-50 text-zinc-700",
                            )}>
                            <span
                              className={cn(
                                "text-xs font-bold w-4 text-center",
                                color,
                              )}>
                              {isCurrent ? "●" : "○"}
                            </span>
                            <span className={isCurrent ? color : ""}>
                              {ISSUE_STATUS_LABELS[s]}
                            </span>
                            {isCurrent && (
                              <Check
                                size={12}
                                className={cn("ml-auto", color)}
                              />
                            )}
                          </button>
                        );
                      })}
                      <div className="my-1 h-px bg-zinc-100" />
                      <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">
                        <Camera size={14} className="text-zinc-400" />
                        {currentIssue.after_photo_url
                          ? "Замени фото по решавање"
                          : "Додади фото по решавање"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingAfter}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              uploadAfterPhoto(f);
                              setShowModMenu(false);
                            }
                          }}
                        />
                      </label>
                      <div className="my-1 h-px bg-zinc-100" />
                      <button
                        onClick={() => {
                          deleteIssue();
                          setShowModMenu(false);
                        }}
                        disabled={deletingIssue}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
                        <Trash2 size={14} />
                        {deletingIssue ? "Се брише…" : "Избриши пријава"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {pendingRequestsSection && (
              <div className="p-3">{pendingRequestsSection}</div>
            )}
            {isEditing && (
              <div className="p-3 border-t border-zinc-100 space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-teal-400"
                  placeholder="Наслов"
                />
                <input
                  value={editStreet}
                  onChange={(e) => setEditStreet(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400"
                  placeholder="Улица (опционално)"
                />
                {isAdmin && (
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value as District)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400">
                    {DISTRICT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {DISTRICT_LABELS[d] ?? d}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400"
                  placeholder="Опис"
                />
                <button
                  onClick={saveIssueEdits}
                  disabled={savingIssue}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                  {savingIssue ? "Се зачувува..." : "Зачувај промени"}
                </button>
              </div>
            )}
          </div>
        )}

        {resolverSection}
        {helpActionsSection}
        {helpPlanningSection}
        {commentsSection}

        {showAffectedPopup && (
          <PeoplePopup
            title="Засегнати"
            icon={<AlertTriangle size={14} className="text-slate-600" />}
            users={affectedUsers}
            accentColor="slate"
            onClose={() => setShowAffectedPopup(false)}
          />
        )}
        {showHelperPopup && (
          <PeoplePopup
            title="Сакаат да помогнат"
            icon={<HandHelping size={14} className="text-teal-600" />}
            users={helperUsers}
            accentColor="teal"
            onClose={() => setShowHelperPopup(false)}
          />
        )}
        {proposeModal}
        {helperOpen && userId && (
          <HelperModal
            issueId={currentIssue.id}
            issueTitle={currentIssue.title}
            userId={userId}
            onClose={() => setHelperOpen(false)}
            onSuccess={() => {
              setIsHelperDirect(true);
              setHelperOpen(false);
              loadHelpOffers();
              loadPeopleStats();
            }}
          />
        )}
        {lightboxSrc && (
          <ImageLightbox
            src={lightboxSrc}
            alt={currentIssue.title}
            beforeSrc={currentIssue.photo_url}
            afterSrc={currentIssue.after_photo_url}
            onClose={() => setLightboxSrc(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Operator status control (institution accounts) */}
        {agencyStatusControl}

        {/* ── FB-style header: author + actions + close ── */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={
              currentIssue.profiles?.username
                ? `/${currentIssue.profiles.username}`
                : currentIssue.reported_by
                  ? `/${currentIssue.reported_by}`
                  : "#"
            }
            className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <AvatarInitials
              name={
                currentIssue.profiles?.full_name ??
                currentIssue.profiles?.username ??
                null
              }
              avatarUrl={currentIssue.profiles?.avatar_url ?? null}
              membershipTier={currentIssue.profiles?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={currentIssue.profiles?.points}
              size="md"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-800 leading-tight">
                {currentIssue.profiles?.full_name ??
                  currentIssue.profiles?.username ??
                  "Анонимно"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-zinc-400 leading-tight">
                  {formatDays(currentIssue.created_at)}
                </p>
                {viewCount !== null && (
                  <p className="text-[11px] text-zinc-300 leading-tight">
                    · {viewCount.toLocaleString()} прегледи
                  </p>
                )}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-0.5 shrink-0">
            {/* ··· mod menu */}
            {canModerate && (
              <div className="relative">
                <button
                  onClick={() => setShowModMenu((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors">
                  <MoreHorizontal size={17} />
                </button>
                {showModMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowModMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-2xl bg-white shadow-2xl border border-zinc-100 overflow-hidden py-1.5">
                      {isAdmin && !isOwner && (
                        <p className="px-4 py-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                          ⚠ Модератор
                        </p>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setIsEditing((v) => !v);
                          setEditTitle(currentIssue.title);
                          setEditDescription(currentIssue.description ?? "");
                          setEditStreet(currentIssue.street_name ?? "");
                          setEditDistrict(currentIssue.district as District);
                          setShowModMenu(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <Pencil size={15} className="text-zinc-400 shrink-0" />
                        {isEditing ? "Откажи измена" : "Измени пријава"}
                      </button>

                      <div className="my-1 h-px bg-zinc-100" />

                      {/* Status */}
                      <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Промени статус
                      </p>
                      {ISSUE_STATUSES.map((s) => {
                        const color = ISSUE_STATUS_MENU_TEXT_CLASSES[s];
                        const isCurrent = currentIssue.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              changeStatus(s);
                              setShowModMenu(false);
                            }}
                            disabled={changingStatus || isCurrent}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
                              isCurrent
                                ? "bg-zinc-50 font-semibold"
                                : "hover:bg-zinc-50 text-zinc-700",
                            )}>
                            <span
                              className={cn(
                                "text-xs font-bold w-4 text-center",
                                color,
                              )}>
                              {isCurrent ? "●" : "○"}
                            </span>
                            <span className={isCurrent ? color : ""}>
                              {ISSUE_STATUS_LABELS[s]}
                            </span>
                            {isCurrent && (
                              <Check
                                size={13}
                                className={cn("ml-auto", color)}
                              />
                            )}
                          </button>
                        );
                      })}

                      {/* Resolver when resolved */}
                      {currentIssue.status === "resolved" && (
                        <div className="px-4 py-2 border-t border-zinc-100 mt-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                            Решено од
                          </p>
                          <select
                            value={currentIssue.resolved_by ?? ""}
                            disabled={savingResolver}
                            onChange={(e) =>
                              setResolverFor(e.target.value || null)
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-teal-400">
                            <option value="">— Непознато —</option>
                            {currentIssue.reported_by && (
                              <option value={currentIssue.reported_by}>
                                {currentIssue.profiles?.full_name ??
                                  currentIssue.profiles?.username ??
                                  "Авторот"}{" "}
                                (автор)
                              </option>
                            )}
                            {helperUsers
                              .filter(
                                (h) => h.user_id !== currentIssue.reported_by,
                              )
                              .map((h) => (
                                <option key={h.user_id} value={h.user_id}>
                                  {h.profiles?.full_name ??
                                    h.profiles?.username ??
                                    "Помошник"}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <div className="my-1 h-px bg-zinc-100" />

                      {/* After photo */}
                      <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <Camera size={15} className="text-zinc-400 shrink-0" />
                        <span>
                          {uploadingAfter
                            ? "Се прикачува…"
                            : currentIssue.after_photo_url
                              ? "Замени фото по решавање"
                              : "Додади фото по решавање"}
                        </span>
                        {currentIssue.after_photo_url && (
                          <span className="ml-auto text-[10px] text-teal-600 font-semibold">
                            ✓
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingAfter}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              uploadAfterPhoto(f);
                              setShowModMenu(false);
                            }
                          }}
                        />
                      </label>

                      <div className="my-1 h-px bg-zinc-100" />

                      {/* Delete */}
                      <button
                        onClick={() => {
                          deleteIssue();
                          setShowModMenu(false);
                        }}
                        disabled={deletingIssue}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60">
                        <Trash2 size={15} className="shrink-0" />
                        {deletingIssue ? "Се брише…" : "Избриши пријава"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {canModerate && <>{pendingRequestsSection}</>}

          {isEditing ? (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-teal-400"
                placeholder="Наслов"
              />
              <input
                value={editStreet}
                onChange={(e) => setEditStreet(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400"
                placeholder="Улица (опционално)"
              />
              {isAdmin && (
                <select
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value as District)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400">
                  {DISTRICT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {DISTRICT_LABELS[d] ?? d}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-teal-400"
                placeholder="Опис"
              />
              <button
                onClick={saveIssueEdits}
                disabled={savingIssue}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60">
                {savingIssue ? "Се зачувува..." : "Зачувај промени"}
              </button>
            </div>
          ) : (
            <div className="mt-8 mb-2">
              <h2 className="text-sm font-semibold leading-snug">
                {currentIssue.title}
              </h2>
              {currentIssue.street_name && (
                <p className="flex items-center gap-1 text-xs text-teal-600 font-medium mt-1">
                  <MapPin size={11} /> {currentIssue.street_name}
                </p>
              )}
              {currentIssue.description && (
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  {currentIssue.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Before / after photos */}
        {!hideImage &&
          (currentIssue.photo_url || currentIssue.after_photo_url) &&
          (currentIssue.photo_url && currentIssue.after_photo_url ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                  Пред
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc(currentIssue.photo_url!)}
                  className="block w-full cursor-zoom-in p-0">
                  <BlurImage
                    quality={IMAGE_QUALITY.opened}
                    src={currentIssue.photo_url}
                    alt="Пред"
                    width={1200}
                    height={900}
                    sizes="(max-width: 1024px) 50vw, 360px"
                    rounded="rounded-lg"
                    wrapperClassName="border border-zinc-200"
                    className="w-full object-cover h-80"
                  />
                </button>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wide mb-1">
                  Потоа
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc(currentIssue.after_photo_url!)}
                  className="block w-full cursor-zoom-in p-0">
                  <BlurImage
                    quality={IMAGE_QUALITY.opened}
                    src={currentIssue.after_photo_url}
                    alt="Потоа"
                    width={1200}
                    height={900}
                    sizes="(max-width: 1024px) 50vw, 360px"
                    rounded="rounded-lg"
                    wrapperClassName="border border-teal-200"
                    className="w-full object-cover h-80"
                  />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setLightboxSrc(
                  (currentIssue.photo_url ?? currentIssue.after_photo_url)!,
                )
              }
              className="block w-full cursor-zoom-in p-0">
              <BlurImage
                quality={IMAGE_QUALITY.opened}
                src={(currentIssue.photo_url ?? currentIssue.after_photo_url)!}
                alt="Фотографија"
                width={1600}
                height={1200}
                loading={variant === "full" ? "eager" : "lazy"}
                priority={variant === "full"}
                sizes="(max-width: 1024px) 100vw, 800px"
                rounded="rounded-lg"
                wrapperClassName="border border-zinc-200"
                className="w-full object-cover h-96 md:h-112"
              />
            </button>
          ))}

        {/* Counts row — same layout as IssueCard */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Помогни */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => helperUsers.length > 0 && setShowHelperPopup(true)}
              className={cn(
                "text-[11px] lg:text-sm font-bold tabular-nums transition-colors",
                helperUsers.length > 0
                  ? "text-zinc-700 hover:text-[#427FFF] cursor-pointer"
                  : "text-zinc-400 cursor-default",
              )}>
              {helperUsers.length || currentIssue.helper_count || 0}
            </button>
            <button
              onClick={() => {
                if (!userId) {
                  redirectToAuth();
                  return;
                }
                setHelperOpen(true);
              }}
              className={cn(
                "flex items-center gap-1 lg:gap-1.5 text-[10px] lg:text-sm font-medium transition-colors",
                isHelperDirect
                  ? "text-[#427FFF]"
                  : "text-zinc-500 hover:text-[#427FFF]",
              )}>
              {/* PomogniIcon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 50 48"
                fill="none"
                className="shrink-0">
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
              <span>Помогни</span>
            </button>
          </div>

          {/* Иста мака — always shown first (before Помогни) */}
          <div className="flex items-center gap-1.5 order-first">
            <button
              onClick={() =>
                affectedUsers.length > 0 && setShowAffectedPopup(true)
              }
              className={cn(
                "text-[11px] lg:text-sm font-bold tabular-nums transition-colors",
                affectedUsers.length > 0
                  ? "text-zinc-700 hover:text-[#427FFF] cursor-pointer"
                  : "text-zinc-400 cursor-default",
              )}>
              {affectedUsers.length || currentIssue.affected_count || 0}
            </button>
            <button
              onClick={async () => {
                if (!userId) {
                  redirectToAuth();
                  return;
                }
                const { createClient } =
                  await import("../../lib/supabase/client");
                const sb = createClient();
                // Optimistic — update immediately so the color changes on tap
                setIsAffected(!isAffected);
                if (isAffected) {
                  await sb
                    .from("issue_affected")
                    .delete()
                    .eq("issue_id", currentIssue.id)
                    .eq("user_id", userId);
                } else {
                  await sb
                    .from("issue_affected")
                    .insert({ issue_id: currentIssue.id, user_id: userId });
                }
                loadPeopleStats();
              }}
              className={cn(
                "flex items-center gap-1 lg:gap-1.5 text-[10px] lg:text-sm font-medium transition-colors",
                isAffected
                  ? "text-[#427FFF]"
                  : "text-zinc-500 hover:text-[#427FFF]",
              )}>
              {/* IstaMakaIcon */}
              <svg
                width="14"
                height="18"
                viewBox="0 0 35 49"
                fill="none"
                className="shrink-0">
                <path
                  d="M31.6967 22.5259C31.437 22.1027 18.8969 1.5043 18.3718 0.667791C17.811 -0.221342 16.509 -0.22525 15.9447 0.671986C14.889 2.36722 2.58627 22.5886 2.58627 22.5886C0.893804 25.3019 0 28.4341 0 31.6487C9.5329e-05 41.1111 7.69734 48.8084 17.1597 48.8084C26.622 48.8084 34.3193 41.1112 34.3193 31.6488C34.3193 28.4105 33.4117 25.2559 31.6967 22.5259ZM17.1597 43.0886C16.3693 43.0886 15.7298 42.449 15.7298 41.6587C15.7298 40.8683 16.3693 40.2287 17.1597 40.2287C21.8909 40.2287 25.7395 36.3801 25.7395 31.6489C25.7395 30.8586 26.379 30.219 27.1694 30.219C27.9598 30.219 28.5994 30.8586 28.5994 31.6489C28.5994 37.9567 23.4688 43.0886 17.1597 43.0886Z"
                  fill="currentColor"
                />
              </svg>
              <span>Иста мака</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-zinc-100 pt-3">
          {resolverSection}
          {helpActionsSection}
          {helpPlanningSection}
          {commentsSection}
        </div>
      </div>

      {showAffectedPopup && (
        <PeoplePopup
          title="Засегнати"
          icon={<AlertTriangle size={14} className="text-slate-600" />}
          users={affectedUsers}
          accentColor="slate"
          onClose={() => setShowAffectedPopup(false)}
        />
      )}
      {showHelperPopup && (
        <PeoplePopup
          title="Сакаат да помогнат"
          icon={<HandHelping size={14} className="text-teal-600" />}
          users={helperUsers}
          accentColor="teal"
          onClose={() => setShowHelperPopup(false)}
        />
      )}
      {proposeModal}
      {helperOpen && userId && (
        <HelperModal
          issueId={currentIssue.id}
          issueTitle={currentIssue.title}
          userId={userId}
          onClose={() => setHelperOpen(false)}
          onSuccess={() => {
            setIsHelperDirect(true);
            setHelperOpen(false);
            loadHelpOffers();
            loadPeopleStats();
          }}
        />
      )}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={currentIssue.title}
          beforeSrc={currentIssue.photo_url}
          afterSrc={currentIssue.after_photo_url}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
