"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { ChevronDown } from "lucide-react";
import { CATEGORY_LABELS, categoryIcon } from "../../lib/utils";
import type { Category } from "../../lib/types/database";

export interface CategoryStat {
  category: Category;
  total: number;
  open: number;
  progress: number;
  resolved: number;
}

export interface DistrictStat {
  district: string;
  label: string;
  total: number;
  open: number;
  progress: number;
  resolved: number;
  byCategory: CategoryStat[];
}

const STATUS_FILTERS = [
  { key: "all", label: "Сите" },
  { key: "open", label: "Отворени" },
  { key: "progress", label: "Во тек" },
  { key: "resolved", label: "Решени" },
] as const;

type FilterKey = (typeof STATUS_FILTERS)[number]["key"];

const CATEGORY_PREVIEW = 4;

export default function DistrictCard({ stat }: { stat: DistrictStat }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);

  const resolveRate =
    stat.total > 0 ? Math.round((stat.resolved / stat.total) * 100) : 0;

  // Categories that have at least 1 issue matching the current filter
  const visibleCategories = stat.byCategory
    .filter((c) => {
      if (filter === "all") return c.total > 0;
      return c[filter] > 0;
    })
    .sort((a, b) => {
      const va = filter === "all" ? a.total : a[filter];
      const vb = filter === "all" ? b.total : b[filter];
      return vb - va;
    });

  function countFor(c: CategoryStat): number {
    if (filter === "all") return c.total;
    return c[filter];
  }

  function statusParam(s: FilterKey): string {
    return s === "all" ? "" : `&status=${s}`;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* ── Card header — click to expand ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-4 flex items-start gap-3 hover:bg-zinc-50 transition-colors">
        {/* Left: name + summary numbers */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">{stat.label}</h2>
            {stat.total > 0 && (
              <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                {stat.total} вкупно
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {stat.open} отворени
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              {stat.progress} во тек
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              {stat.resolved} решени
            </span>
          </div>

          {/* Progress bar */}
          {stat.total > 0 && (
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden flex">
              <div
                className="h-full bg-red-400 transition-all"
                style={{ width: `${(stat.open / stat.total) * 100}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(stat.progress / stat.total) * 100}%` }}
              />
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${(stat.resolved / stat.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Right: resolution % + chevron */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {stat.total > 0 && (
            <span className={`text-xs font-bold tabular-nums ${resolveRate >= 50 ? "text-emerald-600" : "text-red-500"}`}>
              {resolveRate}% решено
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* ── Expanded breakdown ── */}
      {expanded && (
        <div className="border-t border-zinc-100">
          {stat.total === 0 ? (
            <p className="px-4 py-5 text-xs text-zinc-400 text-center">
              Нема пријавени проблеми во оваа населба.
            </p>
          ) : (
            <>
              {/* Status filter pills */}
              <div className="flex gap-1.5 px-4 py-3 border-b border-zinc-100 overflow-x-auto scrollbar-none">
                {STATUS_FILTERS.map((f) => {
                  const countMap = { all: stat.total, open: stat.open, progress: stat.progress, resolved: stat.resolved };
                  const count = countMap[f.key];
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setFilter(f.key); setShowAll(false); }}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        filter === f.key
                          ? "bg-zinc-800 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}>
                      {f.label}
                      <span className={`text-[10px] font-bold tabular-nums ${filter === f.key ? "text-zinc-300" : "text-zinc-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Category table */}
              <div className="px-4 py-3">
                {visibleCategories.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-3">
                    Нема проблеми со овој статус.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-2 pb-1 border-b border-zinc-100">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase">Категорија</span>
                      {filter === "all" ? (
                        <>
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase text-right">Вкупно</span>
                          <span className="text-[10px] font-semibold text-red-400 uppercase text-right">Отв.</span>
                          <span className="text-[10px] font-semibold text-amber-400 uppercase text-right">Тек</span>
                          <span className="text-[10px] font-semibold text-emerald-500 uppercase text-right">Реш.</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase text-right col-span-4">Пријави</span>
                      )}
                    </div>

                    {/* Rows */}
                    {(showAll ? visibleCategories : visibleCategories.slice(0, CATEGORY_PREVIEW)).map((c) => (
                      <Link
                        key={c.category}
                        href={`/issues?district=${stat.district}&category=${c.category}${statusParam(filter)}`}
                        className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-2 py-2 rounded-lg hover:bg-zinc-50 transition-colors group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{categoryIcon(c.category)}</span>
                          <span className="text-xs text-zinc-700 font-medium truncate group-hover:text-teal-700 transition-colors">
                            {CATEGORY_LABELS[c.category]}
                          </span>
                        </div>
                        {filter === "all" ? (
                          <>
                            <span className="text-xs font-bold tabular-nums text-zinc-700 text-right">{c.total}</span>
                            <span className="text-xs font-semibold tabular-nums text-red-500 text-right">{c.open}</span>
                            <span className="text-xs font-semibold tabular-nums text-amber-500 text-right">{c.progress}</span>
                            <span className="text-xs font-semibold tabular-nums text-emerald-600 text-right">{c.resolved}</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold tabular-nums text-zinc-700 text-right col-span-4">
                            {countFor(c)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Show more / view all */}
                <div className="pt-3 border-t border-zinc-100 mt-2 flex items-center justify-between">
                  {!showAll && visibleCategories.length > CATEGORY_PREVIEW ? (
                    <button
                      onClick={() => setShowAll(true)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                      Прегледај ги сите категории ({visibleCategories.length - CATEGORY_PREVIEW} повеќе) →
                    </button>
                  ) : showAll ? (
                    <button
                      onClick={() => setShowAll(false)}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors">
                      ↑ Помалку
                    </button>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/issues?district=${stat.district}${statusParam(filter)}`}
                    className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                    Сите пријави →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
