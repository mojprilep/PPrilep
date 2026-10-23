# КвизЧе — weekly history quiz (Прилеп & Македонија) — v1 BUILT, not released

One themed week (Mon–Sun), ONE question per day, getting harder like ЗборЧе.
Scored on correctness + time. Ships by OTA (pure JS, no native module) + web.

## Rules (user, 2026-10-23)
- Mon 2 options · Tue 2 · Wed 3 · Thu 4 · Fri 5 · Sat 5 · Sun timeline (4–5 events, all or nothing)
- points = correct ? round(day × 100 × (1 + 0.5 × speed)) : 0; speed fades over 60 s (timeline 120 s)
- Time: server starts the clock on /start (reopening never resets it); the phone/browser stopwatch
  counts only if within 3 s below the server's figure (strips network lag, can't be faked lower)
- Logged out: playable, timed on the device, remembered locally, not ranked

## Done
- [x] `supabase/add_kvizche.sql` — weeks / questions / attempts, RLS, explicit GRANTs, 2 board RPCs — ⚠ user runs it
- [x] lib/kvizche.ts (pure helpers, node-tested) + lib/kvizche-server.ts
- [x] API: GET /api/kvizche, POST /api/kvizche/start, POST /api/kvizche/answer (cookie or Bearer)
- [x] /admin/kvizche — weeks (create/edit/publish/delete) + per-day question editor
- [x] Web /kvizche (play + Денес/Недела boards), right-panel card; tsc + eslint clean
- [x] Mobile src/lib/kvizche.ts + src/app/kvizche.tsx (play, timeline arrows, result, boards); tsc + eslint clean
- [x] Mobile drawer + locale keys via `scripts/add-kvizche-nav.mjs` (idempotent; re-run on a clean tree before OTA)
- [x] First week drafted: `supabase/seed_kvizche_osloboduvanje_prilep.sql` (2–8 Nov 2026, published=false)
- [x] Play clock toned down: small muted m:ss (0:07) bottom-right, ticks once a second (web + mobile)
- [x] GameIntro splash for ЗборЧе + КвизЧе (logo pop, tagline, fade; ~1.3 s, tap to skip, reduced-motion off; once per session web / per launch app) + КвизЧе wordmark

## Open
- [ ] User/historian verifies the first week's facts (list at the top of the seed SQL), then publishes in /admin/kvizche
- [ ] Release: SQL → web push to main (on approval) → OTA 1.0.9 + 1.0.8 (on approval; stash hunt WIP, run nav script, publish, pop)
- [ ] After the OTA: add "/kvizche" to APP_LINK_PATHS
- [ ] TEMP tester mode (site admins: play any day + /api/kvizche/reset) — remove or keep admin-only before launch
- [ ] Optional: "new question" push nudge

## Review
- Answers live in Supabase only — the Sanity dataset is public, so the solution would leak.
- Only the first answer counts (`update … where answered_at is null`), so double taps/races can't re-score.
- Timeline order is a deterministic per-question shuffle, so the server needs no per-player state to check it.

# Потрага по богатство (Treasure Hunt) — v1

Spec: Claude Docs "Treasure Hunt — Feature Spec". One hunt, one winner: an admin
hides a QR at a secret spot and posts clues. The first signed-in player whose
scan passes token + GPS + "not yet won" + rate-limit checks wins.

## Decisions (2026-10-21)
- Radius 50 m default (per hunt). Everything in Supabase + /admin/hunt (no Sanity).
- Ships with native build 1.0.10 (expo-camera + /hunt app links).
- PLAYED ONLY IN THE APP (user, 2026-10-21). Web = /admin/hunt + a teaser /hunt + an
  "install the app" /hunt/<token> (QR scanned without the app). Scan API is Bearer-only.

## Data (`supabase/add_treasure_hunt.sql`, explicit GRANTs)
- `hunts` (public: title, cover, rules, prize, starts_at, status, found_at, winner_name, reveal lat/lng after found)
- `hunt_clues` (hunt_id, body, photo, lat/lng, published_at) public once published
- `hunt_secrets` (hunt_id, token, lat, lng, radius_m) service role only
- `hunt_attempts` log, `hunt_winners` (hunt_id PK → atomic single winner, claim_code)
- New push category `hunt` in lib/push/prefs.ts and the mobile prefs panel.

## API (web, server only)
- `POST /api/hunt/scan` {token, lat, lng, accuracy} with Bearer or cookie →
  rate limit → token → radius → hunt_try_win (row-locked status flip + winner insert) → result.
- Admin actions push on announce/start/clue/rules; scan route pushes found + you-won.

## Web
- `/hunt`: the 3-state page. `/hunt/[token]`: the QR landing (sign-in →
  geolocation → scan API → result).
- `/admin/hunt`: set spot + radius, generate/print QR (rotate = new token),
  attempts log, winner + handed over.

## Mobile
- `hunt` screen (3 states, clue feed, "open in maps"), `hunt/[token]` scan
  result, in-app QR scanner (expo-camera), drawer entry, deep link.
- ⚠ Needs a NATIVE BUILD (1.0.10): expo-camera is not installed, and `/hunt` must
  be claimed in app.json (associatedDomains/intentFilters). OTA alone can't ship it.

## Progress
- [x] SQL migration (`supabase/add_treasure_hunt.sql`) — ⚠ user runs it once in the SQL editor
- [x] lib/hunt.ts, lib/push/hunt.ts, `hunt` push category
- [x] `POST /api/hunt/scan` (atomic win via hunt_try_win RPC, attempts log, rate limit)
- [x] Admin actions + `/admin/hunt` (details, status w/ pushes, spot + "I am here", QR print/rotate, clues, winner, scan log)
- [x] Web made app-only: `/hunt` teaser (status, prize, winner once found, store buttons — no clues),
      `/hunt/[token]` → install-the-app page; scan API uses getBearerUser (cookie session ignored)
- [x] tsc + eslint clean; both pages render; scan with a web cookie → 401
- [ ] Add `/hunt`, `/hunt/*` to APP_LINK_PATHS — ONLY together with the mobile release: iOS AASA
      claims apply to every installed version, so claiming it now sends 1.0.9 users to the app home
- [x] Mobile: src/lib/hunt.ts, hunt + hunt/[token] screens, expo-camera scanner, drawer, webRoutes,
      app.json claims, `hunt` in prefs panel, locales (tsc + eslint clean; uncommitted)
      Scanner is guarded with requireOptionalNativeModule("ExpoCamera") → "update the app" on old binaries
- [ ] Native build 1.0.10 (expo.version bump) — needed for the camera scanner + Android /hunt claim
- [ ] End-to-end test after the SQL runs (create → spot → live → scan from phone)

## Open
- [x] Radius: 50 m default, per hunt
- [ ] Event-level open questions in the spec (prize, date, deadline rule, MK/EN, rules accept)

---

# Еко угостители — promote venues that recycle with ПАКОМАК

We list and promote the cafés, restaurants, bars and hotels that already sort
glass / cans with ПАКОМАК, from ПАКОМАК's data. The HoReCa sector does NOT use
the app: no orders, accounts or codes. Venues that want in get ПАКОМАК's
contact and sign with ПАКОМАК directly.
(First build was a venue pickup-order system — wrong, deleted 2026-10-21.)

## Data (`supabase/add_green_venues.sql`, run once in SQL editor)
- `green_venues`: public (name, kind, address, lat/lng, phone, website,
  glass, cans, partner_since) + admin-only (ЕДБ, pakomak_ref, contact person
  + phone, email, notes), active.
- Admin-only RLS; public reads via view `green_venues_public` (active only).

## Plan
- [x] SQL migration
- [x] Admin server actions: CRUD, import (match by pakomak_ref / ЕДБ), active, delete
- [x] Web `/recycle/eko-ugostiteli`: grouped list + "join → contact ПАКОМАК"; CTA on /recycle
- [x] Web admin `/admin/recycle`: list, form, paste/CSV import
- [ ] ПАКОМАК phone / form for the CTA (`PAKOMAK_CONTACT` in lib/recycle.ts)
- [ ] Run SQL, import ПАКОМАК's table, check on dev
- [x] Mobile hub + list (27aba1a; OTA 1.0.9 5b09b066 / 1.0.8 a862fb78)

---

# Спорт и Рекреација — club/organisation profiles

A free profile for every sport club, federation, gym and recreation
organisation in Prilep: what they offer, for whom, when, and at what price.

## Why this shape
Two patterns already exist in the repo and both are reused rather than
reinvented:

1. **Kindergarten** (`sanity/schemas/kindergarten/institution.ts` +
   `app/(main)/kindergarten/[slug]`) — an org with a slug page, sub-documents
   and a listing. The club profile is the same document shape.
2. **Event submissions** (`app/api/events/submit/route.ts`) — a citizen form
   writes an UNPUBLISHED Sanity draft with `isSubmission: true`; an editor
   reviews and publishes it from a Studio queue. This is exactly the
   "everyone fills in OUR structure" requirement: one schema, one form, no
   club ever touches Studio, and nothing appears on the site unreviewed.

## Plan
- [ ] Sanity schema `sportClub` (fields below) + `isSubmission` review queue
- [ ] Sanity schema `sportVenue`? — only if clubs share halls (decide later)
- [ ] `/sport` listing: search + filter by спорт, возраст, населба
- [ ] `/sport/[slug]` profile: распоред, ценовник, контакт, мапа, галерија
- [ ] `/sport/nov` submission form (Cyrillic-checked, structured inputs)
- [ ] `app/api/sport/submit/route.ts` — draft + rate limit, mirrors events
- [ ] Mobile: list screen + detail screen (same data, Sanity client exists)
- [ ] Nav entry under "Информации" / new "Спорт" group

## Fields (the structure everyone fills in)
Identity      назив, slug, лого, насловна слика, тип (клуб/сојуз/фитнес/
              центар), спорт(ови), година на основање
Offer         краток опис, за кого (возрасни групи: 5–9, 10–14, 15–18, 18+,
              рекреативци), пол (машки/женски/мешано), ниво (почетници/
              натпреварувачки)
Schedule      распоред: група + денови + од–до + сала  (repeatable)
Prices        ценовник: ставка + цена + период (месечно/годишно/по термин) +
              забелешка (repeatable); „прв тренинг бесплатно" flag
Where         сала/терен, адреса, населба, координати (мапа пин)
People        тренери: име, улога, фото (optional)
Contact       телефон, е-пошта, веб, Facebook, Instagram, TikTok, YouTube
Status        прима нови членови (bool), како да се зачлени, документи (PDF)
Trust         последно ажурирано (stamp), верификуван (editor-set)

## Beyond what was asked, and why
- **Возрасни групи** — the single most asked question ("од која возраст?").
- **Прима нови членови** — a profile with a full schedule but closed
  enrolment wastes a parent's phone call.
- **Последно ажурирано** — a stale schedule is worse than none; the date
  lets a reader judge it.
- **Прв тренинг бесплатно** — most clubs offer it and none advertise it.
- **Мапа пин на салата** — the club's address is often not where they train.

## Decisions (settled)
- **Editing: both.** Phase 1 is form → editor review, because at the start the
  admin will be entering most of it anyway. Phase 2 gives an approved club its
  own login with add/edit/delete over ITS OWN profile only, mirroring the
  agencies model (`profiles.agency_id` → `profiles.club_id`, writes through
  SECURITY DEFINER RPCs). The schema below is designed for that from day one —
  the document carries an owner field from the start so phase 2 is a login and
  an edit form, not a migration.
- **Кирилица: warn, don't block.** Latin input is flagged with a clear message
  but still submits; the editor normalises before publishing. Hard-blocking
  breaks email, web and Instagram fields, and a club that cannot submit its
  own name simply doesn't submit.
- **Ценовник: structured rows** — ставка + цена + период + забелешка,
  repeatable, rendered as the same table on every profile.

## Phases
**Phase 1 (now)** — schema, listing, profile page, submission form, review
queue, mobile screens. Admin and citizens can populate the whole section.
**Phase 2 (after clubs are in)** — club accounts: `club_id` on profiles, a
`/sport/[slug]/uredi` form for the owning club, admin retains override.

## Review

### What shipped
**Web (`pprilep`, uncommitted on `main`)**
- `sanity/schemas/sport/sportClub.ts` — one document type, six field groups,
  Cyrillic labels throughout. Registered in `sanity/schemas/index.ts`.
- `sanity/structure.ts` — „🏅 Спорт и Рекреација" with a „📥 Клубови за
  преглед" queue filtered to unreviewed submissions.
- `lib/sanity/sport.ts` — GROQ, types, label tables, `formatDays`.
- `app/(main)/sport/page.tsx`, `components/sport/SportDirectory.tsx`,
  `app/(main)/sport/[slug]/page.tsx`, `app/(main)/sport/nov/page.tsx`.
- `app/api/sport/submit/route.ts`, `components/layout/LeftNav.tsx`.

**Mobile (`mojprilep-mobile`, uncommitted on `master`)**
- `src/lib/sanity.ts` (sport queries appended), `src/lib/sport.ts`,
  `src/app/sport.tsx`, `src/app/sport/[slug].tsx`, route + drawer registration,
  `drawer.sport` in both locales.

### Decisions worth knowing later
- **Two gates, not one.** A profile shows only when it is published AND
  (not a submission OR reviewed). Publishing a draft by accident in Studio is
  not enough to put an unvetted club on the site.
- **`updatedAt` is rendered.** A stale training schedule is worse than none, so
  the reader is given the date and can judge it.
- **Repeating rows travel as JSON** in the multipart body and are re-validated
  row by row on the server. Malformed rows are DROPPED, not rejected: a club
  that mistyped one time still gets the rest of its schedule.
- **No brand icons.** `lucide-react` dropped them and no brand pack is
  installed, so socials are text labels beside a neutral link icon on both apps.
- **Mobile has no submission form, deliberately.** It needs a logo upload and a
  repeating price table; duplicating that is a second surface to keep in sync
  for something a club does once. The mobile screen points at the web form.

### Verified
Both repos typecheck clean. `/sport` (200, empty state + invite card) and
`/sport/nov` (200, signed-out gate) render against the running dev server; an
unknown slug renders the 404 page. Nothing is on a device yet, and no club
documents exist — the first real profile is the next check.


---

## Фаза 1б — 3 колони + новости од клубовите

- [x] `/sport` (и `/sport/nov`, `/sport/[slug]`) на 3-колонски layout — `"/sport"` додаден во `THREE_COLUMN_ROUTES` и `CUSTOM_PANEL_ROUTES` во `lib/layout.ts`
- [x] Нов Sanity тип `sportPost` (Новост од клуб) со референца кон `sportClub`, `pinned`, и истите две порти за објавување (`isSubmission` / `reviewed`)
- [x] Ред во Studio: 📥 Новости за преглед + листа „Новости од клубовите“
- [x] `fetchSportNews`, `fetchClubNews`, `fetchDaySchedule`, `todayInPrilep` во `lib/sanity/sport.ts`
- [x] Десен панел `SportRightPanel` — Тренинзи денес + Новости од клубовите + покана за клубови
- [x] `SportPanelInjector` + `app/(main)/sport/layout.tsx` (revalidate 900 — „денес“ се пресметува од часовникот)
- [x] Новости во главната колона на профилот на клубот
- [x] Мобилно: `fetchSportNews` / `fetchClubNews`, `daySlots()` и `ago()` во `src/lib/sport.ts`
- [x] Мобилно: картичка „Тренинзи денес“ + „Новости од клубовите“ над директориумот; новости на профилот
- [x] Фаза 2 — клубот сам да ги додава новостите преку својата Мој Прилеп сметка (`profiles.club_id`, `/sport/[slug]/uredi`)

### Забелешка за верификација
Десниот панел се вбризгува преку `useLayoutEffect`; во скриената Browser-плоча (`visibilityState: "hidden"`)
React ги одложува тие ажурирања, па панелот таму изгледа празен. Контролата е `/kindergarten`,
кој е во продукција и се однесува идентично во истата плоча.

## Фаза 2 — клубот сам управува со профилот

**SQL (треба ЈА да ја пуштиш во Supabase SQL editor):**
- [x] `supabase/add_sport_club_owners.sql` напишана — `profiles.club_id` + `current_user_club()` / `user_owns_club()`; логирана во `APPLIED.md` како ❓ непроверена
- [ ] **Пушти ја миграцијата**, потоа врзи клуб: `update public.profiles p set club_id = '<slug>' from auth.users u where u.id = p.id and u.email = '<club login>';`

**Веб:**
- [x] `lib/sport/owner.ts` — `getClubAccess()` / `canWriteClub()` (единствена авторизациска проверка, преку service-role)
- [x] `lib/sport/clean.ts` — извлечена валидација, споделена со `submit` (не смеат да се разидат)
- [x] `/api/sport/mine`, `/api/sport/news` (POST/DELETE), `/api/sport/news/list`, `/api/sport/club` (PATCH) — сите преку `getRequestUser` (cookie ИЛИ Bearer)
- [x] `/sport/[slug]/uredi` (404 за туѓ клуб) — `EditClubForm` + `NewsManager`
- [x] `OwnerBar` на профилот — „Уреди го профилот“ само за сопственик/админ
- [x] `components/sport/FormBits.tsx` — споделени контроли (nov + uredi)

**Мобилно:**
- [x] `fetchMyClub()` / `postClubNews()` / `deleteClubNews()` во `src/lib/sport.ts` (Bearer)
- [x] На профилот: „Нова новост“ форма + бришење — само кога `fetchMyClub()` го враќа тој slug
- [x] Целосно уредување на профилот НАМЕРНО останува на веб (лого + ценовник, еднаш во сезона)
- [x] `npx tsc --noEmit` чист во двата репоа

**Сè уште некомитирано во двата репоа.**

## Фаза 3 — целосна форма за пријава на клуб на мобилно

- [x] `submitSportClub()` во `mojprilep-mobile/src/lib/sport.ts` — POST до `/api/sport/submit` (Bearer), лого како RN file-part, распоред/ценовник како JSON
- [x] `src/app/sport/nov.tsx` — целосен паритет со веб `/sport/nov`, како **5-чекорен волшебник** (Основно · За кого · Распоред · Ценовник · Контакт) со прогрес-лента и Назад/Продолжи: тип, спортови, лого (`pickImage`), возрасни групи, пол, повторувачки термини и ценовник, контакти, соцмрежи; кирилица е предупредување, не блок
- [x] Регистрирана рута `sport/nov` во `_layout.tsx`; картичката „Имаш клуб?" сега води во апликацијата наместо на веб
- [x] `npx tsc --noEmit` чист
- [ ] На уред: провери upload на лого (HEIC→JPEG преку `pickImage`), испраќање и појава во Studio редот „📥 Клубови за преглед"
