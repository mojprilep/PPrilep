"use client";

/**
 * КвизЧе — the weekly history quiz, web version.
 *
 * The week strip shows Mon–Sun; today's question stays hidden until the player
 * taps "Започни" (that is when the clock starts — on the server too, for a
 * signed-in player). Mon–Sat: tap one option. Sunday: put the events in order
 * with the arrows and confirm. Then the answer, the time, the points and the
 * "Дали знаеше?" card. Past answered days can be reopened from the strip.
 *
 * Logged-out players can play (timed by the browser, remembered on this device
 * only) but are not ranked.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { ArrowDown, ArrowUp, Check, Clock, X } from "lucide-react";
import { addDays, DAY_NAMES, formatClock, formatSeconds, LATENCY_ALLOWANCE_MS, type KvizcheResult } from "../../lib/kvizche";
import {
  answerKvizche,
  fetchKvizche,
  KVIZCHE_EVENT,
  loadAnonResults,
  saveAnonResult,
  resetKvizche,
  startKvizche,
  type KvizcheState,
  type PlayQuestion,
} from "../../lib/kvizche/client";

const BRAND = "#2aa99d";
const SHORT_DAYS = ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"];

/** When the question appeared (performance.now) and how much time had already run before that. */
type Clock = { shownAt: number; offset: number };

/** Logged out: overlay the answers this device remembers. */
function withAnon(s: KvizcheState): KvizcheState {
  const week = s.week;
  if (s.signedIn || !week) return s;
  const anon = loadAnonResults();
  return {
    ...s,
    days: s.days.map((d) => {
      const r = anon[addDays(week.weekStart, d.day - 1)];
      return r && d.status !== "none" ? { ...d, status: "answered", result: r } : d;
    }),
  };
}

export default function KvizcheGame() {
  const [state, setState] = useState<KvizcheState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState<PlayQuestion | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  /** The day whose result was just revealed — only that one animates in. */
  const [revealed, setRevealed] = useState<number | null>(null);
  const [clock, setClock] = useState<Clock>({ shownAt: 0, offset: 0 });

  const load = useCallback(
    () =>
      fetchKvizche()
        .then((s) => {
          setState(withAnon(s));
          setSelectedDay((cur) => cur ?? s.day);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function begin(day: number) {
    setBusy(true);
    setError(null);
    try {
      const r = await startKvizche(day);
      if (r.result) await load();
      else if (r.question) {
        // The client stopwatch starts now. When a started question is reopened,
        // the display carries on from the server's start (less the latency allowance).
        const ran = r.startedAt ? Date.now() - new Date(r.startedAt).getTime() - LATENCY_ALLOWANCE_MS : 0;
        setClock({ shownAt: performance.now(), offset: Math.max(0, ran) });
        setQuestion({ ...r.question, startedAt: r.startedAt ?? null });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(answer: number | number[]) {
    if (!question || !state) return;
    // The client's own measure: question on screen → the tap.
    const clientMs = performance.now() - clock.shownAt;
    setBusy(true);
    setError(null);
    try {
      const { result } = await answerKvizche(question.id, answer, clientMs);
      if (!state.signedIn) saveAnonResult(state.today, result);
      // Show the answer straight from the response; the week and the boards
      // refresh in the background instead of holding the reveal back.
      setState((s) => s && { ...s, days: s.days.map((d) => (d.day === result.day ? { ...d, status: "answered", result } : d)) });
      setSelectedDay(result.day);
      setRevealed(result.day);
      setQuestion(null);
      setBusy(false);
      void load().then(() => window.dispatchEvent(new Event(KVIZCHE_EVENT)));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("Да ги избришам твоите одговори за оваа недела?")) return;
    setBusy(true);
    setError(null);
    try {
      await resetKvizche();
      setQuestion(null);
      await load();
      window.dispatchEvent(new Event(KVIZCHE_EVENT));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <Frame>
        <p className="py-10 text-center text-sm text-slate-500">{error ?? "Се вчитува…"}</p>
      </Frame>
    );
  }

  if (!state.week) {
    return (
      <Frame>
        <div className="rounded-2xl border border-[#e4ece8] bg-white p-6 text-center">
          <p className="text-3xl">🏛️</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">Оваа недела нема квиз.</p>
          <p className="mt-1 text-[13px] text-slate-500">
            Нова тема од историјата на Прилеп и Македонија — наскоро.
          </p>
        </div>
      </Frame>
    );
  }

  const selected = state.days.find((d) => d.day === selectedDay) ?? state.days[state.day - 1];

  return (
    <Frame>
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2aa99d]">Тема на неделата</p>
        <h2 className="mt-0.5 text-lg font-bold leading-snug text-slate-800">{state.week.theme}</h2>
        {state.week.intro && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.week.intro}</p>}

        <div className="mt-4 grid grid-cols-7 gap-1">
          {state.days.map((d) => {
            const isSel = d.day === selected.day;
            const clickable = d.status === "answered" || d.status === "today";
            const mark =
              d.status === "answered" ? (d.result?.correct ? "✓" : "✗") : d.status === "today" ? "●" : d.status === "missed" ? "–" : "";
            return (
              <button
                key={d.day}
                type="button"
                disabled={!clickable || !!question}
                onClick={() => {
                  setSelectedDay(d.day);
                  setRevealed(null);
                }}
                className={`flex flex-col items-center rounded-lg border-2 py-1.5 text-[11px] transition ${
                  isSel ? "border-[#2aa99d] bg-[#e3f4f1]" : "border-transparent bg-[#f6faf8]"
                } ${clickable ? "hover:border-[#2aa99d]/50" : "opacity-60"}`}
              >
                <span className="font-semibold text-slate-600">{SHORT_DAYS[d.day - 1]}</span>
                <span
                  className={`mt-0.5 h-4 text-[13px] font-bold ${
                    d.status === "answered"
                      ? d.result?.correct
                        ? "text-[#2aa99d]"
                        : "text-red-500"
                      : "text-slate-400"
                  }`}
                >
                  {mark}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {question ? (
        <Play question={question} clock={clock} busy={busy} onSubmit={submit} />
      ) : selected.status === "answered" && selected.result ? (
        <ResultCard key={selected.day} result={selected.result} animate={revealed === selected.day} />
      ) : selected.status === "today" ? (
        <StartCard day={selected.day} kind={selected.kind} optionCount={selected.optionCount} signedIn={state.signedIn} busy={busy} onStart={() => begin(selected.day)} />
      ) : (
        <p className="rounded-2xl border border-[#e4ece8] bg-white p-4 text-center text-[13px] text-slate-500">
          Денес нема прашање.
        </p>
      )}

      {state.tester && !question && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-[12px] text-amber-800">
          Тест-режим (админ): секој ден може да се игра.{" "}
          <button type="button" disabled={busy} onClick={reset} className="font-bold underline disabled:opacity-50">
            Ресетирај ги моите одговори
          </button>
        </div>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 py-1">
        <span className="text-2xl">🏛️</span>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
          Квиз<span style={{ color: BRAND }}>Че</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

function StartCard({
  day,
  kind,
  optionCount,
  signedIn,
  busy,
  onStart,
}: {
  day: number;
  kind: "choice" | "timeline" | null;
  optionCount: number;
  signedIn: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e4ece8] bg-white p-5 text-center">
      <p className="text-sm font-semibold text-slate-800">
        {DAY_NAMES[day - 1]} · прашање {day} од 7
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
        {kind === "timeline"
          ? `Подреди ${optionCount} настани по хронолошки ред. Сè или ништо.`
          : `${optionCount} понудени одговори, само еден е точен.`}{" "}
        Имаш еден обид, а времето почнува кога ќе притиснеш „Започни“ — побрзиот точен одговор носи повеќе поени.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onStart}
        className="mt-4 rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        style={{ background: BRAND }}
      >
        Започни
      </button>
      {!signedIn && (
        <p className="mt-3 text-[12px] text-slate-500">
          Играш без најава — нема да влезеш на ранг листата.{" "}
          <Link href="/auth/login?next=/kvizche" className="font-semibold text-[#2aa99d]">
            Најави се
          </Link>
        </p>
      )}
    </section>
  );
}

function Play({
  question,
  clock,
  busy,
  onSubmit,
}: {
  question: PlayQuestion;
  clock: Clock;
  busy: boolean;
  onSubmit: (answer: number | number[]) => void;
}) {
  const [elapsed, setElapsed] = useState(clock.offset);
  const [order, setOrder] = useState(() => question.options.map((_, i) => i));
  const [picked, setPicked] = useState<number | null>(null);
  const checking = busy && picked !== null;

  useEffect(() => {
    const t = setInterval(() => setElapsed(clock.offset + performance.now() - clock.shownAt), 1000);
    return () => clearInterval(t);
  }, [clock]);

  const move = (from: number, to: number) =>
    setOrder((o) => {
      if (to < 0 || to >= o.length) return o;
      const next = [...o];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  return (
    <section className="rounded-2xl border border-[#e4ece8] bg-white p-4">
      <div className="mb-2 text-[12px] text-slate-500">{DAY_NAMES[question.day - 1]}</div>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.imageUrl} alt="" className="mb-3 max-h-56 w-full rounded-xl object-cover" />
      )}
      <p className="text-[15px] font-semibold leading-snug text-slate-800">{question.prompt}</p>

      {question.kind === "choice" ? (
        <div className="mt-4 space-y-2">
          {question.options.map((o, i) => {
            const mine = checking && picked === i;
            return (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPicked(i);
                  onSubmit(i);
                }}
                className={`flex w-full items-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-[#2aa99d] ${
                  mine ? "kv-checking border-[#2aa99d] bg-[#e3f4f1]" : checking ? "border-[#e4ece8] bg-[#f6faf8] opacity-40" : "border-[#e4ece8] bg-[#f6faf8] disabled:opacity-60"
                }`}
              >
                <span className="min-w-0 flex-1">{o}</span>
                {mine && <span className="kv-spin h-4 w-4 shrink-0 rounded-full border-2 border-[#2aa99d] border-t-transparent" />}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-slate-500">Најстариот настан горе, најновиот долу.</p>
          <ol className="mt-3 space-y-2">
            {order.map((shown, k) => (
              <li
                key={shown}
                className="flex items-center gap-2 rounded-xl border-2 border-[#e4ece8] bg-[#f6faf8] px-3 py-2"
              >
                <span className="w-5 shrink-0 text-sm font-bold text-[#2aa99d]">{k + 1}.</span>
                <span className="min-w-0 flex-1 text-sm text-slate-800">{question.options[shown]}</span>
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label="Нагоре"
                    disabled={k === 0}
                    onClick={() => move(k, k - 1)}
                    className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Надолу"
                    disabled={k === order.length - 1}
                    onClick={() => move(k, k + 1)}
                    className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPicked(0);
              onSubmit(order);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-70"
            style={{ background: BRAND }}
          >
            {checking && <span className="kv-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />}
            {checking ? "Се проверува…" : "Потврди редослед"}
          </button>
        </>
      )}
      {/* Kept small and out of the way: the time counts, but it shouldn't shout. */}
      <p className="mt-3 inline-flex w-full items-center justify-end gap-1 font-mono text-[11px] text-slate-400">
        <Clock size={11} /> {formatClock(elapsed)}
      </p>
      <style>{`
        @keyframes kv-pulse{50%{transform:scale(.98)}}
        @keyframes kv-spin{to{transform:rotate(360deg)}}
        .kv-checking{animation:kv-pulse .8s ease-in-out infinite}
        .kv-spin{animation:kv-spin .7s linear infinite}
        @media (prefers-reduced-motion: reduce){.kv-checking{animation:none}}
      `}</style>
    </section>
  );
}

/** `animate`: the answer was just given — slide the card in, pop the verdict, shake it if wrong. */
function ResultCard({ result, animate = false }: { result: KvizcheResult; animate?: boolean }) {
  const isTimeline = result.kind === "timeline";
  const picked = result.answer;
  const solution = result.solution;
  return (
    <section className={`rounded-2xl border border-[#e4ece8] bg-white p-4 ${animate ? "kv-in" : ""}`}>
      {animate && (
        <style>{`
          @keyframes kv-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
          @keyframes kv-pop{0%{transform:scale(.85)}60%{transform:scale(1.04)}100%{transform:none}}
          @keyframes kv-shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
          .kv-in{animation:kv-in .35s ease-out both}
          .kv-ok{animation:kv-pop .45s cubic-bezier(.34,1.56,.64,1) .15s both}
          .kv-bad{animation:kv-shake .4s ease .2s both}
          @media (prefers-reduced-motion: reduce){.kv-in,.kv-ok,.kv-bad{animation:none}}
        `}</style>
      )}
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 ${
          result.correct ? "bg-[#e3f4f1] text-[#1f7f76]" : "bg-red-50 text-red-700"
        } ${animate ? (result.correct ? "kv-ok" : "kv-bad") : ""}`}
      >
        <span className="text-sm font-bold">{result.correct ? "Точно! 🎉" : "Не е точно"}</span>
        <span className="text-[12px] font-semibold">
          {formatSeconds(result.timeMs)} · {result.points} поени
        </span>
      </div>

      <p className="mt-3 text-[15px] font-semibold leading-snug text-slate-800">{result.prompt}</p>

      {isTimeline ? (
        <ol className="mt-3 space-y-1.5">
          {(solution as number[]).map((shown, k) => {
            const ok = (picked as number[])[k] === shown;
            return (
              <li key={shown} className="flex items-center gap-2 rounded-lg bg-[#f6faf8] px-3 py-2 text-sm">
                <span className="w-5 shrink-0 font-bold text-[#2aa99d]">{k + 1}.</span>
                <span className="min-w-0 flex-1 text-slate-800">{result.options[shown]}</span>
                {ok ? <Check size={16} className="text-[#2aa99d]" /> : <X size={16} className="text-red-500" />}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-3 space-y-1.5">
          {result.options.map((o, i) => {
            const right = i === solution;
            const mine = i === picked;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${
                  right
                    ? "border-[#2aa99d] bg-[#e3f4f1] text-slate-800"
                    : mine
                      ? "border-red-300 bg-red-50 text-slate-800"
                      : "border-transparent bg-[#f6faf8] text-slate-500"
                }`}
              >
                <span className="min-w-0 flex-1">{o}</span>
                {right && <Check size={16} className="text-[#2aa99d]" />}
                {mine && !right && <X size={16} className="text-red-500" />}
              </div>
            );
          })}
        </div>
      )}

      {isTimeline && !result.correct && (
        <p className="mt-2 text-[12px] text-slate-500">Ова е точниот редослед; ✗ значи дека ти го стави друг настан тука.</p>
      )}

      {result.explanation && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3">
          <p className="text-[12px] font-bold text-amber-800">💡 Дали знаеше?</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-amber-900">{result.explanation}</p>
        </div>
      )}
    </section>
  );
}
