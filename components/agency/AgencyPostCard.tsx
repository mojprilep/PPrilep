"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  MapPin,
  Clock,
  Droplet,
  Trash2,
  Lightbulb,
  Zap,
  Bus,
  Building2,
  Pencil,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "../../lib/supabase/client";
import { formatDays, DISTRICT_LABELS } from "../../lib/utils";
import { AGENCIES, type AgencyId } from "../../lib/agencies";
import type { AgencyPost } from "../../lib/types/database";

/** Per-company icon, accent colour, and the utility page it links to. */
const AGENCY_META: Record<
  AgencyId,
  { icon: LucideIcon; color: string; href: string }
> = {
  vodovod: { icon: Droplet, color: "text-sky-600", href: "/utility/water" },
  komunalec: {
    icon: Trash2,
    color: "text-emerald-600",
    href: "/utility/garbage",
  },
  osvetluvanje: {
    icon: Lightbulb,
    color: "text-amber-500",
    href: "/utility/power",
  },
  evn: { icon: Zap, color: "text-yellow-500", href: "/utility/electricity" },
  transport_parking: {
    icon: Bus,
    color: "text-indigo-600",
    href: "/prevoz",
  },
  municipality: {
    icon: Building2,
    color: "text-slate-600",
    href: "/agency/municipality",
  },
};

// Bodies longer than this get clamped with a "read more" toggle.
const CLAMP_THRESHOLD = 160;

/** Audience summary line ("Цела населба: Центар" / "Улици: …" / "Сите граѓани"). */
function audienceLabel(post: AgencyPost): string {
  if (post.audience === "all") return "Сите граѓани";
  if (post.audience === "district") {
    return `Населба: ${DISTRICT_LABELS[post.target_district ?? ""] ?? post.target_district ?? "—"}`;
  }
  return `Улици: ${(post.target_streets ?? []).join(", ")}`;
}

/** ISO timestamp → value for an <input type="datetime-local"> (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Human-readable active window ("до 27.07 14:45" / "од … до …"), or null.
 *
 * Formatted via Intl with an explicit Prilep timezone and numeric parts so the
 * output is byte-identical on the server and the client. Two traps this avoids:
 * a locale like "mk-MK" inserts "во 11:00" in the browser but not in Node, and
 * a bare Date.getHours() uses the runtime's own zone (UTC on the server, local
 * on the client) — both break hydration. Numeric en-GB parts + a fixed
 * timeZone sidestep both.
 */
const WINDOW_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Skopje",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmtWindow(iso: string): string {
  const p = Object.fromEntries(
    WINDOW_FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

function windowLabel(post: AgencyPost): string | null {
  if (!post.starts_at && !post.ends_at) return null;
  if (post.starts_at && post.ends_at)
    return `${fmtWindow(post.starts_at)} – ${fmtWindow(post.ends_at)}`;
  if (post.ends_at) return `до ${fmtWindow(post.ends_at)}`;
  return `од ${fmtWindow(post.starts_at!)}`;
}

export default function AgencyPostCard({
  post,
  showAgency = false,
  canManage = false,
}: {
  post: AgencyPost;
  showAgency?: boolean;
  /** Show edit/delete controls (the owning operator or an admin). */
  canManage?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body ?? "");
  const [editStarts, setEditStarts] = useState(toLocalInput(post.starts_at));
  const [editEnds, setEditEnds] = useState(toLocalInput(post.ends_at));
  const [busy, setBusy] = useState(false);
  const red = post.is_red_alert;
  const agencyName =
    AGENCIES[post.agency_id as AgencyId]?.name ?? post.agency_id;
  const meta = AGENCY_META[post.agency_id as AgencyId];
  const Icon = meta?.icon;

  const body = post.body ?? "";
  const isLong = body.length > CLAMP_THRESHOLD;
  const clickable = isLong && !editing;

  async function saveEdit() {
    if (!editTitle.trim()) {
      toast.error("Внеси наслов");
      return;
    }
    const startsIso = editStarts ? new Date(editStarts).toISOString() : null;
    const endsIso = editEnds ? new Date(editEnds).toISOString() : null;
    if (startsIso && endsIso && new Date(endsIso) <= new Date(startsIso)) {
      toast.error("Крајот мора да е по почетокот");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("update_agency_post", {
      p_id: post.id,
      p_title: editTitle.trim(),
      p_body: editBody.trim() || null,
      p_starts_at: startsIso,
      p_ends_at: endsIso,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Соопштението е изменето");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Да се избрише ова соопштение?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_agency_post", {
      p_id: post.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Соопштението е избришано");
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Наслов"
          className="mb-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={3}
          placeholder="Детали (опционално)"
          className="mb-3 w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
        />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-500">
            Прикажи од
            <input
              type="datetime-local"
              value={editStarts}
              onChange={(e) => setEditStarts(e.target.value)}
              className="rounded-lg border border-zinc-200 px-2.5 py-2 text-sm font-normal text-zinc-700 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-500">
            Скриј на
            <input
              type="datetime-local"
              value={editEnds}
              onChange={(e) => setEditEnds(e.target.value)}
              className="rounded-lg border border-zinc-200 px-2.5 py-2 text-sm font-normal text-zinc-700 outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditTitle(post.title);
              setEditBody(post.body ?? "");
              setEditStarts(toLocalInput(post.starts_at));
              setEditEnds(toLocalInput(post.ends_at));
              setEditing(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100">
            Откажи
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Се зачувува…" : "Зачувај"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={clickable ? () => setExpanded((v) => !v) : undefined}
      className={`rounded-xl border p-4 shadow-sm ${
        red ? "border-red-300 bg-red-50/70" : "border-theme bg-theme-surface"
      } ${clickable ? "cursor-pointer transition-colors hover:bg-zinc-50/60" : ""}`}>
      {/* 1. Company name + date */}
      <div className="mb-1 flex items-center justify-between gap-2">
        {showAgency && meta ? (
          <Link
            href={meta.href}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${meta.color} hover:underline`}>
            {Icon && <Icon size={12} />}
            {agencyName}
          </Link>
        ) : showAgency ? (
          <span className="text-[11px] font-semibold text-theme-accent">
            {agencyName}
          </span>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-theme-subtle">
            {formatDays(post.created_at)}
          </span>
          {canManage && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                aria-label="Измени"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove();
                }}
                disabled={busy}
                aria-label="Избриши"
                className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Title */}
      <h3
        className={`flex items-center gap-1.5 text-sm font-bold ${red ? "text-red-700" : "text-theme-heading"}`}>
        {red && <AlertTriangle size={15} className="shrink-0" />}
        {post.title}
      </h3>

      {/* 3. Body */}
      {body && (
        <p
          className={`mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-theme-muted ${
            isLong && !expanded ? "line-clamp-3" : ""
          }`}>
          {body}
        </p>
      )}
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 text-[11px] font-semibold text-theme-accent hover:underline">
          {expanded ? "Прикажи помалку" : "Прочитај повеќе"}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
          <MapPin size={11} />
          {audienceLabel(post)}
        </span>
        {windowLabel(post) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <Clock size={11} />
            {windowLabel(post)}
          </span>
        )}
      </div>
    </div>
  );
}
