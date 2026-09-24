"use client";

import Link from "@/components/ui/Link";
import { useState, useRef, useEffect } from "react";
import { LogOut, UserCircle2, Megaphone } from "lucide-react";
import AvatarInitials from "../ui/AvatarInitials";
import type { Profile } from "../../lib/types/database";

interface Props {
  profile: Profile | null;
  onSignOut: () => void;
}

export default function UserMenu({ profile, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded p-1 transition-colors hover:bg-zinc-100">
        <AvatarInitials
          name={profile?.full_name}
          avatarUrl={profile?.avatar_url}
          size="sm"
          membershipTier={profile?.membership_tier as import("../ui/AvatarInitials").MembershipTier}
          points={profile?.points}
        />
        <span className="hidden max-w-20 truncate text-xs text-zinc-600 sm:block">
          {profile?.full_name ?? "Профил"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          <div className="border-b border-zinc-100 px-3 py-2">
            <p className="truncate text-xs font-semibold text-zinc-800">
              {profile?.full_name ?? "Корисник"}
            </p>
            {profile?.username && (
              <p className="truncate text-[11px] text-zinc-400">
                @{profile.username}
              </p>
            )}
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
            <UserCircle2 size={13} /> Мој профил
          </Link>
          {profile?.agency_id && (
            <Link
              href={`/agency/${profile.agency_id}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-zinc-50">
              <Megaphone size={13} /> Соопштенија (служба)
            </Link>
          )}
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
            <LogOut size={13} /> Одјави се
          </button>
        </div>
      )}
    </div>
  );
}
