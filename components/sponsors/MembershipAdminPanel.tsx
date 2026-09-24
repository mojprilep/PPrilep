"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "@/components/ui/Link";
import {
  ShieldCheck,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import AvatarInitials, { type MembershipTier } from "../ui/AvatarInitials";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  adminFetchMembers,
  adminFetchRequests,
  adminSetMembershipTier,
  adminApproveMembership,
  adminRejectMembership,
  type MembershipTier as TierType,
} from "../../app/actions/membership";

// ── Tier display config ───────────────────────────────────────────────────────

const TIER_OPTIONS: {
  value: TierType | "none";
  label: string;
  color: string;
}[] = [
  { value: "none", label: "— Нема —", color: "#9ca3af" },
  { value: "volunteer", label: "Волонтер", color: "#2aa99d" },
  { value: "monthly", label: "Месечна", color: "#ca8a04" },
  { value: "yearly", label: "Годишна", color: "#b45309" },
  { value: "mega_donor", label: "МегаГигаДонатор", color: "#92610a" },
  { value: "mega_donator", label: "МегаДонатор", color: "#047857" },
  { value: "company_basic", label: "Партнер Basic", color: "#4f46e5" },
  { value: "company_preferred", label: "Партнер+", color: "#7c3aed" },
  { value: "company_premium", label: "Премиум", color: "#be185d" },
];

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  membership_tier: string | null;
  created_at: string;
}

// ── Tier select ───────────────────────────────────────────────────────────────

function TierSelect({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<string>(
    profile.membership_tier ?? "none",
  );

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const prev = current;
    setCurrent(val);
    startTransition(async () => {
      const tier = val === "none" ? null : (val as TierType);
      const res = await adminSetMembershipTier(profile.id, tier);
      if (res.error) {
        setCurrent(prev);
        toast.error(res.error);
      } else {
        const label = TIER_OPTIONS.find((o) => o.value === val)?.label ?? val;
        toast.success(`${profile.full_name ?? "Корисник"} → ${label}`);
      }
    });
  }

  const tierOption =
    TIER_OPTIONS.find((o) => o.value === current) ?? TIER_OPTIONS[0];

  return (
    <div className="relative inline-flex w-full min-w-0 items-center gap-1.5">
      {pending && (
        <RefreshCw
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 animate-spin text-zinc-400"
        />
      )}
      <select
        value={current}
        onChange={handleChange}
        disabled={pending}
        className={cn(
          "w-full min-w-0 appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-semibold",
          "bg-white outline-none cursor-pointer transition-colors",
          "focus:ring-2 focus:ring-primary/30",
          pending && "pl-7 opacity-50 pointer-events-none",
        )}
        style={{ borderColor: tierOption.color, color: tierOption.color }}>
        {TIER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ color: tierOption.color }}>
        <path
          d="M2 3.5 L5 6.5 L8 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── Pending request card ──────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  volunteer: "Волонтер",
  monthly: "Месечна",
  yearly: "Годишна",
  mega_donor: "МегаГигаДонатор",
  mega_donator: "МегаДонатор",
  company_basic: "Партнер Basic",
  company_preferred: "Партнер+",
  company_premium: "Премиум",
};

interface MemberRequest {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  tier: string;
  message: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
}

// ── Expandable request message ────────────────────────────────────────────────

function RequestMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Only offer a toggle when the text is long enough to actually get clamped.
  const clampable = text.length > 90;

  return (
    <button
      type="button"
      onClick={() => clampable && setExpanded((e) => !e)}
      className={cn(
        "mt-1 block w-full text-left text-xs italic text-zinc-500",
        !expanded && "line-clamp-2",
        clampable && "cursor-pointer hover:text-zinc-700",
      )}>
      {text}
      {clampable && (
        <span className="ml-1 not-italic font-semibold text-zinc-400">
          {expanded ? "прикажи помалку" : "прикажи повеќе"}
        </span>
      )}
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function MembershipAdminPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "members" | "none">("all");
  const [search, setSearch] = useState("");
  const [actionPending, setActionPending] = useState<number | null>(null);
  const [membersOpen, setMembersOpen] = useState(true);

  function loadData() {
    setLoading(true);
    Promise.all([adminFetchMembers(), adminFetchRequests()]).then(
      ([members, reqs]) => {
        setProfiles((members.data as Profile[]) ?? []);
        setRequests((reqs.data as MemberRequest[]) ?? []);
        setLoading(false);
      },
    );
  }

  function reload() {
    loadData();
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function approve(id: number) {
    setActionPending(id);
    const res = await adminApproveMembership(id);
    if ("error" in res && res.error) toast.error(res.error);
    else {
      toast.success("Одобрено! Е-пошта е испратена.");
      reload();
    }
    setActionPending(null);
  }

  async function reject(id: number) {
    setActionPending(id);
    const res = await adminRejectMembership(id);
    if ("error" in res && res.error) toast.error(res.error);
    else {
      toast.success("Одбиено.");
      reload();
    }
    setActionPending(null);
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");

  const q = search.toLowerCase().trim();
  const shown = profiles.filter((p) => {
    if (filter === "members" && p.membership_tier === null) return false;
    if (filter === "none" && p.membership_tier !== null) return false;
    if (!q) return true;
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={16} className="text-zinc-500" />
        <h2 className="text-sm font-bold text-zinc-900">
          Управување со членови
        </h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
          Admin
        </span>
      </div>

      {/* ── Pending requests ── */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-amber-500" />
            <p className="text-xs font-bold text-zinc-700">Чекаат одобрување</p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              {pendingRequests.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {req.user_id ? (
                      <Link
                        href={`/${req.user_id}`}
                        className="truncate text-sm font-semibold text-zinc-900 hover:underline">
                        {req.full_name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {req.full_name}
                      </p>
                    )}
                    <p className="truncate text-xs text-zinc-500">
                      {req.email}
                      {req.phone ? ` · ${req.phone}` : ""}
                    </p>
                    <p
                      className="mt-0.5 text-xs font-semibold"
                      style={{ color: "#2aa99d" }}>
                      {TIER_LABELS[req.tier] ?? req.tier}
                    </p>
                    {req.message && <RequestMessage text={req.message} />}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => approve(req.id)}
                    disabled={actionPending === req.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-100 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50">
                    <CheckCircle2 size={13} /> Одобри
                  </button>
                  <button
                    onClick={() => reject(req.id)}
                    disabled={actionPending === req.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-100 py-2 text-xs font-semibold text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50">
                    <XCircle size={13} /> Одбиј
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-100 pt-1" />
        </div>
      )}

      {/* ── Members section (collapsible) ── */}
      <div>
        {/* Section toggle header */}
        <button
          onClick={() => setMembersOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left transition-colors hover:bg-zinc-50">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-zinc-700">Сите корисници</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
              {profiles.length}
            </span>
          </div>
          {membersOpen ? (
            <ChevronUp size={15} className="text-zinc-400" />
          ) : (
            <ChevronDown size={15} className="text-zinc-400" />
          )}
        </button>

        {membersOpen && (
          <div className="mt-3 space-y-3">
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {(["all", "members", "none"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    filter === f
                      ? "border-zinc-800 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                  )}>
                  {f === "all"
                    ? "Сите"
                    : f === "members"
                      ? "Само членови"
                      : "Без статус"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                placeholder="Пребарај по ime или @username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
              />
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-zinc-400">
                <RefreshCw size={14} className="animate-spin mr-2" /> Се
                вчитува…
              </div>
            ) : shown.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Нема корисници.
              </p>
            ) : (
              <div className="space-y-2">
                {shown.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2.5 hover:bg-zinc-50 transition-colors">
                    {/* Avatar + name → links to the user's profile */}
                    <Link
                      href={`/${p.username ?? p.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3">
                      <AvatarInitials
                        name={p.full_name}
                        avatarUrl={p.avatar_url}
                        size="sm"
                        membershipTier={p.membership_tier as MembershipTier}
                        points={p.points}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-800 hover:underline">
                          {p.full_name ?? "—"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {p.username && (
                            <p className="text-[10px] text-zinc-400">
                              @{p.username}
                            </p>
                          )}
                          <span className="text-[10px] text-zinc-300">·</span>
                          <p className="text-[10px] text-zinc-400">
                            {p.points} аплаузи
                          </p>
                        </div>
                      </div>
                    </Link>
                    {/* Tier select — constrained width */}
                    <div className="w-28 shrink-0 sm:w-36">
                      <TierSelect profile={p} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
