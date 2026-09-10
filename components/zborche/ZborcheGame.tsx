"use client";

/**
 * ЗборЧе — the daily word game (web).
 *
 * A Wordle in Macedonian: guess the day's word, tiles color green/yellow/grey.
 * The word comes from /api/zborche (only today's is ever sent), and everything
 * else — the guesses, whether you've solved it — lives in localStorage keyed by
 * the day, so there is no account and nothing hits Supabase. Come back the same
 * day and your board is where you left it; a new day is a fresh word.
 *
 * v1 has no dictionary check: any guess of the right length is accepted. The
 * plan is to add a Macedonian wordlist later; until then the only rule is length.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Delete, CornerDownLeft } from "lucide-react";
import {
  MK_ROWS,
  maxAttempts,
  evaluateGuess,
  deriveKeyStates,
  type Tile,
} from "../../lib/zborche";
import ZborcheLogo from "./ZborcheLogo";
import { loadDictionary } from "../../lib/zborche/dictionary";
import { recordResult } from "../../lib/zborche/stats";

type Puzzle = { date: string; word: string; hint: string | null; length: number };
type Status = "playing" | "won" | "lost";
type Saved = { guesses: string[]; status: Status };

const STORAGE_PREFIX = "zborche:";

function load(date: string): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + date);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.guesses)) return parsed as Saved;
    return null;
  } catch {
    return null;
  }
}

function save(date: string, data: Saved) {
  try {
    localStorage.setItem(STORAGE_PREFIX + date, JSON.stringify(data));
  } catch {
    // Private mode: the game still plays, it just won't be there on reload.
  }
}

const TILE_BG: Record<Tile, string> = {
  correct: "bg-[#2aa99d] border-[#2aa99d] text-white",
  present: "bg-amber-400 border-amber-400 text-white",
  absent: "bg-zinc-400 border-zinc-400 text-white",
};
const KEY_BG: Record<Tile, string> = {
  correct: "bg-[#2aa99d] text-white",
  present: "bg-amber-400 text-white",
  absent: "bg-zinc-300 text-zinc-500",
};

// Latin → Macedonian Cyrillic, so the game is playable on a normal QWERTY
// keyboard too — not only a Cyrillic layout. Single keys map to one letter;
// the nine letters with no Latin key are the digraphs Macedonians already type
// when writing Latin. The first key types its own letter and the second
// "upgrades" it (s→С, then h → Ш), via a one-key lookahead.
const LAT_SINGLE: Record<string, string> = {
  a: "А", b: "Б", v: "В", g: "Г", d: "Д", e: "Е", z: "З", i: "И", j: "Ј",
  k: "К", l: "Л", m: "М", n: "Н", o: "О", p: "П", r: "Р", s: "С", t: "Т",
  u: "У", f: "Ф", h: "Х", c: "Ц",
};
const LAT_DIGRAPH: Record<string, string> = {
  zh: "Ж", dz: "Ѕ", gj: "Ѓ", kj: "Ќ", lj: "Љ", nj: "Њ", ch: "Ч", sh: "Ш", dj: "Џ",
};
// Latin keys that can begin one of those digraphs — the ones worth remembering
// for the lookahead.
const LAT_STARTERS = new Set(["z", "d", "g", "k", "l", "n", "c", "s"]);

export default function ZborcheGame() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<Status>("playing");
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  // The hint is opt-in: after the 3rd guess a button appears, and the hint text
  // only shows once the player chooses to reveal it — never automatically.
  const [showHint, setShowHint] = useState(false);
  // Fires a burst of confetti the moment the player wins. Only set on the
  // winning submit — never on a restored board — so reloading a solved day
  // doesn't re-trigger it.
  const [celebrate, setCelebrate] = useState(false);
  // Index of the row that was just submitted — its tiles flip to reveal their
  // colour. Only this row animates, so a restored board doesn't flip on load.
  const [revealRow, setRevealRow] = useState<number | null>(null);

  // Fetch today's word and rehydrate the day's board from storage.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/zborche", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!data?.word) {
          setPuzzle(null);
        } else {
          const p: Puzzle = {
            date: data.date,
            word: data.word,
            hint: data.hint ?? null,
            length: data.length,
          };
          setPuzzle(p);
          const saved = load(p.date);
          if (saved) {
            setGuesses(saved.guesses);
            setStatus(saved.status);
          }
        }
      } catch {
        if (alive) setPuzzle(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const answer = puzzle?.word ?? "";
  const length = puzzle?.length ?? 0;
  const rows = length ? maxAttempts(length) : 0;
  const keyStates = useMemo(() => deriveKeyStates(guesses, answer), [guesses, answer]);

  // Load the valid-word list for this length once; guesses are checked against
  // it locally. null = couldn't load (offline / unknown length) → length-only.
  const dictRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!length) return;
    let alive = true;
    loadDictionary(length).then((d) => {
      if (alive) dictRef.current = d;
    });
    return () => {
      alive = false;
    };
  }, [length]);

  const message = useCallback((m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash((v) => (v === m ? null : v)), 1600);
  }, []);

  const submit = useCallback(() => {
    if (!puzzle || status !== "playing") return;
    if (current.length !== length) {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      message(`Зборот има ${length} букви.`);
      return;
    }
    // Reject non-words. The answer is always allowed; if the dictionary hasn't
    // loaded we skip this and accept any right-length guess.
    if (dictRef.current && current !== answer && !dictRef.current.has(current)) {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      message("Зборот не постои во речникот.");
      return;
    }
    const nextGuesses = [...guesses, current];
    let nextStatus: Status = "playing";
    if (current === answer) nextStatus = "won";
    else if (nextGuesses.length >= rows) nextStatus = "lost";

    setGuesses(nextGuesses);
    setCurrent("");
    setStatus(nextStatus);
    setRevealRow(nextGuesses.length - 1);
    save(puzzle.date, { guesses: nextGuesses, status: nextStatus });
    if (nextStatus !== "playing") {
      // Fold the finished game into the on-device scoreboard (idempotent per
      // day); the right-column stats panel refreshes off its event.
      recordResult(puzzle.date, nextStatus === "won", nextGuesses.length);
    }
    if (nextStatus === "won") {
      message("Браво! 🎉");
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 4000);
    } else if (nextStatus === "lost") message(answer);
  }, [puzzle, status, current, length, guesses, answer, rows, message]);

  const type = useCallback(
    (ch: string) => {
      if (status !== "playing") return;
      setCurrent((c) => (c.length < length ? c + ch : c));
    },
    [status, length],
  );

  const backspace = useCallback(() => setCurrent((c) => c.slice(0, -1)), []);

  // Swap the last typed letter — used when a Latin digraph completes (the "s"
  // already put С down; the following "h" turns it into Ш).
  const replaceLast = useCallback(
    (ch: string) => {
      if (status !== "playing") return;
      setCurrent((c) => (c ? c.slice(0, -1) + ch : c));
    },
    [status],
  );

  // Remembers the last Latin key when it could still start a digraph, so the
  // next key can upgrade the letter instead of adding a new one.
  const latinPending = useRef<string | null>(null);

  // Physical keyboard: Enter submits, Backspace deletes. Letters work BOTH on a
  // Macedonian (Cyrillic) layout and on a normal Latin/QWERTY keyboard, the
  // latter transliterated (with digraphs, see LAT_*). Ignore keystrokes aimed
  // at a real text field (the site search, etc.) and any modifier combo so
  // browser shortcuts still work.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Enter") {
        latinPending.current = null;
        submit();
        return;
      }
      if (e.key === "Backspace") {
        latinPending.current = null;
        backspace();
        return;
      }
      if (e.key.length !== 1) return;

      // Cyrillic layout: the key already is a Macedonian letter.
      const up = e.key.toUpperCase();
      if (MK_ROWS.some((r) => r.includes(up))) {
        latinPending.current = null;
        type(up);
        return;
      }

      // Latin layout: transliterate. A pending starter + this key may complete
      // a digraph and upgrade the letter just typed.
      const low = e.key.toLowerCase();
      if (low < "a" || low > "z") {
        latinPending.current = null;
        return;
      }
      const prev = latinPending.current;
      if (prev) {
        const di = LAT_DIGRAPH[prev + low];
        if (di) {
          replaceLast(di);
          latinPending.current = null;
          return;
        }
      }
      const single = LAT_SINGLE[low];
      if (single) {
        type(single);
        latinPending.current = LAT_STARTERS.has(low) ? low : null;
      } else {
        latinPending.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, backspace, type, replaceLast]);

  function share() {
    if (!puzzle) return;
    const grid = guesses
      .map((g) =>
        evaluateGuess(g, answer)
          .map((t) => (t === "correct" ? "🟩" : t === "present" ? "🟨" : "⬛"))
          .join(""),
      )
      .join("\n");
    const score = status === "won" ? `${guesses.length}/${rows}` : `X/${rows}`;
    const text = `ЗборЧе ${puzzle.date} ${score}\n${grid}\nmojprilep.mk/zborche`;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      message("Не можам да копирам.");
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!puzzle) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-theme-muted">
            Нема збор за денес. Врати се утре за нова загатка! 🟩
          </p>
        </div>
      </div>
    );
  }

  const done = status !== "playing";

  return (
    <div className="space-y-4">
      {celebrate && <Confetti />}
      <Header />

      {puzzle.hint && status === "playing" && guesses.length >= 3 && (
        <div className="text-center">
          {showHint ? (
            <p className="text-xs text-theme-muted">💡 {puzzle.hint}</p>
          ) : (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="text-xs font-semibold text-theme-muted underline underline-offset-2 hover:text-theme"
            >
              💡 Прикажи совет
            </button>
          )}
        </div>
      )}

      {/* Board */}
      <div
        className={`mx-auto grid w-fit gap-1.5 ${shake ? "animate-[shake_0.4s]" : ""}`}
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows }).map((_, r) => {
          const guess = guesses[r];
          const isCurrentRow = r === guesses.length && !done;
          const letters = guess ?? (isCurrentRow ? current : "");
          const tiles = guess ? evaluateGuess(guess, answer) : null;
          return (
            <div
              key={r}
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
            >
              {Array.from({ length }).map((__, i) => {
                const ch = letters[i] ?? "";
                const state = tiles?.[i];
                // Flip the just-submitted row's tiles (staggered); pop the newest
                // letter as it's typed into the active row.
                const isReveal = !!tiles && r === revealRow;
                const isPopped = isCurrentRow && !!ch && i === current.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex h-12 w-12 items-center justify-center rounded-md border-2 text-xl font-extrabold uppercase sm:h-14 sm:w-14 sm:text-2xl ${
                      isReveal ? "zb-flip" : isPopped ? "zb-pop" : ""
                    } ${
                      state
                        ? TILE_BG[state]
                        : ch
                          ? "border-zinc-400 bg-white text-theme-heading"
                          : "border-zinc-200 bg-white text-theme-heading"
                    }`}
                    style={isReveal ? { animationDelay: `${i * 120}ms` } : undefined}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Flash / result */}
      <div className="min-h-[1.5rem] text-center">
        {flash && (
          <span className="inline-block rounded-lg bg-zinc-800 px-3 py-1 text-sm font-semibold text-white">
            {flash}
          </span>
        )}
      </div>

      {done ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-theme-muted">
            {status === "won"
              ? `Погоди во ${guesses.length} ${guesses.length === 1 ? "обид" : "обиди"}!`
              : `Зборот беше „${answer}“.`}
          </p>
          <button
            type="button"
            onClick={share}
            className="rounded-xl bg-[#2aa99d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#248f85]"
          >
            {copied ? "Копирано ✓" : "Сподели резултат"}
          </button>
          <p className="text-xs text-theme-muted">Нов збор секој ден по полноќ.</p>
        </div>
      ) : (
        <Keyboard
          keyStates={keyStates}
          onType={type}
          onEnter={submit}
          onBackspace={backspace}
        />
      )}

      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
        @keyframes zbpop{0%{transform:scale(.85)}45%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes zbflip{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
        .zb-pop{animation:zbpop .13s ease-out}
        .zb-flip{animation:zbflip .5s ease both}
        @media (prefers-reduced-motion: reduce){.zb-pop,.zb-flip{animation:none}}
      `}</style>
    </div>
  );
}

/**
 * A one-shot confetti burst for a win. Pure DOM + CSS — no dependency, no
 * canvas: ~90 little squares fall from the top with randomised colour, offset,
 * drift and spin. Fixed and pointer-events-none so it overlays the whole
 * viewport without blocking clicks; honours prefers-reduced-motion (nothing
 * renders). The parent unmounts it after the animation, so it fires once.
 */
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#2aa99d", "#fbbf24", "#ef4444", "#3b82f6", "#a855f7", "#22c55e"];
    return Array.from({ length: 90 }, (_, i) => ({
      left: Math.random() * 100,
      bg: colors[i % colors.length],
      delay: Math.random() * 0.5,
      duration: 2.4 + Math.random() * 1.4,
      drift: `${(Math.random() * 2 - 1) * 120}px`,
      size: 6 + Math.random() * 6,
      rotate: `${Math.random() * 720 - 360}deg`,
    }));
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="zb-confetti absolute top-[-16px] block rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.bg,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--zb-drift": p.drift,
              "--zb-rot": p.rotate,
            } as CSSProperties
          }
        />
      ))}
      <style>{`
        @keyframes zbconfetti{
          0%{transform:translate3d(0,0,0) rotate(0);opacity:1}
          100%{transform:translate3d(var(--zb-drift),105vh,0) rotate(var(--zb-rot));opacity:1}
        }
        .zb-confetti{animation:zbconfetti linear forwards}
        @media (prefers-reduced-motion: reduce){.zb-confetti{display:none}}
      `}</style>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col items-center gap-1 pt-1">
      <ZborcheLogo height={44} />
      <p className="text-xs text-theme-muted">Погоди го зборот на денот</p>
    </div>
  );
}

function Keyboard({
  keyStates,
  onType,
  onEnter,
  onBackspace,
}: {
  keyStates: Record<string, Tile>;
  onType: (ch: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-1.5">
      {MK_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {ri === MK_ROWS.length - 1 && (
            <button
              type="button"
              onClick={onEnter}
              aria-label="Потврди"
              className="flex h-11 min-w-[4rem] items-center justify-center gap-1 rounded-md bg-[#2aa99d] px-3 text-xs font-bold uppercase text-white hover:bg-[#248f85]"
            >
              <CornerDownLeft size={18} />
            </button>
          )}
          {row.map((ch) => {
            const state = keyStates[ch];
            return (
              <button
                key={ch}
                type="button"
                onClick={() => onType(ch)}
                className={`h-11 min-w-[1.75rem] flex-1 rounded-md text-sm font-bold uppercase transition-colors sm:min-w-[2rem] ${
                  state ? KEY_BG[state] : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                }`}
              >
                {ch}
              </button>
            );
          })}
          {ri === MK_ROWS.length - 1 && (
            <button
              type="button"
              onClick={onBackspace}
              aria-label="Избриши"
              className="flex h-11 items-center justify-center rounded-md bg-zinc-200 px-2.5 text-zinc-700 hover:bg-zinc-300"
            >
              <Delete size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
