"use client";

import Link from "@/components/ui/Link";
import { AlertTriangle, MapPin } from "lucide-react";
import { formatDays, getIssuePath, STATUS_LABELS } from "../../lib/utils";

export interface SimilarIssue {
  id: number;
  title: string;
  status: string;
  street_name: string | null;
  photo_url: string | null;
  created_at: string;
  meters: number | null;
}

interface Props {
  similar: SimilarIssue[];
  onDismiss?: () => void;
}

/**
 * Small alert card shown inline under the report form when the server
 * thinks the new report might be a duplicate. Non-blocking — the user
 * can still submit if they decide their issue is different.
 */
export default function DuplicateAlert({ similar, onDismiss }: Props) {
  if (similar.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-900">
            Можеби веќе постои сличен проблем
          </p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">
            Проверете дали тоа е истиот проблем — наместо да дуплирате
            пријава, може да се означите како засегнати.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {similar.map((s) => (
          <Link
            key={s.id}
            href={getIssuePath(s.id, s.title)}
            target="_blank"
            className="flex items-center gap-2 rounded-lg bg-white border border-amber-200 px-2.5 py-1.5 hover:border-amber-400 transition-colors">
            <MapPin size={11} className="text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">
                {s.title}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {s.street_name && <>{s.street_name} · </>}
                {STATUS_LABELS[s.status] ?? s.status}
                {" · "}
                {formatDays(s.created_at)}
                {s.meters !== null && <> · {s.meters}m</>}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
          Мојот проблем е различен — продолжи
        </button>
      )}
    </div>
  );
}
