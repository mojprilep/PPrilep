"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import StatusPill from "../ui/StatusPill";
import { DISTRICT_LABELS, formatDays } from "../../lib/utils";

export type ProfileIssue = {
  id: number;
  title: string;
  district: string;
  status: string;
  created_at: string;
  description: string | null;
  href: string;
};

export type ProfileActivity = {
  key: string;
  kind: "helper" | "affected";
  title: string;
  subtitle: string;
  href: string;
};

const PAGE = 7;
type Tab = "reports" | "activity";

export default function ProfileActivityTabs({
  issues,
  activity,
}: {
  issues: ProfileIssue[];
  activity: ProfileActivity[];
}) {
  const [tab, setTab] = useState<Tab>("reports");
  const [limit, setLimit] = useState({ reports: PAGE, activity: PAGE });

  const list = tab === "reports" ? issues : activity;
  const visible = limit[tab];
  const hasMore = list.length > visible;

  function showMore() {
    setLimit((p) => ({ ...p, [tab]: p[tab] + PAGE }));
  }

  return (
    <section className="rounded-3xl border border-[#e4ece8] bg-white p-4 sm:p-5">
      {/* Tabs */}
      <div className="mb-3 flex items-center gap-2 border-b border-[#edf2f0] pb-3">
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "reports"
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-[#e4ece8] text-theme-muted hover:text-theme-heading"
          }`}>
          Пријави ({issues.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "activity"
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-[#e4ece8] text-theme-muted hover:text-theme-heading"
          }`}>
          Активност ({activity.length})
        </button>
      </div>

      {/* Scrollable list — visible scrollbar once content grows past the cap */}
      <div className="max-h-112 space-y-2 overflow-y-auto pr-1.5">
        {tab === "reports" ? (
          issues.length === 0 ? (
            <p className="text-sm text-slate-500">Нема поднесени пријави.</p>
          ) : (
            issues.slice(0, visible).map((issue) => (
              <Link
                key={issue.id}
                href={issue.href}
                className="block rounded-2xl border border-[#e4ece8] px-3 py-2.5 transition-colors hover:border-[#cfe0da]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-slate-800">
                    {issue.title}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={issue.status as never} />
                    <span className="text-xs text-slate-400">
                      {formatDays(issue.created_at)}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {DISTRICT_LABELS[issue.district] ?? issue.district}
                  {issue.description && (
                    <>
                      {" · "}
                      <span className="line-clamp-1">{issue.description}</span>
                    </>
                  )}
                </p>
              </Link>
            ))
          )
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-500">Нема активност.</p>
        ) : (
          activity.slice(0, visible).map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`block rounded-2xl border px-3 py-2 transition-colors ${
                item.kind === "helper"
                  ? "border-[#d9f0e9] bg-[#f6fdfb] hover:border-[#bfe3db]"
                  : "border-[#e3e8f3] bg-[#f8faff] hover:border-[#cfd7ea]"
              }`}>
              <p className="text-sm font-semibold text-slate-800">
                {item.kind === "helper" ? "🤝" : "⚠️"} {item.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
            </Link>
          ))
        )}

        {hasMore && (
          <button
            type="button"
            onClick={showMore}
            className="w-full rounded-xl border border-[#dce6e2] bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50">
            Види повеќе
          </button>
        )}
      </div>
    </section>
  );
}
