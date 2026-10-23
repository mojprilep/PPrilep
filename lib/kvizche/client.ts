"use client";

/**
 * КвизЧе — browser side: the quiz API (/api/kvizche, cookie session) and the
 * two public boards (definer RPCs, readable by anon).
 */

import { createClient } from "../supabase/client";
import type { KvizcheResult, QuestionKind } from "../kvizche";

/** Fired after an answer lands, so the boards refresh. */
export const KVIZCHE_EVENT = "kvizche:answered";

export type DayStatus = "today" | "answered" | "missed" | "upcoming" | "none";

export type KvizcheState = {
  today: string;
  day: number;
  signedIn: boolean;
  /** Site admin testing the quiz: every day is playable and answers can be reset. */
  tester?: boolean;
  week: { theme: string; intro: string | null; coverUrl: string | null; weekStart: string } | null;
  days: { day: number; kind: QuestionKind | null; optionCount: number; status: DayStatus; result: KvizcheResult | null }[];
};

export type PlayQuestion = {
  id: number;
  day: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  imageUrl: string | null;
  /** When the clock started on the server (signed in); null when logged out. */
  startedAt?: string | null;
};

export type KvizcheTodayRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  correct: boolean;
  time_ms: number;
  points: number;
  played_today: number;
  correct_today: number;
};

export type KvizcheWeekRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  points: number;
  correct: number;
  answered: number;
  time_ms: number;
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || "Грешка. Пробај повторно.");
  return json;
}

export const fetchKvizche = () => call<KvizcheState>("/api/kvizche");

export const startKvizche = (day: number) =>
  call<{ question?: PlayQuestion; startedAt?: string | null; result?: KvizcheResult }>("/api/kvizche/start", { day });

/** Tester only: wipe your own answers for this week. */
export const resetKvizche = () => call<{ ok: true; removed: number }>("/api/kvizche/reset", {});

export const answerKvizche = (questionId: number, answer: number | number[], clientMs: number) =>
  call<{ result: KvizcheResult }>("/api/kvizche/answer", { questionId, answer, clientMs });

export async function fetchKvizcheTodayBoard(): Promise<KvizcheTodayRow[]> {
  try {
    const { data, error } = await createClient().rpc("kvizche_today_board");
    return error || !data ? [] : (data as KvizcheTodayRow[]);
  } catch {
    return [];
  }
}

export async function fetchKvizcheWeekBoard(): Promise<KvizcheWeekRow[]> {
  try {
    const { data, error } = await createClient().rpc("kvizche_week_board");
    return error || !data ? [] : (data as KvizcheWeekRow[]);
  } catch {
    return [];
  }
}

// A logged-out player’s answers are kept on this device only, by date (one try per day).
const ANON_KEY = "kvizche:anon";

export function loadAnonResults(): Record<string, KvizcheResult> {
  try {
    return JSON.parse(localStorage.getItem(ANON_KEY) || "{}") as Record<string, KvizcheResult>;
  } catch {
    return {};
  }
}

export function saveAnonResult(date: string, result: KvizcheResult) {
  try {
    const all = { ...loadAnonResults(), [date]: result };
    // Keep only the latest three weeks.
    const keep = Object.keys(all).sort().slice(-21);
    localStorage.setItem(ANON_KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))));
  } catch {
    // Storage blocked — the answer just isn’t remembered.
  }
}
