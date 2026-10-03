/**
 * ЗборЧе — client-side guess dictionary (web).
 *
 * Fetches the valid-word list for a given length from /api/zborche/validate,
 * caches it in localStorage, and hands back a Set for instant, offline guess
 * checks. The cache is refreshed every few days so words added to the server
 * list (extra.json) reach returning players. If the list can't be loaded
 * (offline, unknown length), returns null and the caller falls back to
 * length-only validation so play is never blocked.
 */
const MEM = new Map<number, Set<string>>();

// v2: older caches (no timestamp) predate extra.json and are ignored.
const key = (len: number) => `zborche:dict:v2:${len}`;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type Cached = { at: number; words: string[] };

export async function loadDictionary(len: number): Promise<Set<string> | null> {
  if (!len) return null;
  const hit = MEM.get(len);
  if (hit) return hit;

  let stale: Set<string> | null = null;
  try {
    const raw = localStorage.getItem(key(len));
    if (raw) {
      const c = JSON.parse(raw) as Cached;
      if (Array.isArray(c?.words) && c.words.length) {
        const set = new Set<string>(c.words);
        if (Date.now() - (c.at ?? 0) < MAX_AGE_MS) {
          MEM.set(len, set);
          return set;
        }
        stale = set; // too old — try the network, fall back to this
      }
    }
  } catch {
    // ignore — fall through to network
  }

  try {
    const res = await fetch(`/api/zborche/validate?len=${len}`);
    const data = await res.json();
    const words: string[] = Array.isArray(data?.words) ? data.words : [];
    if (!words.length) return stale; // unknown length — don't treat as authoritative
    const set = new Set(words);
    MEM.set(len, set);
    try {
      localStorage.removeItem(`zborche:dict:${len}`); // pre-v2 copy
      localStorage.setItem(key(len), JSON.stringify({ at: Date.now(), words } satisfies Cached));
    } catch {
      // storage full / private mode — the in-memory Set still works this session
    }
    return set;
  } catch {
    if (stale) MEM.set(len, stale);
    return stale;
  }
}
