"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { X } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import AvatarInitials, { type MembershipTier } from "../ui/AvatarInitials";

interface SupporterProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  membership_tier: string | null;
  points: number | null;
}

interface VoteRow {
  user_id: string;
  created_at: string;
  profiles: SupporterProfile | null;
}

/**
 * Public "supported by" list for an initiative — the people who clicked
 * Поддржи. A compact avatar-stack + count trigger opens a scrollable popup
 * (same pattern as the "Иста мака" list on issue cards). Reads
 * `initiative_votes` (public RLS) embedding the anon-readable profile columns.
 * Renders nothing while empty so the modal stays clean.
 */
export default function InitiativeSupporters({
  initiativeId,
}: {
  initiativeId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<VoteRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("initiative_votes")
      .select(
        "user_id, created_at, profiles:user_id(id, full_name, username, avatar_url, membership_tier, points)",
      )
      .eq("initiative_id", initiativeId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        setRows(data as unknown as VoteRow[]);
      });
    return () => {
      alive = false;
    };
  }, [supabase, initiativeId]);

  // Close the popup on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const supporters = rows
    .map((r) => r.profiles)
    .filter((p): p is SupporterProfile => !!p);

  if (supporters.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      {/* Trigger — avatar stack + count */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full py-0.5 pr-1 transition-colors hover:opacity-90">
        <div className="flex -space-x-2">
          {supporters.slice(0, 3).map((p) => (
            <span key={p.id} className="ring-2 ring-white rounded-full">
              <AvatarInitials
                name={p.full_name ?? p.username ?? "Анонимно"}
                avatarUrl={p.avatar_url}
                size="sm"
                membershipTier={p.membership_tier as MembershipTier}
                points={p.points}
              />
            </span>
          ))}
        </div>
        <span className="text-[12px] font-medium text-zinc-600">
          {supporters.length} поддржувачи
        </span>
      </button>

      {/* Popup — scrollable list */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-48 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-3 py-2">
            <p className="text-xs font-semibold text-zinc-700">
              {supporters.length} поддржувачи
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 transition-colors hover:text-zinc-700">
              <X size={12} />
            </button>
          </div>
          {supporters.map((p) => {
            const name = p.full_name ?? p.username ?? "Анонимно";
            const href = p.username ? `/${p.username}` : `/${p.id}`;
            return (
              <Link
                key={p.id}
                href={href}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-zinc-50">
                <AvatarInitials
                  name={name}
                  avatarUrl={p.avatar_url}
                  size="sm"
                  membershipTier={p.membership_tier as MembershipTier}
                  points={p.points}
                />
                <span className="truncate text-xs text-zinc-700">{name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
