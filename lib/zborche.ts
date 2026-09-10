/**
 * ЗборЧе — pure game logic, shared by the page and its pieces.
 *
 * No React, no DOM: just the Wordle rules (letter coloring with correct
 * duplicate handling) and the Macedonian keyboard layout. The mobile app keeps
 * its own copy of this file because the two repos don't share a module.
 */

/** How a single tile is scored. */
export type Tile = "correct" | "present" | "absent";

/** The 31 letters of the Macedonian alphabet, in the standard Macedonian
 *  keyboard (ЉЊЕРТ…) layout — the one people actually type on, so the keys sit
 *  where muscle memory expects them. Enter and Backspace are added by the
 *  keyboard component, not here. */
export const MK_ROWS: readonly (readonly string[])[] = [
  ["Љ", "Њ", "Е", "Р", "Т", "Ѕ", "У", "И", "О", "П", "Ш", "Ѓ", "Ж"],
  ["А", "С", "Д", "Ф", "Г", "Х", "Ј", "К", "Л", "Ч", "Ќ"],
  ["З", "Џ", "Ц", "В", "Б", "Н", "М"],
];

/** Guesses a player gets for a word of the given length: length + 1. */
export function maxAttempts(wordLength: number): number {
  return wordLength + 1;
}

/**
 * Score one guess against the answer, Wordle-style. Greens are assigned first,
 * then yellows are handed out only while an unmatched copy of the letter is
 * still left in the answer — so a doubled guess letter can't show two yellows
 * when the answer holds the letter once.
 *
 * Both strings must already be uppercase and the same length.
 */
export function evaluateGuess(guess: string, answer: string): Tile[] {
  const g = [...guess];
  const a = [...answer];
  const result: Tile[] = g.map(() => "absent");

  // Remaining answer letters after greens are taken out of the pool.
  const pool = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      pool.set(a[i], (pool.get(a[i]) ?? 0) + 1);
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    const left = pool.get(g[i]) ?? 0;
    if (left > 0) {
      result[i] = "present";
      pool.set(g[i], left - 1);
    }
  }
  return result;
}

/**
 * The best state seen for each letter across all guesses, for coloring the
 * keyboard. correct beats present beats absent, so a key never downgrades.
 */
export function deriveKeyStates(
  guesses: string[],
  answer: string,
): Record<string, Tile> {
  const rank: Record<Tile, number> = { absent: 0, present: 1, correct: 2 };
  const best: Record<string, Tile> = {};
  for (const guess of guesses) {
    const tiles = evaluateGuess(guess, answer);
    [...guess].forEach((ch, i) => {
      const prev = best[ch];
      if (!prev || rank[tiles[i]] > rank[prev]) best[ch] = tiles[i];
    });
  }
  return best;
}

/** True once one of the guesses is the answer. */
export function isSolved(guesses: string[], answer: string): boolean {
  return guesses.includes(answer);
}
