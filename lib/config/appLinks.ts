// Universal Links (iOS) + App Links (Android): which mojprilep.mk URLs open the
// native app when it's installed. Served from /.well-known/* route handlers.
//
// The PATH LIST here must stay in step with the mobile app's
// `ios.associatedDomains` / `android.intentFilters` (app.json) and its path
// mapper (mojprilep-mobile/src/lib/webRoutes.ts). A path claimed here that the
// app can't map lands on the app's home screen instead of the content.
//
// Both hosts (apex + www) must serve these files with a 200 — Apple and Google
// don't follow redirects when fetching them.

/** Apple Developer Team ID (developer.apple.com → Membership details). */
export const APPLE_TEAM_ID = "74269SG4T4";

export const IOS_BUNDLE_ID = "mk.mojprilep.app";
export const ANDROID_PACKAGE = "mojprilep.mk";

/**
 * SHA-256 fingerprints of every key that signs an installed Android build:
 * Play Console → Protected with Play → Play app signing. The app signing key
 * was rotated, so installs are signed with either the current or the previous
 * key — both must be listed. Listing an extra key of ours is harmless; a
 * missing one silently breaks links for the installs signed with it.
 * Format: "AB:CD:…" (uppercase hex, colon-separated).
 */
export const ANDROID_SHA256_FINGERPRINTS: string[] = [
  // App signing key, current (classical)
  "32:EF:5C:B0:57:9A:5D:54:15:CE:4D:B5:53:B5:C9:59:32:B2:43:96:02:28:E4:CF:67:F8:86:7E:3F:2F:93:11",
  // App signing key, previous (installs before the rotation)
  "8B:2F:53:D5:C8:D4:75:8F:72:AB:E5:BC:69:D4:1B:83:F2:45:36:4C:F9:8D:8C:8B:04:02:FD:EA:37:89:58:A6",
  // Upload key (EAS keystore) — signs sideloaded + Huawei APKs
  "E9:3B:6E:7E:D8:37:26:DD:58:CA:26:8F:77:F7:E0:5C:2B:50:53:85:0A:F0:09:BE:4D:E8:70:E5:2B:0B:8D:4B",
];

/** Web paths never handed to the app (screens it doesn't have). Checked first. */
export const APP_LINK_EXCLUDE = [
  "/initiatives/new",
  "/initiatives/preview",
  "/initiatives/*/edit",
  "/initiatives/*/donate",
  "/sport/*/uredi",
];

/** Web paths the app can show. `*` matches any run of characters. */
export const APP_LINK_PATHS = [
  "/issues",
  "/issues/*",
  "/initiatives",
  "/initiatives/*",
  "/events",
  "/events/*",
  "/positive",
  "/positive/*",
  "/projects",
  "/projects/*",
  "/sport",
  "/sport/*",
  "/kindergarten",
  "/kindergarten/*",
  "/utility/*",
  "/prevoz",
  "/zborche",
  "/kino",
  "/taxi",
  "/bus-station",
  "/communities",
  "/recycle",
  "/heroes",
];

/** One AASA-style pattern (`*` = any run of characters) as an anchored regex. */
function patternToRegex(pattern: string): RegExp {
  const body = pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}$`);
}

const EXCLUDE_RE = APP_LINK_EXCLUDE.map(patternToRegex);
const PATHS_RE = APP_LINK_PATHS.map(patternToRegex);

/** Whether the app claims this web path — the same answer iOS/Android reach. */
export function isAppLinkPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (EXCLUDE_RE.some((re) => re.test(path))) return false;
  return PATHS_RE.some((re) => re.test(path));
}
