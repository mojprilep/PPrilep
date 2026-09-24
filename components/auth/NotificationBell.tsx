"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "@/components/ui/Link";
import { Bell } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { isMissingNotificationsTableError } from "../../lib/notifications";
import { agencyNameFromLink } from "../../lib/agencies";
import { cn } from "../../lib/utils";
import {
  formatDays,
  getIssuePath,
  parseIssueIdFromSegment,
} from "../../lib/utils";
import type { AppNotification, Profile } from "../../lib/types/database";

function resolveNotifLink(link: string, title: string): string {
  const segment = link.startsWith("/issues/")
    ? link.slice("/issues/".length)
    : null;
  if (!segment) return link;
  const id = parseIssueIdFromSegment(segment);
  if (!id) return link;
  return getIssuePath(id, title);
}

/**
 * Who the notification is *from*, as a resident would understand it.
 *
 * An agency announcement is published by a staff member, so `actor_user_id` is
 * that person — attributing "Водовод cut the water off" to their personal name
 * is both confusing and a privacy leak. Those rows carry an `/agency/<id>` link,
 * which is enough to name the institution instead. Everything else (comments,
 * status changes) really is from a person.
 */
function notifSender(n: AppNotification): string {
  const agency = agencyNameFromLink(n.link);
  if (agency && (n.type === "agency_post" || n.type === "agency_alert")) {
    return agency;
  }
  return n.actor?.full_name ?? n.actor?.username ?? "Некој";
}

interface Props {
  userId: string;
  buttonClassName?: string;
  iconSize?: number;
}

export default function NotificationBell({
  userId,
  buttonClassName,
  iconSize = 17,
}: Props) {
  const CACHE_KEY = `notif_unread_${userId}`;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  async function loadUnreadCount() {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (!error && !isMissingNotificationsTableError(error)) {
      const n = count ?? 0;
      setUnreadCount(n);
      localStorage.setItem(CACHE_KEY, String(n));
    }
  }

  async function loadNotifications() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, recipient_user_id, actor_user_id, type, title, body, link, read_at, created_at",
      )
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AppNotification[];
    const actorIds = [...new Set(rows.map((n) => n.actor_user_id))];
    let actorMap = new Map<string, Profile>();

    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username, points, created_at")
        .in("id", actorIds);
      actorMap = new Map((actors ?? []).map((a) => [a.id, a as Profile]));
    }

    setNotifications(
      rows.map((n) => ({ ...n, actor: actorMap.get(n.actor_user_id) ?? null })),
    );
    setLoading(false);

    if (unreadCount > 0) {
      const now = new Date().toISOString();
      const { error: markErr } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("recipient_user_id", userId)
        .is("read_at", null);
      if (!markErr) {
        setUnreadCount(0);
        localStorage.setItem(CACHE_KEY, "0");
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
      }
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    // Seed from cache after hydration — avoids SSR mismatch
    const cached = parseInt(localStorage.getItem(CACHE_KEY) ?? "0", 10);
    const seedId = setTimeout(() => {
      if (cached) setUnreadCount(cached);
    }, 0);

    const initialId = setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    const channelName = `notif-bell-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
          if (openRef.current) void loadNotifications();
        },
      )
      .subscribe();
    return () => {
      clearTimeout(seedId);
      clearTimeout(initialId);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      void loadNotifications();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-zinc-100 hover:text-slate-700",
          buttonClassName,
        )}>
        <Bell size={iconSize} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-25 z-50 px-3 lg:absolute lg:inset-auto lg:right-0 lg:top-full lg:mt-2 lg:w-80 lg:px-0">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
              <Bell size={13} className="text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-700">Известувања</p>
            </div>
            <div className="max-h-85 overflow-y-auto">
              <div className="p-2 space-y-1">
                {loading && (
                  <p className="py-5 text-center text-xs text-zinc-400">
                    Се вчитуваат...
                  </p>
                )}
                {!loading && notifications.length === 0 && (
                  <p className="py-5 text-center text-xs text-zinc-400">
                    Нема известувања.
                  </p>
                )}
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={resolveNotifLink(n.link, n.title)}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-50 ${
                      !n.read_at ? "bg-teal-50" : ""
                    }`}>
                    <p className="text-sm font-semibold text-zinc-800">
                      {notifSender(n)}{" "}
                      <span className="font-normal text-zinc-600">
                        {n.body}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {formatDays(n.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
