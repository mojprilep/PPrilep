import { createPublicClient } from "../../../lib/supabase/public";
import { DISTRICT_LABELS } from "../../../lib/utils";
import DistrictCard from "../../../components/communities/DistrictCard";
import CommunitiesExport from "../../../components/communities/CommunitiesExport";
import type { District, Category } from "../../../lib/types/database";
import type { DistrictStat, CategoryStat } from "../../../components/communities/DistrictCard";

const DISTRICTS: District[] = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
  "KorzoMaalo",
];

const CATEGORIES: Category[] = [
  "road", "water", "power", "garbage", "park",
  "negligent", "transport", "parking", "admin", "other",
];

// Public data only; the admin export button checks the viewer client-side.
export const revalidate = 60;

export default async function CommunitiesPage() {
  const supabase = createPublicClient();

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, district, status, category, street_name, created_at")
    .order("created_at", { ascending: false });

  const allIssues = issues ?? [];

  // Compute per-district, per-category breakdown
  const stats: DistrictStat[] = DISTRICTS.map((d) => {
    const dIssues = allIssues.filter((i) => i.district === d);

    const byCategory: CategoryStat[] = CATEGORIES.map((cat) => {
      const catIssues = dIssues.filter((i) => i.category === cat);
      return {
        category: cat,
        total: catIssues.length,
        open: catIssues.filter((i) => i.status === "open").length,
        progress: catIssues.filter((i) => i.status === "progress").length,
        resolved: catIssues.filter((i) => i.status === "resolved").length,
      };
    }).filter((c) => c.total > 0);

    return {
      district: d,
      label: DISTRICT_LABELS[d] ?? d,
      total: dIssues.length,
      open: dIssues.filter((i) => i.status === "open").length,
      progress: dIssues.filter((i) => i.status === "progress").length,
      resolved: dIssues.filter((i) => i.status === "resolved").length,
      byCategory,
    };
  });

  // City-wide totals for the summary banner
  const cityTotal = allIssues.length;
  const cityOpen = allIssues.filter((i) => i.status === "open").length;
  const cityProgress = allIssues.filter((i) => i.status === "progress").length;
  const cityResolved = allIssues.filter((i) => i.status === "resolved").length;

  return (
      <div className="space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-base font-semibold">Населби</h1>
          <p className="text-xs text-zinc-500">
            Статистика и проблеми по населби — кликнете за детален преглед
          </p>
        </div>

        {/* City-wide summary banner */}
        <div
          className="rounded-xl px-4 py-4"
          style={{ background: "linear-gradient(135deg, #2aa99d, #1d8f84)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Прилеп — Вкупно
            </p>
            <CommunitiesExport stats={stats} issues={allIssues} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-white">{cityTotal}</p>
              <p className="text-[10px] text-white/60 uppercase mt-0.5">Вкупно</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-200">{cityOpen}</p>
              <p className="text-[10px] text-white/60 uppercase mt-0.5">Отворени</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-200">{cityProgress}</p>
              <p className="text-[10px] text-white/60 uppercase mt-0.5">Во тек</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-200">{cityResolved}</p>
              <p className="text-[10px] text-white/60 uppercase mt-0.5">Решени</p>
            </div>
          </div>
          {/* City-wide progress bar */}
          {cityTotal > 0 && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/20 overflow-hidden flex">
              <div className="h-full bg-red-300/80" style={{ width: `${(cityOpen / cityTotal) * 100}%` }} />
              <div className="h-full bg-amber-300/80" style={{ width: `${(cityProgress / cityTotal) * 100}%` }} />
              <div className="h-full bg-white/70" style={{ width: `${(cityResolved / cityTotal) * 100}%` }} />
            </div>
          )}
        </div>

        {/* District cards */}
        <div className="space-y-3">
          {stats.map((s) => (
            <DistrictCard key={s.district} stat={s} />
          ))}
        </div>
      </div>
  );
}
