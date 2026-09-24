import Link from "next/link";
import DynamicGreeting from "../../components/home/DynamicGreeting";
import HomeAgencyFeed from "../../components/agency/HomeAgencyFeed";
import { createPublicClient } from "../../lib/supabase/public";
import { DISTRICT_LABELS, STATUS_LABELS, getIssuePath } from "../../lib/utils";
import { STAGE_LABEL } from "../../lib/initiatives";
import { fetchTopHeroes } from "../../lib/data/issues";
import type { AgencyPost } from "../../lib/types/database";

type HomeIssue = {
  id: number;
  title: string;
  district: string;
  status: string;
  created_at: string;
};

type HomeInitiative = {
  id: string;
  title: string;
  stage: "idea" | "voting" | "funding" | "completed" | "rejected";
  vote_count: number;
  district: string | null;
  created_at: string;
};

// Same page for every visitor, cached for a minute. The personal bits (the
// greeting name, admin controls on the feed) are filled in client-side by
// useViewer, so the server never reads cookies here.
export const revalidate = 60;

export default async function HomePage() {
  const supabase = createPublicClient();
  // Hide agency posts whose active window hasn't started or has ended.
  const nowIso = new Date().toISOString();

  const [
    { data: issues },
    { data: initiatives },
    heroes,
    { data: agencyPosts },
  ] = await Promise.all([
    supabase
      .from("issues")
      .select("id, title, district, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("initiatives_with_details")
      .select("id, title, stage, vote_count, district, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
    // Top heroes by real community applause — the applause button writes to
    // issue_resolution_upvotes, summed per resolver. (NOT profiles.points.)
    fetchTopHeroes(supabase, 3),
    supabase
      .from("agency_posts")
      .select("*")
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  // Live leaderboard: top citizens by real community applause.
  const topHeroes: { count: number; name: string }[] = heroes.map((h) => ({
    name: h.name,
    count: h.points,
  }));

  const latestIssues = (issues as HomeIssue[] | null) ?? [];
  const latestInitiatives = (initiatives as HomeInitiative[] | null) ?? [];
  const posts = (agencyPosts as AgencyPost[] | null) ?? [];

  return (
    <div>
      <div>
        <DynamicGreeting fallbackName="Прилеп" />
      </div>
      <div className="mt-6 lg:mt-8">
        <p className="my-3 text-lg leading-8 text-theme-muted">
          Пријави проблеми. Координирај локални акции. Држи ги лидерите
          одговорни.
        </p>
        <HomeAgencyFeed posts={posts} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <section className="rounded-xl border border-theme bg-theme-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-theme-heading">
                Пријави
              </h2>
              <Link
                href="/issues"
                className="text-xs font-semibold text-theme-accent hover:text-primary/80">
                Види повеќе
              </Link>
            </div>
            <div className="space-y-2">
              {latestIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={getIssuePath(issue.id, issue.title)}
                  className="block rounded-lg border border-theme bg-theme-surface px-3 py-2 hover:border-[#cfe0da]">
                  <p className="truncate text-sm font-semibold text-theme-heading">
                    {issue.title}
                  </p>
                  <p className="mt-0.5 text-xs text-theme-muted">
                    {DISTRICT_LABELS[issue.district] ?? issue.district} •{" "}
                    {STATUS_LABELS[issue.status] ?? issue.status}
                  </p>
                </Link>
              ))}
              {latestIssues.length === 0 && (
                <p className="text-xs text-theme-subtle">Нема пријави.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-theme bg-theme-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-theme-heading">
                Херои
              </h2>
              <Link
                href="/heroes"
                className="text-xs font-semibold text-theme-accent hover:text-primary/80">
                Види повеќе
              </Link>
            </div>
            <div className="space-y-2">
              {topHeroes.map((hero, idx) => (
                <div
                  key={`${hero.name}-${idx}`}
                  className="rounded-lg border border-theme bg-theme-surface px-3 py-2">
                  <p className="text-sm font-semibold text-theme-heading">
                    {hero.name}
                  </p>
                  <p className="mt-0.5 text-xs text-theme-muted">
                    {hero.count} аплаузи
                  </p>
                </div>
              ))}
              {topHeroes.length === 0 && (
                <p className="text-xs text-theme-subtle">Сè уште нема херои.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-theme bg-theme-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-theme-heading">
                Иницијативи
              </h2>
              <Link
                href="/initiatives"
                className="text-xs font-semibold text-theme-accent hover:text-primary/80">
                Види повеќе
              </Link>
            </div>
            <div className="space-y-2">
              {latestInitiatives.map((it) => {
                const districtLabel = it.district
                  ? DISTRICT_LABELS[it.district] ?? it.district
                  : null;
                const stageLabel = STAGE_LABEL[it.stage] ?? it.stage;
                return (
                  <Link
                    key={it.id}
                    href={`/initiatives/${it.id}`}
                    className="block rounded-lg border border-theme bg-theme-surface px-3 py-2 hover:border-primary/50">
                    <p className="truncate text-sm font-semibold text-theme-heading">
                      {it.title}
                    </p>
                    <p className="mt-0.5 text-xs text-theme-muted">
                      {stageLabel}
                      {districtLabel ? ` · ${districtLabel}` : ""}
                      {" · "}
                      {it.vote_count} 👏
                    </p>
                  </Link>
                );
              })}
              {latestInitiatives.length === 0 && (
                <p className="text-xs text-theme-subtle">
                  Сè уште нема иницијативи.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
