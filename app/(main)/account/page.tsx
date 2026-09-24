"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/ui/Link";
import { useAuth } from "../../../lib/hooks/useAuth";
import { createClient } from "../../../lib/supabase/client";
import { compressImage } from "../../../lib/compressImage";
import { useTurnstile } from "../../../lib/hooks/useTurnstile";
import {
  DISTRICT_LABELS,
  STATUS_LABELS,
  formatDays,
  getIssuePath,
  cdnUrl,
  slugify,
  isReservedUsername,
} from "../../../lib/utils";
import { TIER_CONFIG } from "../../../components/ui/AvatarInitials";
import Button from "../../../components/ui/Button";
import { passwordError } from "../../../lib/auth/password";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import type { Issue } from "../../../lib/types/database";

type HelperActivity = {
  issue_id: number;
  note: string | null;
  issues: Pick<
    Issue,
    "id" | "title" | "district" | "status" | "created_at"
  > | null;
};

type AffectedActivity = {
  issue_id: number;
  issues: Pick<
    Issue,
    "id" | "title" | "district" | "status" | "created_at"
  > | null;
};

type MyInitiative = {
  id: string;
  title: string;
  stage: string;
  district: string | null;
  created_at: string;
};

type ActivityFeedItem = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  tone: "helper" | "affected";
};

type AccountTab = "reports" | "initiatives" | "activity";

const INITIATIVE_STAGE_LABELS: Record<string, string> = {
  idea: "Идеја",
  voting: "Гласање",
  funding: "Финансирање",
  completed: "Завршено",
  rejected: "Одбиено",
};

const LIST_PAGE_SIZE = 7;

// ── Security section component ────────────────────────────────────────────────

function SecuritySection({
  userId,
  userEmail,
  hasPassword,
  supabase,
  onSignOut,
}: {
  userId: string | null;
  userEmail: string | null;
  /** Whether the account already has an email+password identity. */
  hasPassword: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  onSignOut: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "password" | "delete">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Re-auth below uses signInWithPassword, which Supabase gates behind CAPTCHA
  // when armed. Only needed on the `hasPassword` path.
  const captcha = useTurnstile();

  function resetPwForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function changePassword() {
    // Supabase applies its password requirements to updateUser as well as signUp,
    // so this has to match them — a stale "barem 6 znaci" check would wave through
    // a password the server then rejects in English.
    const pwError = passwordError(newPassword);
    if (pwError) { toast.error(pwError); return; }
    if (newPassword !== confirmPassword) { toast.error("Лозинките не се совпаѓаат"); return; }

    setSavingPw(true);

    // Re-authentication for accounts that already have a password — verifies the
    // user knows the current password before allowing a change. Protects against
    // session hijacking on shared/unlocked devices.
    if (hasPassword) {
      if (!currentPassword) { toast.error("Внесете ја тековната лозинка"); setSavingPw(false); return; }
      if (!userEmail) { toast.error("Недостига е-пошта на сметката"); setSavingPw(false); return; }
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
        options: { captchaToken: captcha.token ?? undefined },
      });
      if (reauthError) {
        captcha.reset(); // token is single-use — refresh for the next attempt
        toast.error("Тековната лозинка е неточна");
        setSavingPw(false);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    if (error) { toast.error(error.message); return; }
    toast.success(hasPassword ? "Лозинката е сменета" : "Лозинката е поставена");
    resetPwForm();
    setMode("idle");
  }

  async function deleteAccount() {
    if (!userId) return;
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Грешка" }));
      toast.error(error ?? "Неуспешно бришење");
      setDeleting(false);
      return;
    }
    toast.success("Профилот е избришан");
    onSignOut();
  }

  return (
    <div className="rounded-lg border border-[#e6edf5] p-2.5 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
        Безбедност
      </p>

      {mode === "idle" && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setMode("password")}
            className="w-full rounded-lg border border-[#dce6e2] bg-white px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            🔑 {hasPassword ? "Промени лозинка" : "Постави лозинка"}
          </button>
          <button
            type="button"
            onClick={() => setMode("delete")}
            className="w-full rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
            🗑 Избриши профил
          </button>
        </div>
      )}

      {mode === "password" && (
        <div className="space-y-2">
          {userEmail && (
            <p className="text-[10px] text-slate-400">Сметка: {userEmail}</p>
          )}
          {!hasPassword && (
            <p className="rounded-lg bg-[#eef8f5] px-2.5 py-1.5 text-[10px] text-teal-700 leading-snug">
              Се најавувате преку Google/линк. Поставете лозинка за да можете да се најавувате и со е-пошта.
            </p>
          )}
          {hasPassword && (
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Тековна лозинка"
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#dce6e2] px-2.5 py-2 text-xs outline-none focus:border-primary"
            />
          )}
          {hasPassword && captcha.widget}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Нова лозинка"
            autoComplete="new-password"
            className="w-full rounded-lg border border-[#dce6e2] px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Потврди лозинка"
            autoComplete="new-password"
            className="w-full rounded-lg border border-[#dce6e2] px-2.5 py-2 text-xs outline-none focus:border-primary"
            onKeyDown={(e) => { if (e.key === "Enter") changePassword(); }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode("idle"); resetPwForm(); }}
              className="flex-1 rounded-lg border border-[#dce6e2] bg-white py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Откажи
            </button>
            <button
              type="button"
              onClick={changePassword}
              disabled={savingPw || (hasPassword && !captcha.ready)}
              className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
              {savingPw ? "Се зачувува…" : hasPassword ? "Зачувај" : "Постави"}
            </button>
          </div>
        </div>
      )}

      {mode === "delete" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Ова ќе го избрише вашиот профил засекогаш. Пријавите што ги направивте ќе останат анонимни.
          </p>
          <p className="text-[11px] font-semibold text-slate-600">
            Напишете <span className="font-bold text-red-600">ИЗБРИШИ</span> за да потврдите:
          </p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="w-full rounded-lg border border-red-200 px-2.5 py-2 text-xs outline-none focus:border-red-400"
            placeholder="ИЗБРИШИ"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode("idle"); setDeleteConfirm(""); }}
              className="flex-1 rounded-lg border border-[#dce6e2] bg-white py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Откажи
            </button>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleteConfirm !== "ИЗБРИШИ" || deleting}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors">
              {deleting ? "Се брише…" : "Избриши"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const supabase = useMemo(() => createClient(), []);

  const [username, setUsername] = useState("");
  const [streetName, setStreetName] = useState("");
  const [emailDigest, setEmailDigest] = useState(true);
  const [emailNewsletter, setEmailNewsletter] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sensitiveMenuOpen, setSensitiveMenuOpen] = useState(false);
  const sensitiveMenuRef = useRef<HTMLDivElement>(null);

  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [myInitiatives, setMyInitiatives] = useState<MyInitiative[]>([]);
  const [helperActivity, setHelperActivity] = useState<HelperActivity[]>([]);
  const [affectedActivity, setAffectedActivity] = useState<AffectedActivity[]>(
    [],
  );
  const [activeTab, setActiveTab] = useState<AccountTab>("reports");
  const [primaryDistrict, setPrimaryDistrict] = useState("all");
  const [notificationSettings, setNotificationSettings] = useState({
    issueStatus: true,
    neighborhoodInitiatives: true,
    utilityUrgent: false,
  });
  const [visibleByTab, setVisibleByTab] = useState<Record<AccountTab, number>>({
    reports: LIST_PAGE_SIZE,
    initiatives: LIST_PAGE_SIZE,
    activity: LIST_PAGE_SIZE,
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login?next=/account");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const id = setTimeout(() => {
      setUsername(profile?.username ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setStreetName(profile?.street_name ?? "");
      setEmailDigest(profile?.email_digest !== false); // default true
      setEmailNewsletter(profile?.email_newsletter !== false); // default true (opt-out)
      // District is DB-backed (profiles.district). Always sync from the profile
      // so a refresh restores the saved value (null → "all"/Прилеп).
      setPrimaryDistrict(profile?.district ?? "all");
    }, 0);
    return () => clearTimeout(id);
  }, [profile]);

  // Auto-open edit drawer for new users coming from onboarding redirect
  useEffect(() => {
    if (isWelcome && !loading && user) {
      const id = setTimeout(() => setSensitiveMenuOpen(true), 300);
      return () => clearTimeout(id);
    }
  }, [isWelcome, loading, user]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let mounted = true;

    async function loadProfileData() {
      setLoadingData(true);
      const [issuesRes, initiativesRes, helpersRes, affectedRes] =
        await Promise.all([
          supabase
            .from("issues")
            .select("*")
            .eq("reported_by", userId)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("initiatives")
            .select("id, title, stage, district, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("issue_helpers")
            .select(
              "issue_id, note, issues(id, title, district, status, created_at)",
            )
            .eq("user_id", userId),
          supabase
            .from("issue_affected")
            .select("issue_id, issues(id, title, district, status, created_at)")
            .eq("user_id", userId),
        ]);

      if (!mounted) return;

      if (
        issuesRes.error ||
        helpersRes.error ||
        affectedRes.error ||
        initiativesRes.error
      ) {
        toast.error("Не успеа вчитување на профил активност");
      }

      setMyIssues((issuesRes.data as Issue[] | null) ?? []);
      setMyInitiatives((initiativesRes.data as MyInitiative[] | null) ?? []);
      setHelperActivity((helpersRes.data as HelperActivity[] | null) ?? []);
      setAffectedActivity(
        (affectedRes.data as AffectedActivity[] | null) ?? [],
      );
      setLoadingData(false);
    }

    loadProfileData();

    return () => {
      mounted = false;
    };
  }, [supabase, user]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        sensitiveMenuRef.current &&
        !sensitiveMenuRef.current.contains(e.target as Node)
      ) {
        setSensitiveMenuOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSensitiveMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const settingsKey = `account_notification_settings_${user.id}`;

    const hydrationId = setTimeout(() => {
      const rawSettings = localStorage.getItem(settingsKey);
      if (rawSettings) {
        try {
          setNotificationSettings(JSON.parse(rawSettings));
        } catch {
          // Ignore invalid local setting payload.
        }
      }
    }, 0);

    return () => clearTimeout(hydrationId);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const settingsKey = `account_notification_settings_${user.id}`;
    localStorage.setItem(settingsKey, JSON.stringify(notificationSettings));
  }, [notificationSettings, user]);

  // Let the right panel preview the district live as the dropdown changes.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("account-settings-changed", {
        detail: { primaryDistrict },
      }),
    );
  }, [primaryDistrict]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Избери слика (jpg/png/webp)");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Сликата е преголема (макс 8MB)");
      return;
    }

    setUploadingAvatar(true);
    // Avatars are rendered at ~40px but were stored at full camera resolution
    // and downloaded whole by the mobile app on every feed that shows one.
    const photo = await compressImage(file);
    const ext = photo.name.split(".").pop() ?? "jpg";
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const buckets = ["avatars", "issue-photos"] as const;
    let lastError: string | null = null;

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage
        .from(bucket)
        // Timestamped path → immutable, so cache a year instead of the 1h default.
        .upload(filePath, photo, { contentType: photo.type, cacheControl: "31536000", upsert: true });

      if (error) {
        lastError = error.message;
        continue;
      }

      const publicUrlResult = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      setAvatarUrl(publicUrlResult.data.publicUrl);
      toast.success("Сликата е поставена");
      setUploadingAvatar(false);
      return;
    }

    toast.error(
      lastError
        ? `Неуспешно прикачување: ${lastError}`
        : "Неуспешно прикачување на слика",
    );
    setUploadingAvatar(false);
  }

  async function saveProfile() {
    if (!user) return;

    setSaving(true);

    // Usernames live at the URL root (/<username>), so they must be URL-safe and
    // not collide with route names.
    const safeUsername = username.trim() ? slugify(username) || null : null;
    if (safeUsername && isReservedUsername(safeUsername)) {
      toast.error("Ова корисничко име е резервирано, изберете друго");
      setSaving(false);
      return;
    }

    // The profile row always exists (created by the signup trigger), so use a
    // plain UPDATE — this only touches the user-editable columns that the
    // column-level GRANTs allow. An upsert would include `id` in the SET list
    // and require UPDATE privilege on the primary key.
    const { error } = await supabase
      .from("profiles")
      .update({
        username: safeUsername,
        avatar_url: avatarUrl,
        street_name: streetName.trim() || null,
        district: primaryDistrict === "all" ? null : primaryDistrict,
        email_digest: emailDigest,
        email_newsletter: emailNewsletter,
      })
      .eq("id", user.id);

    if (!error) {
      toast.success("Профилот е зачуван");
      setSaving(false);
      if (isWelcome) router.replace("/account");
      else router.refresh();
      return;
    }

    if (error.code === "23505") {
      toast.error("Ова корисничко име веќе постои");
    } else {
      toast.error(error.message);
    }

    setSaving(false);
  }

  if (loading || (!user && !profile)) {
    return (
      <div className="px-6 py-6 text-sm text-theme-muted">
        Се вчитува профил…
      </div>
    );
  }

  const identityName = profile?.full_name?.trim() || profile?.username || "Мој профил";
  const identityHandle = username?.trim() || profile?.username || "корисник";
  const activityTotal = helperActivity.length + affectedActivity.length;
  const headerTier = profile?.membership_tier
    ? TIER_CONFIG[profile.membership_tier as keyof typeof TIER_CONFIG] ?? null
    : null;
  const headerInitials = (identityName || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const headerDistrict = DISTRICT_LABELS[primaryDistrict] ?? "Прилеп";

  const activityFeedItems: ActivityFeedItem[] = [
    ...helperActivity.map((item) => ({
      key: `helper-${item.issue_id}`,
      href: getIssuePath(
        item.issue_id,
        item.issues?.title ?? `issue-${item.issue_id}`,
      ),
      title: `Помош: ${item.issues?.title ?? `Пријава #${item.issue_id}`}`,
      subtitle: item.note?.trim()
        ? `Порака: ${item.note}`
        : "Се пријавивте како помошник/чка",
      tone: "helper" as const,
    })),
    ...affectedActivity.map((item) => ({
      key: `affected-${item.issue_id}`,
      href: getIssuePath(
        item.issue_id,
        item.issues?.title ?? `issue-${item.issue_id}`,
      ),
      title: `Засегнат/а: ${item.issues?.title ?? `Пријава #${item.issue_id}`}`,
      subtitle: "Означено како засегнат/а",
      tone: "affected" as const,
    })),
  ];

  const visibleReports = myIssues.slice(0, visibleByTab.reports);
  const visibleInitiatives = myInitiatives.slice(0, visibleByTab.initiatives);
  const visibleActivity = activityFeedItems.slice(0, visibleByTab.activity);

  function showMore(tab: AccountTab) {
    setVisibleByTab((prev) => ({ ...prev, [tab]: prev[tab] + LIST_PAGE_SIZE }));
  }

  return (
    <div className="w-full">
      {/* Welcome banner for new users */}
      {isWelcome && (
        <div className="mb-4 rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-teal-800">👋 Добредојдовте во Мој Прилеп!</p>
          <p className="mt-0.5 text-xs text-teal-700">
            Пополнете го вашиот профил — корисничко ime, населба и улица — за да добивате известувања за проблеми во вашето маало.
          </p>
        </div>
      )}
      <section className="pb-3">
        <div className="relative" ref={sensitiveMenuRef}>
          {/* Edit (dots) button — absolute top-right */}
          <button
            type="button"
            onClick={() => setSensitiveMenuOpen((o) => !o)}
            aria-label="Уреди профил"
            aria-expanded={sensitiveMenuOpen}
            className="absolute right-0 top-0 rounded-xl border border-theme bg-white p-2 text-theme-muted transition-colors hover:border-[#cfdad4] hover:text-theme-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9e1e8]">
            <MoreVertical size={16} />
          </button>

          {/* Centered identity */}
          <div className="flex flex-col items-center gap-2.5 pt-2 text-center">
            {/* Big avatar with badge-colored ring + badge overlay */}
            <div className="relative">
              <div
                className="h-28 w-28 overflow-hidden rounded-full"
                style={{
                  padding: "3px",
                  background: headerTier ? headerTier.color : "#dce6e2",
                }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cdnUrl(avatarUrl)}
                    alt="Профил слика"
                    className="h-full w-full rounded-full border-2 border-white object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-2xl font-semibold text-white">
                    {headerInitials}
                  </div>
                )}
              </div>
              {headerTier && (
                <span
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full text-base ring-2 ring-white"
                  style={{ background: headerTier.bg, color: headerTier.color }}
                  title={headerTier.label}>
                  {headerTier.emoji}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-theme-heading">
                {identityName}
              </h1>
              <p className="truncate text-sm text-theme-muted">@{identityHandle}</p>
              <p className="mt-0.5 text-xs text-theme-subtle">
                📍 {headerDistrict}
              </p>
              {user?.email && (
                <p className="mt-0.5 truncate text-xs text-theme-subtle">{user.email}</p>
              )}
            </div>
          </div>

          {sensitiveMenuOpen && (
            <div className="absolute right-0 top-6 z-20 mt-2 max-h-[76vh] w-[min(19rem,88vw)] overflow-y-auto rounded-2xl border border-theme bg-theme-surface p-3 shadow-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-theme-subtle">
                Уреди профил
              </p>

              <div className="mt-2.5 space-y-2.5">
                <div className="flex flex-col items-start gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Профилна слика
                  </label>
                  <label className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#dce6e2] px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                    {uploadingAvatar ? "Се прикачува..." : "Додади слика"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadAvatar(file);
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Корисничко име
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#dce6e2] px-2.5 py-2 text-xs outline-none focus:border-primary"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Улица (опционално)
                  </label>
                  <input
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#dce6e2] px-2.5 py-2 text-xs outline-none focus:border-primary"
                    placeholder="пр. ул. Партизанска"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    За известувања за проблеми на твојата улица
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Примарна населба
                  </label>
                  <select
                    value={primaryDistrict}
                    onChange={(e) => setPrimaryDistrict(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#dce6e2] bg-white px-2.5 py-2 text-xs outline-none focus:border-primary">
                    <option value="all">Прилеп (општо)</option>
                    <option value="Center">Центар</option>
                    <option value="Točila">Точила</option>
                    <option value="Varoš">Варош</option>
                    <option value="Trizla">Тризла</option>
                    <option value="Rid">Рид</option>
                    <option value="Tipski">Типски</option>
                    <option value="Boncejca">Бончејца</option>
                    <option value="KorzoMaalo">Корзо Маало</option>
                  </select>
                </div>

                {/* Security section */}
                <SecuritySection
                  userId={user?.id ?? null}
                  userEmail={user?.email ?? null}
                  hasPassword={Boolean(
                    user?.identities?.some((i) => i.provider === "email"),
                  )}
                  supabase={supabase}
                  onSignOut={signOut}
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSensitiveMenuOpen(false)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-theme-muted hover:text-theme-heading">
                    Затвори
                  </button>
                  <Button
                    onClick={saveProfile}
                    disabled={saving}
                    variant="teal"
                    size="sm">
                    {saving ? "Се зачувува..." : "Зачувај"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-[#e4ece8] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[#edf2f0] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "reports"
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-[#e4ece8] text-theme-muted hover:text-theme-heading"
            }`}>
            Мои пријави ({myIssues.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("initiatives")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "initiatives"
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-[#e4ece8] text-theme-muted hover:text-theme-heading"
            }`}>
            Иницијативи ({myInitiatives.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-[#e4ece8] text-theme-muted hover:text-theme-heading"
            }`}>
            Моја активност ({activityTotal})
          </button>
        </div>

        <div className="max-h-112 overflow-y-auto pr-1.5">
        {loadingData ? (
          <p className="text-sm text-slate-500">Се вчитуваат податоци…</p>
        ) : activeTab === "reports" ? (
          myIssues.length === 0 ? (
            <p className="text-sm text-slate-500">Сè уште немаш пријави.</p>
          ) : (
            <div className="space-y-2">
              {visibleReports.map((issue) => (
                <Link
                  key={issue.id}
                  href={getIssuePath(issue.id, issue.title)}
                  className="block rounded-2xl border border-[#e4ece8] px-3 py-2 hover:border-[#cfe0da]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {issue.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDays(issue.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {DISTRICT_LABELS[issue.district] ?? issue.district} •{" "}
                    {STATUS_LABELS[issue.status] ?? issue.status}
                  </p>
                </Link>
              ))}

              {myIssues.length > visibleReports.length && (
                <button
                  type="button"
                  onClick={() => showMore("reports")}
                  className="w-full rounded-xl border border-[#dce6e2] bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50">
                  Види повеќе
                </button>
              )}
            </div>
          )
        ) : activeTab === "initiatives" ? (
          myInitiatives.length === 0 ? (
            <p className="text-sm text-slate-500">Сè уште немаш иницијативи.</p>
          ) : (
            <div className="space-y-2">
              {visibleInitiatives.map((initiative) => (
                <div
                  key={initiative.id}
                  className="rounded-2xl border border-[#e4ece8] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {initiative.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDays(initiative.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {INITIATIVE_STAGE_LABELS[initiative.stage] ??
                      initiative.stage}
                    {initiative.district
                      ? ` • ${DISTRICT_LABELS[initiative.district] ?? initiative.district}`
                      : ""}
                  </p>
                </div>
              ))}

              {myInitiatives.length > visibleInitiatives.length && (
                <button
                  type="button"
                  onClick={() => showMore("initiatives")}
                  className="w-full rounded-xl border border-[#dce6e2] bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50">
                  Види повеќе
                </button>
              )}
            </div>
          )
        ) : activityTotal === 0 ? (
          <p className="text-sm text-slate-500">Сè уште немаш активности.</p>
        ) : (
          <div className="space-y-2">
            {visibleActivity.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`block rounded-2xl border px-3 py-2 ${
                  item.tone === "helper"
                    ? "border-[#d9f0e9] hover:border-[#bfe3db]"
                    : "border-[#e3e8f3] hover:border-[#cfd7ea]"
                }`}>
                <p className="text-sm font-semibold text-slate-800">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
              </Link>
            ))}

            {activityFeedItems.length > visibleActivity.length && (
              <button
                type="button"
                onClick={() => showMore("activity")}
                className="w-full rounded-xl border border-[#dce6e2] bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50">
                Види повеќе
              </button>
            )}
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
