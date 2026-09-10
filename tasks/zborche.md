# ЗборЧе — daily Macedonian word game

A Wordle-style daily game. Prilep flavour: the name emphasises **Ч** (ЗборЧе).
Zero Supabase egress — per-device state in localStorage / AsyncStorage; words are
authored in Sanity and served through one cache-free API route.

## Decisions (from the user)
- Words authored in **Sanity** (`zborche` doc: word + date + optional hint).
- **No** strict guess-validation dictionary for v1 — accept any right-length guess.
  (Can add an mk_MK wordlist later.)
- Variable length **4–6** letters; the grid sizes itself → Mon(4) → Sun(6) ramp is
  just a scheduling choice, no separate "difficulty" field.
- Guesses allowed = word length + 1.
- Placements: new standalone category `/zborche`, web right column (replacing the
  promise tracker), mobile home (under weather / above Пријави), mobile drawer
  (under the account card, by the movie poll). Vector tile logo.

## Data contract (one shape, both clients)
`GET /api/zborche` (force-dynamic, no-store) →
`{ date: "YYYY-MM-DD", id, word: "ЗБОР", hint: string|null, length: number }`
or `{ date, word: null }` when nothing is scheduled today (Skopje date).

Coloring = standard Wordle with duplicate-letter handling: correct / present / absent.
Per-day storage key `zborche:<date>` → `{ guesses: string[], status }`.

## Files
### Sanity
- [ ] sanity/schemas/zborche.ts — new doc type
- [ ] sanity/schemas/index.ts — register
- [ ] sanity/structure.ts — Studio section
- [ ] supabase — NONE (no DB)

### Web
- [ ] lib/sanity/zborche.ts — fetchDailyWord() (Skopje "today")
- [ ] lib/zborche.ts — pure game logic (evaluateGuess, letter states) shared by page
- [ ] app/api/zborche/route.ts — daily puzzle endpoint
- [ ] components/zborche/ZborcheLogo.tsx — tile wordmark
- [ ] components/zborche/ZborcheGame.tsx — client game (grid + MK keyboard + storage)
- [ ] components/zborche/ZborcheCard.tsx — right-column promo card
- [ ] app/(main)/zborche/page.tsx — route (revalidate 300, metadata)
- [ ] lib/layout.ts — add /zborche to THREE_COLUMN_ROUTES
- [ ] components/layout/RightPanel.tsx — swap PromiseTracker → ZborcheCard

### Mobile (OTA-safe: NO new native deps — logo & tiles are Views, not SVG)
- [ ] src/constants/config.ts — Endpoints.zborche
- [ ] src/lib/zborche.ts — fetch + pure logic + AsyncStorage
- [ ] src/components/ZborcheLogo.tsx — tile wordmark (Views)
- [ ] src/components/ZborcheCard.tsx — promo card (home + drawer)
- [ ] src/app/zborche.tsx — game screen
- [ ] src/app/(tabs)/index.tsx — card after WeatherStrip
- [ ] src/components/AppDrawer.tsx — card under account block
- [ ] src/locales/mk.json — strings

## Verify
- [ ] `npx tsc --noEmit` in pprilep
- [ ] `npx tsc --noEmit` in mojprilep-mobile
- [ ] preview /zborche in browser; play a round
- [ ] seed one zborche doc so today has a word to test

## Do NOT
- bump expo.version (JS-only OTA)
- add react-native-svg (native rebuild) — use Views
- push anything until explicitly asked
