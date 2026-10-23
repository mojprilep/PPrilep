"use client";

/**
 * Short splash for the games (ЗборЧе, КвизЧе): the game's mark pops in, the
 * tagline rises under it, then the whole cover fades away — about a second,
 * tap to skip. Plays once per browser session per game, so coming back to the
 * board later doesn't make you sit through it again. Skipped entirely for
 * people who ask for reduced motion.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

const listeners = new Set<() => void>();
const seenKey = (id: string) => `game-intro:${id}`;

function hasSeen(id: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    // Storage blocked (private mode etc.) — the intro just plays again next time.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export default function GameIntro({ id, mark, tagline }: { id: string; mark: ReactNode; tagline: string }) {
  // The server can't know, so it renders the cover; a returning visitor drops
  // it on hydration (and before paint on client-side navigation).
  const seen = useSyncExternalStore(
    subscribe,
    () => hasSeen(id),
    () => false,
  );

  useEffect(() => {
    if (seen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Fallback in case animationend never fires (background tab etc.).
    const t = setTimeout(() => markSeen(id), reduced ? 0 : 1600);
    return () => clearTimeout(t);
  }, [id, seen]);

  if (seen) return null;

  return (
    <div
      aria-hidden
      onClick={() => markSeen(id)}
      onAnimationEnd={(e) => e.animationName === "gi-out" && markSeen(id)}
      className="gi-cover fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-3 bg-theme-canvas"
    >
      <div className="gi-mark">{mark}</div>
      <p className="gi-tag text-sm text-theme-muted">{tagline}</p>
      <style>{`
        @keyframes gi-pop{0%{opacity:0;transform:scale(.6)}100%{opacity:1;transform:scale(1)}}
        @keyframes gi-up{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
        @keyframes gi-out{to{opacity:0;visibility:hidden}}
        .gi-cover{animation:gi-out .35s ease 1.05s forwards}
        .gi-mark{animation:gi-pop .5s cubic-bezier(.34,1.56,.64,1) both}
        .gi-tag{animation:gi-up .4s ease .35s both}
        @media (prefers-reduced-motion: reduce){.gi-cover{display:none}}
      `}</style>
    </div>
  );
}
