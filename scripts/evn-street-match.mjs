// ════════════════════════════════════════════════════════════════════════════
//  Fuzzy match between EVN outage address lists and users' profile streets.
//
//  EVN writes  "УЛ.5-ТА ПРИЛЕПСКА,УЛ.НОЖОТ,ДЕЛ ОД УЛ.А.МАКЕДОНСКИ,С.ВИТОЛИШТЕ"
//  Users write "5ta prilepska", "Ул.Манчу Матак", "Aleksandar Makedonski 342a"
//
//  Both sides are reduced to a loose ASCII skeleton (Cyrillic or Latin, with or
//  without diacritics: Ч/Ц/č/c → c, Ш/š/sh → s …), stripped of "ул./бул./бр./
//  дел од" and house numbers, and compared as word sets: every word of the
//  shorter name must appear in the longer one. A one-letter word is an initial
//  ("А.МАКЕДОНСКИ" ↔ "Александар Македонски"). A one-word name only matches a
//  one-word name, so "ПОБЕДА" never hits "Нова Победа".
//
//  Used by ingest-evn-outages.mjs. Kept in scripts/ because the GitHub Action
//  only checks that folder out.
// ════════════════════════════════════════════════════════════════════════════

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "g", е: "e", ж: "z", з: "z", ѕ: "dz",
  и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p",
  р: "r", с: "s", т: "t", ќ: "k", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz",
  ш: "s",
};

const STOP = new Set([
  "ul", "ulica", "bul", "bulevar", "br", "broj", "del", "od", "kej", "s", "selo",
  "nas", "naselba", "mv", "m", "v",
]);

/** Cyrillic or Latin (any diacritics/digraphs) → lowercase ASCII skeleton. */
function skeleton(s) {
  let out = "";
  for (const ch of s.toLowerCase()) out += CYR[ch] ?? ch;
  return out
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // č → c, š → s, ž → z, ć → c, đ → d
    .replace(/dzh|dž/g, "dz")
    .replace(/ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/zh/g, "z")
    .replace(/kj/g, "k")
    .replace(/gj/g, "g")
    .replace(/dj/g, "dz");
}

/**
 * Name → word list. Ordinals ("5-ТА", "11ти", "9-ti") keep their number as a
 * word; any other number is a house number and is dropped.
 */
export function streetWords(name) {
  const s = skeleton(name)
    .replace(/(\d+)\s*-?\s*(ta|ti|vi|mi|ri)(?![a-z])/g, " #$1 ") // ordinal marker
    .replace(/(?<![#\d])(\d+)\s+(?=[a-z])/g, " #$1 "); // "kej 9 septemvri" → ordinal too
  return s
    .split(/[^a-z0-9#]+/)
    .filter(Boolean)
    .filter((w) => !/^\d/.test(w)) // house numbers: 102b, 56, 3a
    .map((w) => (w.startsWith("#") ? w.slice(1) : w))
    .filter((w) => !STOP.has(w));
}

function hasWord(words, w) {
  if (w.length === 1) return words.some((x) => x.startsWith(w)); // initial
  return words.some((x) => x === w || (x.length === 1 && w.startsWith(x)));
}

/** Do two street names (already split with streetWords) name the same street? */
export function sameStreet(a, b) {
  if (!a.length || !b.length) return false;
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  const real = (ws) => ws.filter((w) => w.length > 1).length;
  if (real(small) === 0) return false;
  if (real(small) === 1 && real(big) !== 1) return false;
  return small.every((w) => hasWord(big, w));
}

/** Split an EVN `adresa` into one word list per street/village segment. */
export function evnSegments(adresa) {
  return (adresa || "")
    .split(/[,;]/)
    .map((seg) => ({ label: seg.trim(), words: streetWords(seg) }))
    .filter((s) => s.words.length > 0);
}

/**
 * Users whose profile street matches the outage.
 * @param {{id:string, street_name:string|null}[]} profiles
 * @returns {{id:string, segment:string}[]}
 */
export function matchProfiles(adresa, profiles) {
  const segs = evnSegments(adresa);
  const out = [];
  for (const p of profiles) {
    if (!p.street_name) continue;
    const words = streetWords(p.street_name);
    const hit = segs.find((s) => sameStreet(words, s.words));
    if (hit) out.push({ id: p.id, segment: hit.label });
  }
  return out;
}
