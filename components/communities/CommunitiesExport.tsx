"use client";

import { Download } from "lucide-react";
import { CATEGORY_LABELS, DISTRICT_LABELS } from "../../lib/utils";
import { useViewer } from "../../lib/useViewer";
import type { DistrictStat } from "./DistrictCard";
import type { Category, District } from "../../lib/types/database";

interface RawIssue {
  id: number;
  title: string;
  district: string;
  status: string;
  category: string;
  street_name: string | null;
  created_at: string;
}

interface Props {
  stats: DistrictStat[];
  issues: RawIssue[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Отворен",
  progress: "Во тек",
  resolved: "Решен",
};

const DISTRICTS: District[] = [
  "Center", "Varoš", "Trizla", "Točila", "Rid", "Tipski", "Boncejca", "KorzoMaalo",
];

const CATEGORIES: Category[] = [
  "road", "water", "power", "garbage", "park",
  "negligent", "transport", "parking", "admin", "other",
];

function cell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function row(...cells: string[]): string {
  return cells.map(cell).join(",");
}

export default function CommunitiesExport({ stats, issues }: Props) {
  const { isAdmin } = useViewer();

  function exportCSV() {
    const lines: string[] = [];

    const date = new Date().toLocaleDateString("mk-MK");

    // ── HEADER ────────────────────────────────────────────────────────────────
    lines.push(row("ПОДОБАР ПРИЛЕП — ИЗВЕШТАЈ ЗА ПРИЈАВЕНИ ПРОБЛЕМИ", "", "", "", ""));
    lines.push(row(`Датум: ${date}`, "", `Вкупно пријави: ${issues.length}`, "", ""));
    lines.push("");

    // ── FILTER: BY DISTRICT ────────────────────────────────────────────────────
    lines.push(row("НАСЕЛБА", "ВКУПНО", "ОТВОРЕНИ", "ВО ТЕК", "РЕШЕНИ"));
    for (const s of stats) {
      if (s.total === 0) continue;
      lines.push(row(s.label, String(s.total), String(s.open), String(s.progress), String(s.resolved)));
    }
    lines.push("");

    // ── FILTER: BY CATEGORY ────────────────────────────────────────────────────
    lines.push(row("КАТЕГОРИЈА", "ВКУПНО", "ОТВОРЕНИ", "ВО ТЕК", "РЕШЕНИ"));
    for (const cat of CATEGORIES) {
      const catIssues = issues.filter((i) => i.category === cat);
      if (catIssues.length === 0) continue;
      lines.push(row(
        CATEGORY_LABELS[cat as Category] ?? cat,
        String(catIssues.length),
        String(catIssues.filter((i) => i.status === "open").length),
        String(catIssues.filter((i) => i.status === "progress").length),
        String(catIssues.filter((i) => i.status === "resolved").length),
      ));
    }
    lines.push("");

    // ── FILTER: BY STATUS ─────────────────────────────────────────────────────
    lines.push(row("СТАТУС", "БРОЈ"));
    lines.push(row("Отворени", String(issues.filter((i) => i.status === "open").length)));
    lines.push(row("Во тек", String(issues.filter((i) => i.status === "progress").length)));
    lines.push(row("Решени", String(issues.filter((i) => i.status === "resolved").length)));
    lines.push("");

    // ── DETAIL: INDIVIDUAL ISSUES (sorted by district → street → date) ────────
    lines.push(row("УЛИЦА", "#", "НАСЛОВ", "НАСЕЛБА", "КАТЕГОРИЈА", "СТАТУС", "ДАТУМ"));

    const sorted = [...issues].sort((a, b) => {
      const dA = DISTRICTS.indexOf(a.district as District);
      const dB = DISTRICTS.indexOf(b.district as District);
      if (dA !== dB) return dA - dB;
      const sA = a.street_name ?? "";
      const sB = b.street_name ?? "";
      if (sA !== sB) return sA.localeCompare(sB, "mk");
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let lastStreet = "";
    for (const issue of sorted) {
      const street = issue.street_name ?? "";
      const streetCell = street !== lastStreet ? street : "";
      lastStreet = street;

      lines.push(row(
        streetCell,
        String(issue.id),
        issue.title,
        DISTRICT_LABELS[issue.district as District] ?? issue.district,
        CATEGORY_LABELS[issue.category as Category] ?? issue.category,
        STATUS_LABELS[issue.status] ?? issue.status,
        new Date(issue.created_at).toLocaleDateString("mk-MK"),
      ));
    }

    const BOM = "﻿";
    const csv = BOM + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `населби-${date.replace(/\./g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Admin-only, decided in the browser so /communities can stay cached.
  if (!isAdmin) return null;

  return (
    <button
      onClick={exportCSV}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white transition-colors">
      <Download size={13} />
      Извези XLS
    </button>
  );
}
