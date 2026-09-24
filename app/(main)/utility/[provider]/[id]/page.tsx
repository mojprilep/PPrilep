import { createPublicClient } from "@/lib/supabase/public";
import StatusPill from "@/components/ui/StatusPill";
import { formatDays } from "@/lib/utils";
import type { Provider, IssueStatus } from "@/lib/types/database";
import { notFound } from "next/navigation";

const PROVIDERS: Provider[] = [
  "water",
  "garbage",
  "power",
  "electricity",
  "transport",
  "parking",
];
const PROVIDER_LABELS: Record<Provider, string> = {
  water: "Водовод",
  garbage: "Комуналец",
  power: "Осветлување",
  electricity: "Струја — ЕВН",
  transport: "Градски превоз",
  parking: "Паркинзи",
  kindergarten: "Градинки — Наша Иднина",
};
const PROVIDER_ICONS: Record<Provider, string> = {
  water: "💧",
  garbage: "🗑️",
  power: "💡",
  electricity: "⚡",
  transport: "🚌",
  parking: "🅿️",
  kindergarten: "🌸",
};

interface Props {
  params: Promise<{ provider: string; id: string }>;
}

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

export default async function UtilityPostDetailPage({ params }: Props) {
  const { provider, id } = await params;
  if (!PROVIDERS.includes(provider as Provider)) notFound();

  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const p = provider as Provider;
  const supabase = createPublicClient();
  const { data: post } = await supabase
    .from("utility_posts")
    .select("*")
    .eq("provider", p)
    .eq("id", postId)
    .single();

  if (!post) notFound();

  return (
      <div className="space-y-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h1 className="text-base font-semibold text-zinc-900">
              {PROVIDER_ICONS[p]} {PROVIDER_LABELS[p]}: {post.title}
            </h1>
            {post.status && <StatusPill status={post.status as IssueStatus} />}
          </div>

          {post.body && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {post.body}
            </p>
          )}

          <p className="mt-4 text-xs text-zinc-400">
            {formatDays(post.posted_at)}
          </p>
        </article>
      </div>
  );
}
