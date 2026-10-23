/**
 * КвизЧе — the weekly themed history quiz. Pure helpers shared by the API
 * routes, the admin and the web page (no server or browser APIs in here).
 *
 * The rules (see supabase/add_kvizche.sql for the data):
 *  - one theme per week, Mon–Sun, ONE question per day;
 *  - harder each day: Mon 2 options · Tue 2 · Wed 3 · Thu 4 · Fri 5 · Sat 5,
 *    Sunday is a timeline — put the events in order, all or nothing;
 *  - a right answer is worth `day × 100` points, plus up to 50% more for speed,
 *    the bonus shrinking to nothing at SPEED_WINDOW_MS; a wrong answer is 0.
 */

export type QuestionKind = "choice" | "timeline";

export type KvizcheWeek = {
  id: number;
  week_start: string; // YYYY-MM-DD, a Monday
  theme: string;
  intro: string | null;
  cover_url: string | null;
  published: boolean;
};

export type KvizcheQuestion = {
  id: number;
  week_id: number;
  day: number; // 1 = Monday … 7 = Sunday
  kind: QuestionKind;
  prompt: string;
  options: string[]; // timeline: in the CORRECT order
  correct_index: number | null;
  explanation: string | null;
  image_url: string | null;
};

/** What a player gets after answering (or when reopening an answered day). */
export type KvizcheResult = {
  questionId: number;
  day: number;
  kind: QuestionKind;
  prompt: string;
  /** As shown to the player (a timeline's shuffled order). */
  options: string[];
  /** choice: the option index picked · timeline: the order submitted, as indexes into `options`. */
  answer: number | number[];
  correct: boolean;
  /** choice: the right option index · timeline: the right order, as indexes into `options`. */
  solution: number | number[];
  explanation: string | null;
  imageUrl: string | null;
  timeMs: number;
  points: number;
};

export const DAY_NAMES = ["Понеделник", "Вторник", "Среда", "Четврток", "Петок", "Сабота", "Недела"];

/** How many answer options each weekday's question has (Sunday = timeline). */
export const OPTIONS_BY_DAY = [2, 2, 3, 4, 5, 5, 0];

/** Timeline length bounds. */
export const TIMELINE_MIN = 4;
export const TIMELINE_MAX = 5;

/** The speed bonus fades to zero over this long. */
export const SPEED_WINDOW_MS: Record<QuestionKind, number> = { choice: 60_000, timeline: 120_000 };

/** The client's own stopwatch is trusted only up to this much below the server's (network lag). */
export const LATENCY_ALLOWANCE_MS = 3_000;

export function pointsFor(day: number, kind: QuestionKind, correct: boolean, timeMs: number): number {
  if (!correct) return 0;
  const speed = Math.max(0, 1 - timeMs / SPEED_WINDOW_MS[kind]);
  return Math.round(day * 100 * (1 + 0.5 * speed));
}

/**
 * The time that counts. The server measures from handing out the question to
 * receiving the answer, which includes both network trips; the app measures from
 * the question appearing on screen to the tap. Take the client's figure only
 * when it is plausible — no higher than the server's and at most
 * LATENCY_ALLOWANCE_MS lower — otherwise the server's.
 */
export function countedTime(serverMs: number, clientMs: number | null): number {
  const server = Math.max(0, Math.round(serverMs));
  if (clientMs == null || !Number.isFinite(clientMs)) return server;
  const client = Math.round(clientMs);
  return client <= server && client >= server - LATENCY_ALLOWANCE_MS ? Math.max(0, client) : server;
}

/** ISO weekday 1 (Mon) … 7 (Sun) of a YYYY-MM-DD date. */
export function isoDay(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The Monday (YYYY-MM-DD) of the week containing `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (isoDay(date) - 1));
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD plus n days. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The order a timeline's events are shown in: `order[k]` is the stored (correct)
 * index of the event shown k-th. Deterministic per question so the server can
 * map a submitted order back without remembering what it handed out, and never
 * the identity (which would show the answer).
 */
export function timelineOrder(questionId: number, n: number): number[] {
  let seed = (questionId * 2654435761) >>> 0 || 1;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

/** The options as the player sees them. */
export function shownOptions(q: Pick<KvizcheQuestion, "id" | "kind" | "options">): string[] {
  if (q.kind !== "timeline") return q.options;
  return timelineOrder(q.id, q.options.length).map((i) => q.options[i]);
}

/**
 * Check an answer given in SHOWN positions. Returns null when it is malformed.
 * For a timeline, `answer` lists shown positions earliest-first.
 */
export function checkAnswer(
  q: Pick<KvizcheQuestion, "id" | "kind" | "options" | "correct_index">,
  answer: unknown,
): { correct: boolean; answer: number | number[] } | null {
  const n = q.options.length;
  if (q.kind === "choice") {
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= n) return null;
    return { correct: answer === q.correct_index, answer };
  }
  if (!Array.isArray(answer) || answer.length !== n) return null;
  const picked = answer.map(Number);
  if (picked.some((v) => !Number.isInteger(v) || v < 0 || v >= n) || new Set(picked).size !== n) return null;
  const order = timelineOrder(q.id, n);
  return { correct: picked.every((shown, k) => order[shown] === k), answer: picked };
}

/** The right answer in SHOWN positions (a timeline: shown positions earliest-first). */
export function solutionOf(q: Pick<KvizcheQuestion, "id" | "kind" | "options" | "correct_index">): number | number[] {
  if (q.kind === "choice") return q.correct_index ?? 0;
  const order = timelineOrder(q.id, q.options.length);
  return q.options.map((_, k) => order.indexOf(k));
}

/** "12,4 с" */
/** Quiet stopwatch while playing, e.g. 0:07 / 1:12 — no tenths, so it doesn't race. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString("mk-MK", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} с`;
}
