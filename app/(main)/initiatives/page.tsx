import Link from "@/components/ui/Link";
import { createClient } from "../../../lib/supabase/server";
import StagePipeline from "../../../components/initiatives/StagePipeline";
import InitiativeCard from "../../../components/initiatives/InitiativeCard";
import InitiativeEmpty from "../../../components/initiatives/InitiativeEmpty";
import InitiativeFilters from "../../../components/initiatives/InitiativeFilters";
import {
  CATEGORY_LABELS_INIT,
  INITIATIVE_TABS,
  type InitiativeTab,
} from "../../../lib/initiatives";
import type {
  InitiativeWithDetails,
  InitiativeStageCounts,
} from "../../../lib/types/database";

const PAGE_SIZE = 12;

const VALID_TABS = new Set(INITIATIVE_TABS.map((t) => t.value));

function asTab(v: string | undefined): InitiativeTab {
  return v && VALID_TABS.has(v as InitiativeTab) ? (v as InitiativeTab) : "all";
}

const VALID_DISTRICTS = new Set([
  "Center", "Varoš", "Trizla", "Točila", "Rid", "Tipski", "Boncejca", "KorzoMaalo",
]);
const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS_INIT));

interface PageProps {
  searchParams: Promise<{
    stage?: string;
    page?: string;
    category?: string;
    district?: string;
  }>;
}

export default async function InitiativesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = asTab(sp.stage);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const category = sp.category && VALID_CATEGORIES.has(sp.category) ? sp.category : null;
  const district = sp.district && VALID_DISTRICTS.has(sp.district) ? sp.district : null;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user
    ? (
        await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single()
      ).data?.is_admin === true
    : false;

  // ── Per-stage counts (single query) ──────────────────────────────────
  const { data: countRows } = await supabase
    .from("initiatives")
    .select("stage")
    .returns<{ stage: keyof InitiativeStageCounts }[]>();

  const counts: InitiativeStageCounts = {
    idea: 0,
    voting: 0,
    funding: 0,
    completed: 0,
    rejected: 0,
  };
  for (const r of countRows ?? []) {
    if (r.stage in counts) counts[r.stage]++;
  }

  // ── Initiatives query ────────────────────────────────────────────────
  let query = supabase
    .from("initiatives_with_details")
    .select("*", { count: "exact" })
    .range(from, to);

  if (category) query = query.eq("category", category);
  if (district) query = query.eq("district", district);

  if (tab === "idea") {
    query = query.eq("stage", "idea").order("created_at", { ascending: false });
  } else if (tab === "voting") {
    query = query.eq("stage", "voting").order("vote_count", { ascending: false });
  } else if (tab === "funding") {
    query = query.eq("stage", "funding").order("vote_count", { ascending: false });
  } else if (tab === "completed") {
    query = query.eq("stage", "completed").order("completed_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: items, count } = await query.returns<InitiativeWithDetails[]>();
  const initiatives = items ?? [];
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  // ── User's votes (for "voted" state on cards) ────────────────────────
  let userVotedIds: string[] = [];
  if (user && initiatives.length > 0) {
    const { data: votes } = await supabase
      .from("initiative_votes")
      .select("initiative_id")
      .eq("user_id", user.id)
      .in(
        "initiative_id",
        initiatives.map((i) => i.id),
      );
    userVotedIds = (votes ?? []).map((v) => v.initiative_id as string);
  }

  const activeStage = tab === "all" ? null : (tab as "idea" | "voting" | "funding" | "completed");

  return (
    <div className="space-y-4">
      <StagePipeline activeStage={activeStage} counts={counts} />

      <InitiativeFilters category={category} district={district} stage={tab} />

      {initiatives.length === 0 ? (
        <InitiativeEmpty tab={tab} isAuthed={!!user} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.map((i) => (
            <InitiativeCard
              key={i.id}
              initiative={i}
              currentUserId={user?.id}
              userVotedIds={userVotedIds}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <PagerLink tab={tab} page={page - 1} category={category} district={district} label="← Претходна" />
          )}
          <span className="text-xs text-theme-muted">
            Страна {page} од {totalPages}
          </span>
          {page < totalPages && (
            <PagerLink tab={tab} page={page + 1} category={category} district={district} label="Следна →" />
          )}
        </nav>
      )}
    </div>
  );
}



function PagerLink({
  tab,
  page,
  category,
  district,
  label,
}: {
  tab: InitiativeTab;
  page: number;
  category: string | null;
  district: string | null;
  label: string;
}) {
  const sp = new URLSearchParams();
  if (tab !== "all") sp.set("stage", tab);
  if (page > 1) sp.set("page", String(page));
  if (category) sp.set("category", category);
  if (district) sp.set("district", district);
  const qs = sp.toString();
  return (
    <Link
      href={qs ? `/initiatives?${qs}` : "/initiatives"}
      className="text-xs text-theme-ink hover:underline px-2 py-1">
      {label}
    </Link>
  );
}
