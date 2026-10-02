import type { District, Category } from "./types/database";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDays(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (diff === 0) return "денес";
  if (diff === 1) return "пред 1 ден";
  return `пред ${diff} дена`;
}

export function dayCount(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export function districtColor(district: District | string): string {
  const map: Record<string, string> = {
    Center: "bg-zinc-900 text-white",
    Varoš: "bg-zinc-700 text-white",
    Trizla: "bg-zinc-600 text-white",
    Točila: "bg-zinc-500 text-white",
    Rid: "bg-zinc-400 text-black",
    Tipski: "bg-zinc-300 text-black",
    Boncejca: "bg-zinc-200 text-black",
    KorzoMaalo: "bg-teal-700 text-white",
    MarinoMaalo: "bg-teal-600 text-white",
    Cacorica: "bg-teal-500 text-white",
  };
  return map[district] ?? "bg-zinc-200 text-black";
}

export const DISTRICT_LABELS: Record<string, string> = {
  all: "Прилеп",
  Center: "Центар",
  Varoš: "Варош",
  Trizla: "Тризла",
  Točila: "Точила",
  Rid: "Рид",
  Tipski: "Типски",
  Boncejca: "Бончејца",
  KorzoMaalo: "Корзо Маало",
  MarinoMaalo: "Марино Маало",
  Cacorica: "Чачорица",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  road: "Патишта",
  water: "Вода",
  power: "Осветлување",
  garbage: "Ѓубре",
  park: "Парк",
  negligent: "Несовесни граѓани",
  transport: "Градски превоз",
  parking: "Паркинзи",
  vehicles: "Хаварисани возила",
  polluters: "Загадувачи",
  traffic_lights: "Семафори",
  traffic_signs: "Сообраќајни знаци",
  admin: "Јавна Администрација",
  other: "Друго",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Пријавено",
  acknowledged: "Видено",
  progress: "Се работи",
  pending: "На чекање",
  resolved: "Решено",
};

export function categoryLabel(cat: Category): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

export function categoryIcon(cat: Category): string {
  const map: Record<Category, string> = {
    road: "🚧",
    water: "💧",
    power: "💡",
    garbage: "🗑️",
    park: "🌳",
    negligent: "🤦",
    transport: "🚌",
    parking: "🅿️",
    vehicles: "🚗",
    polluters: "🏭",
    traffic_lights: "🚦",
    traffic_signs: "🚸",
    admin: "🏛️",
    other: "📋",
  };
  return map[cat] ?? "📋";
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ѓ: "gj",
  е: "e",
  ж: "zh",
  з: "z",
  ѕ: "dz",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ќ: "kj",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  џ: "dj",
  ш: "sh",
};

function transliterateToLatin(text: string): string {
  return text
    .split("")
    .map((char) => {
      const mapped = CYRILLIC_TO_LATIN[char.toLowerCase()];
      return mapped ?? char;
    })
    .join("");
}

const MK_MONTHS_SHORT = [
  "јан", "фев", "мар", "апр", "мај", "јун",
  "јул", "авг", "сеп", "окт", "ное", "дек",
];

/**
 * Deterministic Macedonian short date — "3 јун 2026".
 *
 * Uses a fixed month table + UTC getters so the server (Node, often without
 * the mk-MK ICU locale) and the browser produce identical output, avoiding
 * React hydration mismatches.
 */
export function formatMkDate(iso: string, withYear = true): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.getUTCDate();
  const mon = MK_MONTHS_SHORT[d.getUTCMonth()];
  return withYear ? `${day} ${mon} ${d.getUTCFullYear()}` : `${day} ${mon}`;
}

export function slugify(text: string): string {
  return transliterateToLatin(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getIssuePath(id: number, title: string): string {
  const titleSlug = slugify(title);
  const slugPart = titleSlug || "issue";
  return `/issues/${slugPart}-${id}`;
}

export function parseIssueIdFromSegment(segment: string): number | null {
  if (/^\d+$/.test(segment)) return Number(segment);
  const match = segment.match(/-(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
}

// ── Public user profile paths (root-level: /username) ────────────────────────
//
// Profiles live at the URL root (e.g. /lukasmario19) — no /u/ prefix. That means
// a username may never equal a real top-level route segment, so we reserve them.
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // app/(main) routes
  "about", "account", "agency", "bus-station", "communities", "data-deletion",
  "events", "fund", "heroes", "ideas", "info", "initiatives", "issues",
  "kindergarten", "kino", "positive", "prevoz", "privacy", "projects",
  "recycle", "sponsors", "support", "taxi", "utility",
  // top-level app routes / system
  "admin", "api", "auth", "gradinka", "map", "studio", "u",
  // common reserved words to keep free for the future
  "login", "register", "settings", "help", "terms", "contact", "home", "new",
]);

/** True when a username collides with a route segment and must be rejected. */
export function isReservedUsername(name: string): boolean {
  return RESERVED_USERNAMES.has(name.trim().toLowerCase());
}

/**
 * URL for a public profile. Prefers the username, falls back to the user id.
 * Always URL-encoded so legacy usernames containing spaces still resolve.
 */
export function userPath(
  username?: string | null,
  id?: string | null,
): string {
  const slug = (username && username.trim()) || id || "";
  return `/${encodeURIComponent(slug)}`;
}

// Rewrites a Supabase storage URL to go through an image CDN in front of Storage.
//
// Two tiers, in priority order:
//   1. ImageKit (env: NEXT_PUBLIC_IMAGEKIT_URL, e.g. "https://ik.imagekit.io/xxxx")
//      — a web-proxy origin pointed at our Supabase Storage public base. It pulls
//      each original from Supabase ONCE, then caches + resizes on its own
//      bandwidth, so Supabase cached egress drops toward zero. Also unlocks
//      per-view resizing (`w`), which Supabase Free denies. Only `object/public`
//      URLs are routed here (signed URLs carry an expiring token we must not strip).
//   2. Cloudflare (env: NEXT_PUBLIC_CDN_HOST, e.g. "cdn.mojprilep.mk") — the
//      original proxy; still the fallback and still used for signed URLs.
//
// Both fall back to the untouched URL when their env var is unset, so this is
// safe to deploy before either is live.
const CDN_HOST = process.env.NEXT_PUBLIC_CDN_HOST;
const IMAGEKIT_URL = process.env.NEXT_PUBLIC_IMAGEKIT_URL;
const SUPABASE_STORAGE_RE =
  /https:\/\/[a-z0-9]+\.supabase\.co(\/storage\/v1\/object\/(?:public|sign)\/[^?#]+)/;
// Captures just the bucket+path after `/object/public/` — that's what ImageKit's
// origin base URL is mapped to, so the proxied path is simply `<IMAGEKIT_URL>/<1>`.
const SUPABASE_PUBLIC_RE =
  /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/([^?#]+)/;

export function cdnUrl(
  url: string | null | undefined,
  opts?: { w?: number },
): string {
  if (!url) return "";
  if (IMAGEKIT_URL) {
    const m = url.match(SUPABASE_PUBLIC_RE);
    if (m) {
      const tr = ["f-auto", "q-80"];
      if (opts?.w) tr.push(`w-${opts.w}`);
      return `${IMAGEKIT_URL}/${m[1]}?tr=${tr.join(",")}`;
    }
    // Not a public Storage URL (Sanity/Google/signed/data:) — fall through.
  }
  if (!CDN_HOST) return url;
  return url.replace(SUPABASE_STORAGE_RE, `https://${CDN_HOST}$1`);
}

/**
 * Extracts the object path *inside* a Supabase Storage bucket from a stored
 * public/sign URL — e.g.
 *   https://x.supabase.co/storage/v1/object/public/issue-photos/comments/42/a.jpg
 *   → "comments/42/a.jpg"
 * Returns null if the URL doesn't point at the given bucket. Used to remove the
 * underlying file when its row is deleted (Storage has no DB cascade).
 */
export function bucketObjectPath(
  url: string | null | undefined,
  bucket: string,
): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const signed = `/object/sign/${bucket}/`;
  const idx =
    url.indexOf(marker) >= 0
      ? url.indexOf(marker) + marker.length
      : url.indexOf(signed) >= 0
        ? url.indexOf(signed) + signed.length
        : -1;
  if (idx < 0) return null;
  const path = url.slice(idx).split(/[?#]/)[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
