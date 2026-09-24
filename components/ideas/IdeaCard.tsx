"use client";

import { useMemo, useState } from "react";
import { ThumbsUp, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { createClient } from "../../lib/supabase/client";
import { createNotification } from "../../lib/notifications";
import { formatDays, cn } from "../../lib/utils";
import AvatarInitials from "../ui/AvatarInitials";
import type { Idea } from "../../lib/types/database";
import { toast } from "sonner";

interface Props {
  idea: Idea;
  userId?: string;
  initialVoted?: boolean;
  isAdmin?: boolean;
  onDeleted?: () => void;
}

export default function IdeaCard({
  idea,
  userId,
  initialVoted = false,
  isAdmin = false,
  onDeleted,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [upvotes, setUpvotes] = useState(idea.upvotes);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = !!userId && (userId === idea.created_by || isAdmin);

  async function handleDelete() {
    if (
      !window.confirm("Дали сте сигурни дека сакате да ја избришете идејата?")
    )
      return;
    setDeleting(true);
    const { error } = await supabase.from("ideas").delete().eq("id", idea.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Идејата е избришана");
    onDeleted?.();
  }

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

  async function upvote() {
    if (!userId) {
      redirectToAuth();
      return;
    }
    if (pending) return;

    // Optimistic flip
    const wasVoted = voted;
    setVoted(!wasVoted);
    setUpvotes((u) => Math.max(0, u + (wasVoted ? -1 : 1)));
    setPending(true);

    const { data, error } = await supabase
      .rpc("toggle_idea_upvote", { p_idea_id: idea.id })
      .single<{ upvotes: number; voted: boolean }>();

    setPending(false);

    if (error) {
      // Rollback
      setVoted(wasVoted);
      setUpvotes((u) => Math.max(0, u + (wasVoted ? 1 : -1)));
      toast.error(error.message);
      return;
    }

    if (data) {
      setUpvotes(data.upvotes);
      setVoted(data.voted);
    }

    // Only notify on new upvote (not on un-vote)
    if (!wasVoted) {
      await createNotification(supabase, {
        recipientUserId: idea.created_by,
        actorUserId: userId,
        type: "idea_upvote",
        title: idea.title,
        body: "ја лајкна вашата идеја",
        link: `/ideas/${idea.id}`,
      });
    }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            <Link href={`/ideas/${idea.id}`} className="hover:underline">
              {idea.title}
            </Link>
          </h3>
          {idea.body && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-3">
              {idea.body}
            </p>
          )}
        </div>
        <button
          onClick={upvote}
          className={cn(
            "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border text-xs font-semibold transition-colors shrink-0",
            voted
              ? "border-black bg-black text-white"
              : "border-zinc-200 text-zinc-600 hover:border-black",
          )}>
          <ThumbsUp size={12} />
          {upvotes}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {idea.profiles && (
            <AvatarInitials
              name={idea.profiles.full_name}
              size="sm"
              membershipTier={idea.profiles.membership_tier as import("../ui/AvatarInitials").MembershipTier}
              points={idea.profiles.points}
            />
          )}
          <span className="text-[11px] text-zinc-400 truncate">
            {idea.profiles?.full_name ?? "Анонимно"} ·{" "}
            {formatDays(idea.created_at)}
          </span>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Избриши идеја"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-60">
            <Trash2 size={12} />
            {deleting ? "Се брише…" : "Избриши"}
          </button>
        )}
      </div>
    </div>
  );
}
