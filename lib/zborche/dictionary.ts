/**
 * ЗборЧе — client-side guess dictionary (web).
 *
 * Fetches the valid-word list for a given length ONCE from /api/zborche/validate,
 * caches it in localStorage, and hands back a Set for instant, offline guess
 * checks. If the list can't be loaded (offline, unknown length), returns null and
 * the caller falls back to length-only validation so play is never blocked.
 */
const MEM = new Map<number, Set<string>>();

const key = (len: number) => `zborche:dict:${len}`;

export async function loadDictionary(len: number): Promise<Set<string> | null> {
  if (!len) return null;
  const cached = MEM.get(len);
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(key(len));
    if (raw) {
      const set = new Set<string>(JSON.parse(raw) as string[]);
      if (set.size) {
        MEM.set(len, set);
        return set;
      }
    }
  } catch {
    // ignore — fall through to network
  }

  try {
    const res = await fetch(`/api/zborche/validate?len=${len}`);
    const data = await res.json();
    const words: string[] = Array.isArray(data?.words) ? data.words : [];
    if (!words.length) return null; // unknown length — don't treat as authoritative
    const set = new Set(words);
    MEM.set(len, set);
    try {
      localStorage.setItem(key(len), JSON.stringify(words));
    } catch {
      // storage full / private mode — the in-memory Set still works this session
    }
    return set;
  } catch {
    return null;
  }
}
