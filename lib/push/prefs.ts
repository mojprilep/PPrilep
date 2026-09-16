// Per-device notification category preferences.
//
// Devices live in `push_subscriptions`; the `notif_prefs` JSONB column holds a
// map of { <category>: boolean }. A category is ON unless its key is explicitly
// `false`, so a device that never touched the panel (NULL prefs) still receives
// everything. Senders select `expo_token, notif_prefs` and pass the rows here
// to get just the tokens that still want `category`.

export type NotifCategory = "games" | "events" | "sport" | "utility" | "parking";

/** All categories the mobile panel exposes, in display order. */
export const NOTIF_CATEGORIES: NotifCategory[] = [
  "games",
  "events",
  "sport",
  "utility",
  "parking",
];

type SubRow = {
  expo_token?: string | null;
  notif_prefs?: Record<string, unknown> | null;
};

/**
 * True unless this device has explicitly opted out of `category`. Absent/NULL
 * prefs, or an absent key, both mean opted-in — the default for every device
 * registered before preferences existed.
 */
export function wantsCategory(
  prefs: Record<string, unknown> | null | undefined,
  category: NotifCategory,
): boolean {
  return prefs?.[category] !== false;
}

/** The Expo tokens from `rows` that still want `category`. */
export function tokensFor(
  rows: SubRow[] | null | undefined,
  category: NotifCategory,
): string[] {
  return (rows ?? [])
    .filter((r) => wantsCategory(r.notif_prefs, category))
    .map((r) => r.expo_token as string)
    .filter(Boolean);
}
