import { createPublicClient } from "../../../lib/supabase/public";
import { notFound } from "next/navigation";
import { TIER_CONFIG } from "../../../lib/tiers";
import ProfileActivityTabs, {
  type ProfileIssue,
  type ProfileActivity,
} from "../../../components/u/ProfileActivityTabs";
import { cdnUrl, getIssuePath, isReservedUsername } from "../../../lib/utils";

interface Props {
  params: Promise<{ username: string }>;
}

// UUID v4 pattern — used to detect user_id slugs vs plain usernames
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

export default async function PublicProfilePage({ params }: Props) {
  const { username: raw } = await params;
  const slug = decodeURIComponent(raw);

  // Root-level usernames share the URL namespace with app routes — reserved
  // segments (issues, account, …) must never resolve to a profile lookup.
  if (!UUID_RE.test(slug) && isReservedUsername(slug)) notFound();

  const supabase = createPublicClient();

  const isUuid = UUID_RE.test(slug);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, membership_tier, points")
    .eq(isUuid ? "id" : "username", slug)
    .single();

  if (!profile) notFound();

  const userId = profile.id;

  const [issuesRes, helpersRes, affectedRes] = await Promise.all([
    supabase
      .from("issues")
      .select("id, title, district, status, created_at, description")
      .eq("reported_by", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("issue_helpers")
      .select("issue_id, note, issues(id, title, district, status, created_at)")
      .eq("user_id", userId),
    supabase
      .from("issue_affected")
      .select("issue_id, issues(id, title, district, status, created_at)")
      .eq("user_id", userId),
  ]);

  const myIssues = (issuesRes.data ?? []) as Array<{
    id: number;
    title: string;
    district: string;
    status: string;
    created_at: string;
    description: string | null;
  }>;

  type IssueRef = {
    id: number;
    title: string;
    district: string;
    status: string;
    created_at: string;
  } | null;

  const helperActivity = (helpersRes.data ?? []) as unknown as Array<{
    issue_id: number;
    note: string | null;
    issues: IssueRef;
  }>;

  const affectedActivity = (affectedRes.data ?? []) as unknown as Array<{
    issue_id: number;
    issues: IssueRef;
  }>;

  // Show only the username as the public identity (not the Google/email name).
  const handle = profile.username ?? "корисник";
  const tier = (profile as { membership_tier?: string | null }).membership_tier
    ? TIER_CONFIG[
        (profile as { membership_tier: string })
          .membership_tier as keyof typeof TIER_CONFIG
      ] ?? null
    : null;
  const initials = handle.slice(0, 2).toUpperCase();

  // ── Build serializable data for the client tabs ──
  const issues: ProfileIssue[] = myIssues.map((i) => ({
    id: i.id,
    title: i.title,
    district: i.district,
    status: i.status,
    created_at: i.created_at,
    description: i.description,
    href: getIssuePath(i.id, i.title),
  }));

  const activity: ProfileActivity[] = [
    ...helperActivity.map((item) => ({
      key: `helper-${item.issue_id}`,
      kind: "helper" as const,
      title: item.issues?.title ?? `Пријава #${item.issue_id}`,
      subtitle: item.note?.trim() ? `"${item.note}"` : "Се пријавил/а за помош",
      href: getIssuePath(item.issue_id, item.issues?.title ?? `issue-${item.issue_id}`),
    })),
    ...affectedActivity.map((item) => ({
      key: `affected-${item.issue_id}`,
      kind: "affected" as const,
      title: item.issues?.title ?? `Пријава #${item.issue_id}`,
      subtitle: "Засегнат/а од овој проблем",
      href: getIssuePath(item.issue_id, item.issues?.title ?? `issue-${item.issue_id}`),
    })),
  ];

  return (
    <div className="space-y-5">
      {/* ── Profile header — centered, no card bg (matches account page) ── */}
      <section className="pb-1">
        <div className="flex flex-col items-center gap-2.5 pt-2 text-center">
          {/* Big avatar with badge-colored ring + badge overlay */}
          <div className="relative">
            <div
              className="h-28 w-28 overflow-hidden rounded-full"
              style={{ padding: "3px", background: tier ? tier.color : "#dce6e2" }}>
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cdnUrl(profile.avatar_url)}
                  alt={handle}
                  className="h-full w-full rounded-full border-2 border-white object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-2xl font-semibold text-white">
                  {initials}
                </div>
              )}
            </div>
            {tier && (
              <span
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full text-base ring-2 ring-white"
                style={{ background: tier.bg, color: tier.color }}
                title={tier.label}>
                {tier.emoji}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-lg font-semibold text-slate-900">{handle}</h1>
            <div className="mt-1.5 flex items-center justify-center gap-3 text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-800">{myIssues.length}</span>{" "}
                пријави
              </span>
              <span>
                <span className="font-semibold text-slate-800">{helperActivity.length}</span>{" "}
                помогнал/а
              </span>
              <span>
                <span className="font-semibold text-slate-800">{affectedActivity.length}</span>{" "}
                засегнат/а
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reports + Activity tabs (max 7, see-more, scrollable) ── */}
      <ProfileActivityTabs issues={issues} activity={activity} />
    </div>
  );
}
