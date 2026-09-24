import { createPublicClient } from "@/lib/supabase/public";
import AvatarInitials from "@/components/ui/AvatarInitials";
import { formatDays } from "@/lib/utils";
import { notFound } from "next/navigation";

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IdeaDetailPage({ params }: Props) {
  const { id } = await params;
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId)) notFound();

  const supabase = createPublicClient();
  const { data: idea } = await supabase
    .from("ideas")
    .select("*, profiles(id, full_name, avatar_url, username, membership_tier, points)")
    .eq("id", ideaId)
    .single();

  if (!idea) notFound();

  return (
    <div className="space-y-4 px-3 py-4">
      <article className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {idea.profiles && (
              <AvatarInitials
                name={idea.profiles.full_name}
                avatarUrl={idea.profiles.avatar_url}
                size="sm"
                membershipTier={(idea.profiles as {membership_tier?: string | null}).membership_tier as import("@/components/ui/AvatarInitials").MembershipTier}
                points={(idea.profiles as {points?: number}).points}
              />
            )}
            <span className="text-xs text-zinc-500">
              {idea.profiles?.full_name ?? "Анонимно"}
            </span>
          </div>
          <span className="text-xs text-zinc-400">
            {formatDays(idea.created_at)}
          </span>
        </div>

        <h1 className="text-lg font-semibold text-zinc-900">{idea.title}</h1>
        {idea.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
            {idea.body}
          </p>
        )}

        <p className="mt-4 text-xs text-zinc-400">Гласови: {idea.upvotes}</p>
      </article>
    </div>
  );
}
