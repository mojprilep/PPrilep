"use client";

import { useMemo, useState } from "react";
import AgencyPostCard from "./AgencyPostCard";
import { useViewer } from "../../lib/useViewer";
import { AGENCIES, type AgencyId } from "../../lib/agencies";
import type { AgencyPost } from "../../lib/types/database";

const MAX_VISIBLE = 3;

/**
 * Home-page announcements feed. Filter by "latest" (all) or a single company,
 * capped at the 5 most recent so the home page stays scannable.
 */
export default function HomeAgencyFeed({
  posts,
  canManage = false,
}: {
  posts: AgencyPost[];
  canManage?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | AgencyId>("all");
  // Admins are detected in the browser so the home page can stay cached.
  const { isAdmin } = useViewer();
  const manage = canManage || isAdmin;

  // Only offer company chips that actually have posts.
  const companies = useMemo(() => {
    const ids = new Set(posts.map((p) => p.agency_id));
    return (Object.keys(AGENCIES) as AgencyId[]).filter((id) => ids.has(id));
  }, [posts]);

  const visible = useMemo(() => {
    const filtered =
      filter === "all" ? posts : posts.filter((p) => p.agency_id === filter);
    // Red alerts first, then by recency (posts arrive already sorted by date).
    return [...filtered]
      .sort((a, b) => Number(b.is_red_alert) - Number(a.is_red_alert))
      .slice(0, MAX_VISIBLE);
  }, [posts, filter]);

  if (posts.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <h2 className="mr-1 text-sm font-semibold text-theme-heading">
          Соопштенија од службите
        </h2>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            filter === "all"
              ? "border-primary bg-primary text-white"
              : "border-theme bg-theme-surface text-theme-muted hover:border-primary/50"
          }`}>
          Најнови
        </button>
        {companies.map((id) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              filter === id
                ? "border-primary bg-primary text-white"
                : "border-theme bg-theme-surface text-theme-muted hover:border-primary/50"
            }`}>
            {AGENCIES[id].name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {visible.map((post) => (
          <AgencyPostCard
            key={post.id}
            post={post}
            showAgency
            canManage={manage}
          />
        ))}
      </div>
    </div>
  );
}
