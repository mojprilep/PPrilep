"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { LogOut } from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";
import { createClient } from "../../lib/supabase/client";
import { DISTRICT_LABELS, formatDays, getIssuePath } from "../../lib/utils";
import type { Issue } from "../../lib/types/database";

type RightPanelIssue = Pick<
  Issue,
  "id" | "title" | "district" | "status" | "created_at"
>;

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-slate-400 leading-snug">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ minWidth: "36px", width: "36px", height: "20px" }}
        className={`shrink-0 relative rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? "bg-primary" : "bg-slate-200"
        }`}>
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AccountRightPanel() {
  const { user, profile, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [primaryDistrict, setPrimaryDistrict] = useState("all");
  const [myIssuesCount, setMyIssuesCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [helperCount, setHelperCount] = useState(0);
  const [latestOpenIssues, setLatestOpenIssues] = useState<RightPanelIssue[]>([]);
  const [latestResolvedIssues, setLatestResolvedIssues] = useState<RightPanelIssue[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDistrictFeed, setLoadingDistrictFeed] = useState(true);

  // ── Notification toggles ──────────────────────────────────────────────────
  const [emailDigest, setEmailDigest] = useState(true);
  const [emailNewsletter, setEmailNewsletter] = useState(false);
  const [notifLocalIssues, setNotifLocalIssues] = useState(true);
  const [notifNeighbourhood, setNotifNeighbourhood] = useState(true);
  const [notifUrgent, setNotifUrgent] = useState(false);

  // Seed from profile + localStorage after hydration
  useEffect(() => {
    if (!user) return;
    const settingsKey = `account_notification_settings_${user.id}`;
    const id = setTimeout(() => {
      setEmailDigest(profile?.email_digest !== false);
      setEmailNewsletter(profile?.email_newsletter !== false);
      setNotifLocalIssues(profile?.notif_local_issues !== false);
      try {
        const raw = localStorage.getItem(settingsKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (typeof s.neighborhoodInitiatives === "boolean") setNotifNeighbourhood(s.neighborhoodInitiatives);
          if (typeof s.utilityUrgent === "boolean") setNotifUrgent(s.utilityUrgent);
        }
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(id);
  }, [user, profile]);

  async function saveEmailPref(field: "email_digest" | "email_newsletter" | "notif_local_issues", value: boolean) {
    if (!user) return;
    await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
  }

  function saveLocalNotif(updates: Partial<{ localIssues: boolean; neighborhoodInitiatives: boolean; utilityUrgent: boolean }>) {
    if (!user) return;
    const key = `account_notification_settings_${user.id}`;
    try {
      const raw = localStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : { localIssues: notifLocalIssues, neighborhoodInitiatives: notifNeighbourhood, utilityUrgent: notifUrgent };
      localStorage.setItem(key, JSON.stringify({ ...current, ...updates }));
    } catch { /* ignore */ }
  }

  // ── District — DB-backed (profiles.district), with live preview ────────────
  // Source of truth is profile.district from useAuth. We also listen to the
  // account page's change event so the feed previews live as the user edits the
  // dropdown (before they save / before the profile refetches).
  useEffect(() => {
    setPrimaryDistrict(profile?.district ?? "all");
  }, [profile?.district]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ primaryDistrict?: string }>;
      if (custom.detail?.primaryDistrict) {
        setPrimaryDistrict(custom.detail.primaryDistrict);
      }
    };
    window.addEventListener("account-settings-changed", handler as EventListener);
    return () => {
      window.removeEventListener("account-settings-changed", handler as EventListener);
    };
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let mounted = true;
    async function loadStats() {
      setLoadingStats(true);
      const [reportedRes, helperRes] = await Promise.all([
        supabase.from("issues").select("status", { count: "exact" }).eq("reported_by", uid).limit(200),
        supabase.from("issue_helpers").select("issue_id", { count: "exact", head: true }).eq("user_id", uid),
      ]);
      if (!mounted) return;
      const reported = (reportedRes.data as Array<{ status: string }> | null) ?? [];
      setMyIssuesCount(reported.length);
      setResolvedCount(reported.filter((i) => i.status === "resolved").length);
      setHelperCount(helperRes.count ?? 0);
      setLoadingStats(false);
    }
    loadStats();
    return () => { mounted = false; };
  }, [supabase, user]);

  // ── District feed ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const filtered = primaryDistrict !== "all" && Object.hasOwn(DISTRICT_LABELS, primaryDistrict);

    async function loadFeed() {
      setLoadingDistrictFeed(true);
      const base = (status: string) =>
        supabase.from("issues").select("id, title, district, status, created_at").eq("status", status).order("created_at", { ascending: false }).limit(2);
      const [openRes, resolvedRes] = await Promise.all([
        filtered ? base("open").eq("district", primaryDistrict) : base("open"),
        filtered ? base("resolved").eq("district", primaryDistrict) : base("resolved"),
      ]);
      if (!mounted) return;
      setLatestOpenIssues((openRes.data as RightPanelIssue[] | null) ?? []);
      setLatestResolvedIssues((resolvedRes.data as RightPanelIssue[] | null) ?? []);
      setLoadingDistrictFeed(false);
    }
    loadFeed();
    return () => { mounted = false; };
  }, [primaryDistrict, supabase, user]);

  const districtFeedLabel =
    primaryDistrict !== "all" && Object.hasOwn(DISTRICT_LABELS, primaryDistrict)
      ? DISTRICT_LABELS[primaryDistrict]
      : "Сите населби";

  return (
    <div className="space-y-4 lg:p-3">

      {/* ── Notification toggles — always at the top ── */}
      <section data-tour="notifications" className="rounded-2xl border border-[#e4ece8] bg-white p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-theme-subtle">
          Известувања
        </p>

        <Toggle
          checked={notifLocalIssues}
          onChange={(v) => { setNotifLocalIssues(v); saveEmailPref("notif_local_issues", v); }}
          label="Пријави во мојата населба"
          description="Нови пријави во твојата улица или населба"
        />
        <Toggle
          checked={notifNeighbourhood}
          onChange={(v) => { setNotifNeighbourhood(v); saveLocalNotif({ neighborhoodInitiatives: v }); }}
          label="Иницијативи во населба"
          description="Нови иницијативи во твојата населба"
        />
        <Toggle
          checked={notifUrgent}
          onChange={(v) => { setNotifUrgent(v); saveLocalNotif({ utilityUrgent: v }); }}
          label="Ургентни комунални"
          description="Итни известувања од претпријатија"
        />

        <div className="border-t border-[#f0f4f2] pt-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            Е-маил
          </p>
          <Toggle
            checked={emailDigest}
            onChange={(v) => { setEmailDigest(v); saveEmailPref("email_digest", v); }}
            label="Е-маил за непрочитани"
            description="Ако не ги видиш известувањата до крај на денот"
          />
          <Toggle
            checked={emailNewsletter}
            onChange={(v) => { setEmailNewsletter(v); saveEmailPref("email_newsletter", v); }}
            label="Дневна вест за Прилеп"
            description="Нови пријави и решени проблеми — еднаш дневно"
          />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-theme-subtle">
          Микро статистика
        </p>
        {loadingStats ? (
          <p className="mt-2 text-xs text-theme-muted">Се вчитува…</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { value: myIssuesCount, label: "Пријави" },
              { value: resolvedCount, label: "Решени" },
              { value: helperCount, label: "Помош" },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-[#e4ece8] bg-white px-2 py-2 text-center">
                <p className="text-base font-semibold text-theme-heading">{value}</p>
                <p className="text-[10px] text-theme-muted">{label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Local issues feed ── */}
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-theme-subtle">
          Локални пријави
        </p>
        <p className="mt-1 text-xs text-theme-muted">{districtFeedLabel}</p>

        {(["Отворени", "Решени"] as const).map((label) => {
          const issues = label === "Отворени" ? latestOpenIssues : latestResolvedIssues;
          const borderIdle = label === "Отворени" ? "border-[#f0d8d0] hover:border-[#e9c8bd]" : "border-[#d9ebe2] hover:border-[#c7e2d4]";
          return (
            <div key={label} className="mt-3">
              <p className="text-xs font-semibold text-slate-700">{label}</p>
              {loadingDistrictFeed ? (
                <p className="mt-1 text-xs text-theme-muted">Се вчитува…</p>
              ) : issues.length === 0 ? (
                <p className="mt-1 text-xs text-theme-muted">
                  {label === "Отворени" ? "Нема отворени пријави." : "Нема решени пријави."}
                </p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {issues.map((issue) => (
                    <Link
                      key={`${label}-${issue.id}`}
                      href={getIssuePath(issue.id, issue.title)}
                      className={`block rounded-lg border px-2.5 py-2 ${borderIdle}`}>
                      <p className="line-clamp-1 text-xs font-semibold text-slate-800">
                        {issue.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {DISTRICT_LABELS[issue.district] ?? issue.district} • {formatDays(issue.created_at)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Logout — mobile only */}
      <button
        type="button"
        onClick={() => signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 lg:hidden">
        <LogOut size={16} />
        Одјави се
      </button>
    </div>
  );
}
