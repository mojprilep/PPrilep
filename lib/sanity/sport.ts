/**
 * GROQ queries, types and label tables for Спорт и Рекреација.
 *
 * Shared by the web pages, the submission API route and (via the same field
 * names) the mobile screens — the label tables live here so a club typed as
 * "gym" reads "Фитнес центар" everywhere, and a value renamed in the schema
 * breaks in exactly one place.
 *
 * Unpublished submissions are invisible to this client: it holds no token, and
 * every query filters `isSubmission != true || reviewed == true` anyway, so a
 * draft can never leak onto the site even if one is published by accident.
 */

import { sanityClient } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SanityImageRef = { asset: { _ref: string } } | null;

export type TrainingSlot = {
  group: string;
  /** JS getDay() values as strings — "1" = Monday, "0" = Sunday. */
  days: string[];
  startTime: string;
  endTime: string | null;
  venue: string | null;
};

export type PriceItem = {
  label: string;
  price: number;
  period: "month" | "year" | "session" | "once";
  note: string | null;
};

export type Coach = {
  name: string;
  role: string | null;
  photo: SanityImageRef;
};

export type SportClub = {
  _id: string;
  name: string;
  slug: string;
  kind: string;
  sports: string[];
  logo: SanityImageRef;
  coverImage: SanityImageRef;
  foundedYear: number | null;
  shortDescription: string | null;
  about: string | null;
  ageGroups: string[];
  gender: string | null;
  level: string[];
  schedule: TrainingSlot[];
  pricing: PriceItem[];
  freeTrial: boolean;
  acceptingMembers: boolean;
  howToJoin: string | null;
  joinUrl: string | null;
  venue: string | null;
  address: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  coaches: Coach[];
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  updatedAt: string | null;
  verified: boolean;
};

/** The listing needs a fraction of the fields; the card renders from these. */
export type SportClubCard = Pick<
  SportClub,
  | "_id" | "name" | "slug" | "kind" | "sports" | "logo" | "shortDescription"
  | "ageGroups" | "district" | "acceptingMembers" | "freeTrial" | "verified"
>;

// ── Labels ────────────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<string, string> = {
  club: "Спортски клуб",
  federation: "Сојуз",
  gym: "Фитнес центар",
  centre: "Спортски центар",
  school: "Школа",
  recreation: "Рекреативна група",
};

export const AGE_LABEL: Record<string, string> = {
  "4-6": "Предучилишна (4–6)",
  "7-11": "Деца (7–11)",
  "12-15": "Кадети (12–15)",
  "16-18": "Јуниори (16–18)",
  "18+": "Сениори (18+)",
  recreation: "Рекреативци",
  veterans: "Ветерани",
};

export const GENDER_LABEL: Record<string, string> = {
  mixed: "Мешано",
  male: "Машки",
  female: "Женски",
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: "Почетници",
  advanced: "Напредни",
  competitive: "Натпреварувачки",
  recreational: "Рекреативно",
};

export const PERIOD_LABEL: Record<string, string> = {
  month: "месечно",
  year: "годишно",
  session: "по термин",
  once: "еднократно",
};

/** Indexed by JS getDay(), so Sunday first — same convention as busStation.ts. */
export const DAY_SHORT = ["Нед", "Пон", "Вто", "Сре", "Чет", "Пет", "Саб"];

/**
 * "Пон, Сре, Пет" — always in week order regardless of the order they were
 * ticked, and with Sunday last rather than first, because a reader scanning a
 * training schedule reads the week the way it is lived, not the way `getDay()`
 * numbers it.
 */
export function formatDays(days: string[]): string {
  const weekOrder = (d: string) => (d === "0" ? 7 : Number(d));
  return [...days]
    .sort((a, b) => weekOrder(a) - weekOrder(b))
    .map((d) => DAY_SHORT[Number(d)] ?? d)
    .join(", ");
}

/** "18:00 – 19:30", or just "18:00" when the club left the end time blank. */
export function formatSlotTime(slot: TrainingSlot): string {
  return slot.endTime ? `${slot.startTime} – ${slot.endTime}` : slot.startTime;
}

// ── GROQ ──────────────────────────────────────────────────────────────────────

/**
 * A submission that has not been reviewed never renders, even if it somehow
 * got published — the review flag is the gate, not the publish button alone.
 */
const PUBLIC = `_type == "sportClub" && (isSubmission != true || reviewed == true)`;

const CARD_FIELDS = `
  _id, name, "slug": slug.current, kind, sports, logo{ asset },
  shortDescription, ageGroups, district, verified,
  "acceptingMembers": coalesce(acceptingMembers, true),
  "freeTrial": coalesce(freeTrial, false)
`;

const FULL_FIELDS = `
  ${CARD_FIELDS},
  coverImage{ asset }, foundedYear, about, gender, level,
  schedule[]{ group, days, startTime, endTime, venue },
  pricing[]{ label, price, period, note },
  coaches[]{ name, role, photo{ asset } },
  howToJoin, joinUrl, venue, address, lat, lng,
  phone, email, website, facebook, instagram, tiktok, youtube,
  updatedAt
`;

/**
 * Clubs still taking members come first: a profile you can act on today is
 * worth more than one you cannot, and alphabetical order inside each half
 * keeps the list predictable.
 */
const CLUBS_QUERY = `
  *[${PUBLIC}] | order(coalesce(acceptingMembers, true) desc, name asc) {
    ${CARD_FIELDS}
  }
`;

const CLUB_BY_SLUG_QUERY = `
  *[${PUBLIC} && slug.current == $slug][0] { ${FULL_FIELDS} }
`;

const CLUB_SLUGS_QUERY = `*[${PUBLIC}].slug.current`;

// ── Fetchers ──────────────────────────────────────────────────────────────────

// Fallback ISR interval — the webhook at /api/revalidate purges the "sport" tag
// instantly on publish; this 24 h floor keeps pages fresh if the webhook misses.
const REVALIDATE_CONTENT = 86_400;
const SPORT_CACHE = { next: { revalidate: REVALIDATE_CONTENT, tags: ["sport"] } };

export async function fetchSportClubs(): Promise<SportClubCard[]> {
  return (await sanityClient.fetch<SportClubCard[]>(CLUBS_QUERY, {}, SPORT_CACHE)) ?? [];
}

export async function fetchSportClub(slug: string): Promise<SportClub | null> {
  if (!slug.trim()) return null;
  return await sanityClient.fetch<SportClub | null>(CLUB_BY_SLUG_QUERY, { slug }, SPORT_CACHE);
}

export async function fetchSportClubSlugs(): Promise<string[]> {
  const slugs = await sanityClient.fetch<(string | null)[]>(CLUB_SLUGS_QUERY, {}, SPORT_CACHE);
  return (slugs ?? []).filter((s): s is string => Boolean(s));
}

/**
 * Every sport named by at least one club, deduplicated and sorted — the filter
 * chips are built from the data rather than from a fixed list, so a club that
 * brings a sport nobody else offers is filterable the moment it is published.
 */
export function sportsIn(clubs: SportClubCard[]): string[] {
  const seen = new Set<string>();
  for (const club of clubs) {
    for (const sport of club.sports ?? []) seen.add(sport.trim().toLocaleLowerCase("mk"));
  }
  return [...seen].filter(Boolean).sort((a, b) => a.localeCompare(b, "mk"));
}

// ── Новости од клубовите ──────────────────────────────────────────────────────

export type SportNewsItem = {
  _id: string;
  title: string;
  body: string | null;
  image: SanityImageRef;
  link: string | null;
  publishedAt: string;
  pinned: boolean;
  club: { name: string; slug: string } | null;
};

/**
 * The same two gates as the clubs: unreviewed submissions stay invisible, and a
 * post whose club was later unpublished disappears with it (`club->` resolves
 * to null and the item is dropped by `defined(club)`).
 */
const NEWS_PUBLIC = `
  _type == "sportPost" && (isSubmission != true || reviewed == true)
  && defined(club) && publishedAt <= now()
`;

const NEWS_FIELDS = `
  _id, title, body, image{ asset }, link, publishedAt,
  "pinned": coalesce(pinned, false),
  "club": club->{ name, "slug": slug.current }
`;

const NEWS_QUERY = `
  *[${NEWS_PUBLIC}] | order(publishedAt desc) [0...$limit] { ${NEWS_FIELDS} }
`;

const CLUB_NEWS_QUERY = `
  *[${NEWS_PUBLIC} && club->slug.current == $slug]
    | order(coalesce(pinned, false) desc, publishedAt desc) [0...$limit] { ${NEWS_FIELDS} }
`;

/** The latest announcements across every club — the right panel's news block. */
export async function fetchSportNews(limit = 6): Promise<SportNewsItem[]> {
  return (await sanityClient.fetch<SportNewsItem[]>(NEWS_QUERY, { limit }, SPORT_CACHE)) ?? [];
}

/** One club's announcements, pinned first — shown on its profile. */
export async function fetchClubNews(slug: string, limit = 8): Promise<SportNewsItem[]> {
  if (!slug.trim()) return [];
  return (
    (await sanityClient.fetch<SportNewsItem[]>(CLUB_NEWS_QUERY, { slug, limit }, SPORT_CACHE)) ?? []
  );
}

export type SportPostFresh = {
  _id: string;
  title: string;
  publishedAt: string | null;
  clubSlug: string | null;
  clubName: string | null;
};

/**
 * One post read straight from the API with no cache — the follower push needs
 * the just-published row, and an ISR-cached read could still be the pre-publish
 * emptiness. Mirrors fetchEventFresh. Returns the post plus its club's slug and
 * name so the broadcaster can address followers and label the notification.
 */
export async function fetchSportPostFresh(id: string): Promise<SportPostFresh | null> {
  if (!id.trim()) return null;
  return await sanityClient.fetch<SportPostFresh | null>(
    `*[_type == "sportPost" && _id == $id][0]{
      _id, title, publishedAt,
      "clubSlug": club->slug.current,
      "clubName": club->name
    }`,
    { id },
    { cache: "no-store" },
  );
}

/**
 * One club read straight from the API with no cache — the "club approved" push
 * needs the just-published row (an ISR read could still be the pre-publish
 * emptiness), and it must see the submitter even on a doc that is still flagged
 * as a submission. Returns only what the broadcaster needs to address and label
 * the owner's notification.
 */
export interface SportClubFresh {
  _id: string;
  name: string | null;
  slug: string | null;
  ownerUserId: string | null;
}

export async function fetchSportClubFresh(id: string): Promise<SportClubFresh | null> {
  if (!id.trim()) return null;
  return await sanityClient.fetch<SportClubFresh | null>(
    `*[_type == "sportClub" && _id == $id][0]{
      _id, name,
      "slug": slug.current,
      "ownerUserId": submittedBy.userId
    }`,
    { id },
    { cache: "no-store" },
  );
}

// ── Денешниот распоред ────────────────────────────────────────────────────────

export type DaySlot = TrainingSlot & { club: string; clubSlug: string };

const SCHEDULE_QUERY = `
  *[${PUBLIC} && count(schedule) > 0] {
    name, "slug": slug.current,
    schedule[]{ group, days, startTime, endTime, venue }
  }
`;

/**
 * Every training happening on `day` (JS getDay(), 0 = Sunday), flattened across
 * all clubs and sorted by start time.
 *
 * The filtering happens here rather than in GROQ on purpose: "today" depends on
 * the reader's date in Europe/Skopje, and a query that bakes a weekday into the
 * string would be cached by the CDN with yesterday's answer.
 */
export async function fetchDaySchedule(day: number): Promise<DaySlot[]> {
  const clubs =
    (await sanityClient.fetch<
      { name: string; slug: string | null; schedule: TrainingSlot[] }[]
    >(SCHEDULE_QUERY, {}, SPORT_CACHE)) ?? [];

  const slots: DaySlot[] = [];
  for (const club of clubs) {
    if (!club.slug) continue;
    for (const slot of club.schedule ?? []) {
      if (!(slot.days ?? []).includes(String(day))) continue;
      slots.push({ ...slot, club: club.name, clubSlug: club.slug });
    }
  }
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ── Лига (Распоред) ─────────────────────────────────────────────────────────

export type LeagueMatch = {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type LeagueRound = {
  number: number;
  date: string; // ISO date
  dateLabel: string | null;
  matches: LeagueMatch[];
};

export type LeagueSport = "football" | "handball";

export type SportLeague = {
  _id: string;
  title: string;
  season: string | null;
  part: string | null;
  sport: LeagueSport;
  /** Team name to highlight (exactly as written in the matches), if any. */
  ourTeam: string | null;
  rounds: LeagueRound[];
};

/** Points for a win — football 3, handball 2. A draw is 1 in both. */
export function winPointsFor(sport: LeagueSport): number {
  return sport === "handball" ? 2 : 3;
}

// Leagues written before the `sport` field existed are football.
const LEAGUE_QUERY = `
  *[_type == "sportLeague" && active == true && coalesce(sport, "football") == $sport]
    | order(_updatedAt desc)[0]{
    _id, title, season, part, "sport": coalesce(sport, "football"), ourTeam,
    rounds[]{
      number, date, dateLabel,
      matches[]{ home, away, homeScore, awayScore }
    }
  }
`;

/** The active league for a sport, rounds sorted by round number. */
export async function fetchActiveLeague(sport: LeagueSport = "football"): Promise<SportLeague | null> {
  const league = await sanityClient.fetch<SportLeague | null>(LEAGUE_QUERY, { sport }, SPORT_CACHE);
  if (!league) return null;
  const rounds = [...(league.rounds ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return { ...league, rounds };
}

/** A match is played once BOTH scores are filled in. */
export function isMatchPlayed(m: LeagueMatch): boolean {
  return typeof m.homeScore === "number" && typeof m.awayScore === "number";
}

/** A round is played when it has matches and every one of them has a result. */
export function isRoundPlayed(r: LeagueRound): boolean {
  const matches = r.matches ?? [];
  return matches.length > 0 && matches.every(isMatchPlayed);
}

/**
 * The index of the round to feature — the first one not yet fully played, else
 * the last round if the whole schedule is done. Returns -1 for an empty league.
 */
export function nextRoundIndex(rounds: LeagueRound[]): number {
  if (rounds.length === 0) return -1;
  const idx = rounds.findIndex((r) => !isRoundPlayed(r));
  return idx === -1 ? rounds.length - 1 : idx;
}

// ── Таблица (standings, computed from results) ───────────────────────────────

export type StandingRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Oldest → newest, one per played match. */
  form: FormEntry[];
};

/** One played match from a team's point of view, for the form strip. */
export type FormEntry = {
  result: "W" | "D" | "L";
  round: number | null;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
};

/**
 * League table built purely from played matches (both scores filled). Win =
 * `winPoints` (3 football, 2 handball), draw = 1. Every team that appears in
 * any fixture gets a row, so the table is complete from round 1 even before a
 * club has kicked a ball. Sorted the usual
 * way: points, then goal difference, then goals scored, then name.
 */
export function computeStandings(rounds: LeagueRound[], winPoints = 3): StandingRow[] {
  const table = new Map<string, StandingRow>();
  const row = (team: string): StandingRow => {
    let r = table.get(team);
    if (!r) {
      r = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        form: [],
      };
      table.set(team, r);
    }
    return r;
  };

  for (const round of rounds) {
    for (const m of round.matches ?? []) {
      // Register both teams even for an unplayed fixture, so the table is full.
      const home = row(m.home);
      const away = row(m.away);
      if (!isMatchPlayed(m)) continue;
      const hs = m.homeScore as number;
      const as = m.awayScore as number;

      home.played++;
      away.played++;
      home.goalsFor += hs;
      home.goalsAgainst += as;
      away.goalsFor += as;
      away.goalsAgainst += hs;

      const entry = (result: FormEntry["result"]): FormEntry => ({
        result,
        round: round.number ?? null,
        home: m.home,
        away: m.away,
        homeScore: hs,
        awayScore: as,
      });
      if (hs > as) {
        home.won++; home.points += winPoints; home.form.push(entry("W"));
        away.lost++; away.form.push(entry("L"));
      } else if (hs < as) {
        away.won++; away.points += winPoints; away.form.push(entry("W"));
        home.lost++; home.form.push(entry("L"));
      } else {
        home.drawn++; home.points++; home.form.push(entry("D"));
        away.drawn++; away.points++; away.form.push(entry("D"));
      }
    }
  }

  for (const r of table.values()) r.goalDiff = r.goalsFor - r.goalsAgainst;

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team, "mk"),
  );
}

/** The weekday in Prilep right now, as a JS getDay() value. */
export function todayInPrilep(): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Skopje",
    weekday: "short",
  }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
