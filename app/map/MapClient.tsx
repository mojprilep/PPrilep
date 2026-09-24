"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "@/components/ui/Link";
import { X } from "lucide-react";
import { CATEGORY_LABELS, getIssuePath, cdnUrl } from "../../lib/utils";
import type { Category, District, IssueStatus } from "../../lib/types/database";
import StatusPill from "../../components/ui/StatusPill";
import StatusTimelinePopup from "../../components/ui/StatusTimelinePopup";
import FilterSelect from "../../components/ui/FilterSelect";
import { COOPERATIVE_MAP_OPTIONS } from "../../lib/map/cooperative";

export type PinnedIssue = {
  id: number;
  title: string;
  category: Category;
  status: IssueStatus;
  created_at: string;
  updated_at?: string | null;
  street_name: string | null;
  photo_url: string | null;
  district: District;
  lat: number | null;
  lng: number | null;
};

const CATEGORY_COLORS: Record<Category, string> = {
  road: "#ef4444",
  water: "#3b82f6",
  power: "#f59e0b",
  garbage: "#84cc16",
  park: "#22c55e",
  negligent: "#f97316",
  transport: "#8b5cf6",
  parking: "#06b6d4",
  admin: "#6b7280",
  other: "#94a3b8",
};

// Approximate district centers for issues without a pin
const DISTRICT_CENTERS: Record<District, [number, number]> = {
  Center: [21.5551, 41.3458],
  Varoš: [21.549, 41.351],
  Trizla: [21.562, 41.338],
  Točila: [21.57, 41.352],
  Rid: [21.578, 41.36],
  Tipski: [21.545, 41.354],
  Boncejca: [21.535, 41.348],
  KorzoMaalo: [21.551, 41.343],
};

// Prileple bounding box — users can't pan outside the city
const PRILEP_BOUNDS: [[number, number], [number, number]] = [
  [21.44, 41.28], // SW
  [21.67, 41.42], // NE
];

function createMarkerEl(color: string, isPinned: boolean) {
  const size = isPinned ? 14 : 11;

  // Outer wrapper — fixed 28px hit area so hover never flickers when the
  // inner dot scales up (scaling changes the visual size but the wrapper
  // stays the same, so mouseenter/leave don't rapidly toggle).
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${isPinned ? color : "white"};
    border:2px solid ${color};
    box-shadow:0 1px 6px rgba(0,0,0,0.3);
    transition:transform 0.12s ease, box-shadow 0.12s ease;
    opacity:${isPinned ? 1 : 0.8};
    pointer-events:none;
  `;

  wrapper.appendChild(dot);
  wrapper.addEventListener("mouseenter", () => {
    dot.style.transform = "scale(1.6)";
    dot.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
  });
  wrapper.addEventListener("mouseleave", () => {
    dot.style.transform = "scale(1)";
    dot.style.boxShadow = "0 1px 6px rgba(0,0,0,0.3)";
  });
  return wrapper;
}

export default function MapClient({ issues }: { issues: PinnedIssue[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [selected, setSelected] = useState<PinnedIssue | null>(null);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [category, setCategory] = useState<Category | "all">("all");

  const allCategories = Array.from(
    new Set(issues.map((i) => i.category)),
  ) as Category[];

  const visible =
    category === "all" ? issues : issues.filter((i) => i.category === category);
  const hasActiveFilters = category !== "all";

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [21.5551, 41.3458],
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: PRILEP_BOUNDS,
      attributionControl: { compact: true },
      ...COOPERATIVE_MAP_OPTIONS,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers whenever visible set changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    visible.forEach((issue) => {
      const isPinned = !!(issue.lat && issue.lng);
      const lngLat: [number, number] = isPinned
        ? [issue.lng!, issue.lat!]
        : (DISTRICT_CENTERS[issue.district] ?? [21.5551, 41.3458]);

      const el = createMarkerEl(CATEGORY_COLORS[issue.category], isPinned);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setShowStatusPopup(false);
        setSelected(issue);
      });
      // el is the wrapper; click is already on wrapper ✓

      markersRef.current.push(marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, category]);

  return (
    <div className="flex flex-col gap-3 px-4 py-4 2xl:px-0">
      {/* Category filter (always visible) */}
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-sm font-semibold text-theme-muted">
          Филтер
        </p>
        <div className="min-w-0 flex-1 rounded-xl border border-theme bg-theme-surface p-1.5">
          <FilterSelect
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
            isActive={hasActiveFilters}
            className="w-full"
            options={[
              { value: "all", label: "Категории" },
              ...allCategories.map((cat) => ({
                value: cat,
                label: CATEGORY_LABELS[cat],
              })),
            ]}
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setCategory("all")}
            className="shrink-0 px-2 py-1 text-xs font-medium text-theme-muted transition-colors hover:bg-theme-surface-muted hover:text-theme-ink">
            Ресет
          </button>
        )}
      </div>

      {/* Map frame */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-200 h-150">
        {/* Map */}
        <div
          ref={containerRef}
          className="w-full h-full"
          onClick={() => {
            setShowStatusPopup(false);
            setSelected(null);
          }}
        />

        {/* Issue popup */}
        {selected && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* Photo */}
            {selected.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cdnUrl(selected.photo_url)}
                alt={selected.title}
                className="w-full h-36 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Category + approximate badge */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLORS[selected.category] }}
                    />
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                      {CATEGORY_LABELS[selected.category]}
                    </p>
                    {!(selected.lat && selected.lng) && (
                      <span className="text-[10px] text-zinc-300">
                        · приближно
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <p className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-2">
                    {selected.title}
                  </p>
                  {/* Street */}
                  {selected.street_name && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {selected.street_name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowStatusPopup(false);
                    setSelected(null);
                  }}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors">
                  <X size={13} />
                </button>
              </div>

              {/* Footer: status + CTA */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowStatusPopup(true)}
                  className="cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                  title="Кликни за статус детали"
                  aria-label="Прикажи статус детали">
                  <StatusPill status={selected.status} />
                </button>
                <Link
                  href={getIssuePath(selected.id, selected.title)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors">
                  Отвори пријава →
                </Link>
              </div>
            </div>
          </div>
        )}
        {selected && showStatusPopup && (
          <StatusTimelinePopup
            issue={selected}
            onClose={() => setShowStatusPopup(false)}
          />
        )}
      </div>
      {/* end map frame */}
    </div>
  );
}
