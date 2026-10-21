# Lessons learned

Patterns and corrections from past work on **Мој Прилеп**. Read this at
the start of every session so we don't repeat past mistakes.

---

## Meta (FB/IG) auto-posting (July 2026)

Context: an approved event with `autoPost:true` didn't post. Diagnosis facts:

- **The pipeline works; the webhook was the gap.** `/api/social/publish` is
  deployed and the Meta creds are valid, but the event left *no* `social_posts`
  row → the endpoint was never called → the **second Sanity webhook** (Create/
  Update, filter `_type == "cityEvent"`, → `/api/social/publish?secret=…`) is
  NOT configured. Only the user can add it (our SANITY_WRITE_TOKEN lacks the
  `sanity.project.webhooks` scope, so we can't even list hooks). Every prior
  "successful" post was a manual trigger. **First check for a `social_posts`
  row** — its absence means "never reached the endpoint," not "code bug."
- **FB link posts show no image.** `/{page}/feed` with `link:` relies on OG
  scraping and often renders imageless. Post a **photo** (`/{page}/photos` with
  `url:imageUrl` + `caption`) to guarantee the image. The caption already
  contains the event URL as text, so the link survives.
- **`/{page}/photos` needs the PAGE access token**, not the system-user token.
  Using the user/system token → `(#200) publish_actions … deprecated`. Derive
  the page token first (`GET /{PAGE_ID}?fields=access_token`).
- **IG "Media ID is not available"** = you published the container before Meta
  finished ingesting it. Poll `GET /{creation_id}?fields=status_code` until
  `FINISHED` (bail on ERROR/EXPIRED) before `media_publish`.
- **IG requires JPEG.** A PNG cover can fail ingestion — force `.format("jpg")`
  on the Sanity image URL (or `?fm=jpg`).
- Dedupe is per-`event_id` (row existence), NOT per-network. If FB succeeds but
  IG fails, the row stays with `ig_post_id:null` and **won't auto-retry IG** —
  a re-trigger returns "already posted." Backfill IG manually if needed.

---

## PostgREST / Supabase joins (May 2026)

### Always use `profiles:user_id(...)` not `profiles(...)`
- Implicit `profiles(...)` join fails when PostgREST can't auto-detect the FK
  → query returns an error we catch → array stays `[]` → UI shows "нема data"
  despite rows existing in DB. Hardest kind of bug to find.
- ✅ Always qualify: `profiles:user_id(full_name, avatar_url, username)`.
  Applies to `issue_help_offers`, `issue_help_offer_comments`, `issue_comments`,
  `issue_affected`, `issue_helpers`.

### Postgres `date` column rejects ISO-8601 datetime strings
- Storing `"2025-05-20T10:30"` into a `date` column → Postgres error on upsert.
- ✅ Pass only `"YYYY-MM-DD"` (the raw value from `<input type="date">`).
  Fold time into a text `note` field if needed. Consider `timestamptz` column
  if date+time storage is actually required.

---

## React / state (May 2026)

### Optimistic state updates for instant mobile tap feedback
- `await db.call()` then `setState()` feels broken on mobile — color/UI
  doesn't change until the network round-trip completes.
- ✅ Call `setState(!current)` BEFORE the `await`. Revert on error if needed.
  Used for `isAffected`, `isHelper` toggles.

### `flex-1 overflow-y-auto` must pair with `min-h-0`
- Inside a flex column, a `flex-1 overflow-y-auto` child won't scroll unless
  it also has `min-h-0` (allows it to shrink below intrinsic content height).
- ✅ Pattern: `<div class="flex flex-col"><div class="flex-1 min-h-0 overflow-y-auto">`.

### Mobile keyboard hides lower fields in a fixed-height sheet — `dvh`/`vh` won't save you
- A bottom-anchored modal at `height/maxHeight: 85dvh` (etc.) keeps its full
  height when the soft keyboard opens — `dvh`/`vh` do NOT shrink for the
  keyboard, it just overlays the viewport. Lower fields (submit button, an
  "after" photo picker) end up behind the keyboard, unreachable.
- ✅ `useKeyboardInset()` (`lib/hooks/useKeyboardInset.ts`) reads the keyboard
  height from `window.visualViewport` (`innerHeight - vv.height - vv.offsetTop`)
  and you feed it as `paddingBottom` on the sheet's `overflow-y-auto` scroll
  container. The extra room lets those fields scroll up above the keyboard and
  lets the browser's focus-into-view land above it. Applied in `ActionModal`
  (solve form) and `IssueList` (mobile issue drawer, incl. inline edit).
- A `min-h-screen` full page (e.g. `IssuePageClient` mobile) scrolls naturally
  and needs no fix — only fixed-height sheets do.

### Bottom sheet slide-up animation: two-tick pattern
- Mounting a sheet at `transform: translateY(0)` gives no animation because
  the browser never saw the `translateY(100%)` start state.
- ✅ Mount with translateY(100%), then `requestAnimationFrame(() => setAnimOpen(true))`
  to fire the CSS transition on the next paint.

---

## IssueList / modal (May 2026)

### The X close button was in IssueList's own header, not in IssueDetail
- The X rendered in a separate `<div>` above IssueDetail's own header row,
  causing author + X to be on different rows.
- ✅ Remove IssueList's sticky X header; pass `onClose` prop to `IssueDetail`
  so it places the X inside its own FB-style author row.

### Shared `/issues/[id]` URL needs its own modal-style layout
- The route was wrapped in `Shell` (sidebar nav) — looked nothing like the
  in-feed popup modal.
- ✅ Created `app/issues/[id]/IssuePageClient.tsx` — client wrapper that
  replicates the exact two-panel layout (dark bg + photo + detail on desktop,
  white full-page on mobile). Pass `onClose={() => router.back()}`.
  Add `generateMetadata` for OG previews when links are shared.

Format: brief title → context (one line) → rule. Add to the top when new.

---

## Next.js / React

### "This is NOT the Next.js you know"
- Project uses Next.js 16+ with breaking changes from older versions.
- ALWAYS check `node_modules/next/dist/docs/` before writing routing,
  data-fetching, or component code from memory.

### React Compiler — never call `createClient()` directly in render
- Bare `createClient()` runs every render → memory churn + Supabase
  auth listener weirdness.
- `useRef(createClient()).current` is ALSO wrong — the `createClient()`
  call still happens every render before being passed to `useRef`.
- ✅ Correct: `const supabase = useMemo(() => createClient(), []);`

### setState inside `useEffect` body
- The `react-hooks/set-state-in-effect` lint flags synchronous setState
  calls inside effects → cascading renders.
- ✅ Wrap in `setTimeout(() => setX(...), 0)` and return `clearTimeout`
  in the cleanup. The deferred tick avoids the cascading-render warning
  and is the same pattern used everywhere in IssueDetail.tsx.

### `react-hook-form`'s `watch()` is incompatible with React Compiler
- Lint warns: "this API returns functions which cannot be memoized."
- ✅ Use `useWatch({ control, name: "field" })` for individual subscriptions.

### Component declarations must live at module scope
- "Cannot create components during render" error means a component is
  declared INSIDE another component's function body.
- ✅ Move it to module scope. If it needs state from the parent, pass
  via props or lift the state up.

### `next/image` requires explicit hosts in `next.config.ts`
- New external image hosts (CDN, etc.) must be added to `images.remotePatterns`
  before the optimizer accepts them.
- Local blob URLs from `URL.createObjectURL` can't go through `<Image>` —
  use raw `<img>` with `eslint-disable-next-line @next/next/no-img-element`.

---

## Supabase / Postgres

### RLS + grants are independent layers
- A user can read a table only if BOTH:
  1. They have a `GRANT SELECT` on the table (Data API access).
  2. The RLS policy permits the row.
- As of May/Oct 2026, new tables in `public` aren't auto-granted —
  must `GRANT` explicitly. Existing project's defaults already set via
  `ALTER DEFAULT PRIVILEGES`.

### `SECURITY DEFINER` for trusted writes
- Standard RLS hit "new row violates row-level security policy" too
  often. The fix: a `SECURITY DEFINER` Postgres function called via
  `supabase.rpc(...)` that does the insert with `auth.uid()` enforcement
  inside the function body.
- Used for: `submit_change_request`, `approve_change_request`,
  `reject_change_request`, `get_pending_change_requests`,
  `find_similar_issues`.

### SECURITY DEFINER auth checks: two recurring fail-open traps
Found in the Jun 2026 pre-launch review — `agency_set_issue_status` let
ANY anonymous user change any issue's status. Both traps below applied:
- **NULL comparison fails open.** `if not (is_admin() or reported_by =
  auth.uid() or …)`. For an anon caller `auth.uid()` is NULL, so
  `reported_by = NULL` → NULL, the whole OR → NULL, and `not NULL` → NULL,
  which is NOT true → the `raise exception` is SKIPPED. The guard passes.
  - ✅ Guard `auth.uid()` first: `if auth.uid() is null then raise …`.
    Wrap every equality in `coalesce(a = b, false)`. Never let a NULL reach
    a boolean guard.
- **Default PUBLIC execute grant.** New Postgres functions are
  `EXECUTE`-able by PUBLIC (incl. `anon`) by default. `grant execute … to
  authenticated` only ADDS — it does not remove PUBLIC. So `anon` can call
  every RPC unless you explicitly `revoke execute … from public`.
  - ✅ For every privileged RPC: `revoke execute … from public;` then grant
    only the role that needs it. Verify by calling it with the anon key.
- This is the SAME class as the `membership_tier` self-assign hole — assume
  any new privileged surface is exploitable until proven otherwise with an
  anon-key probe (see `harden_security_prelaunch.sql`).

### Column-level SELECT for PII (not just UPDATE)
- `harden_profiles_rls.sql` revoked UPDATE on privileged columns, but
  `profiles.street_name`/`district` (home location) stayed world-readable
  via the REST API because RLS is row-level, not column-level, and SELECT
  was never restricted.
- ✅ `revoke select (col, …) on public.profiles from anon;` for PII columns.
  Keep `authenticated` if the owner's own page reads them. Residual: a
  logged-in user can still read other users' values — fix with a view or
  SECURITY DEFINER accessor if that matters.

### PostgREST schema cache
- After `CREATE FUNCTION` or `CREATE TABLE`, PostgREST may not see the
  new symbol immediately. Tail every migration with:
  `NOTIFY pgrst, 'reload schema';`

### `OUT` parameters shadow table columns inside PL/pgSQL
- `RETURNS TABLE (id bigint, ...)` causes `id` to be ambiguous inside
  the function body.
- ✅ Always qualify with table alias: `r.id`, `i.title`, etc.

### `category` is a CHECK constraint, not a Postgres ENUM
- `ALTER TYPE category ADD VALUE` fails because no such type exists.
- ✅ Drop and recreate the `CHECK` constraint with the new allowed values.

### `spatial_ref_sys` cannot have RLS toggled
- PostGIS system table owned by the postgres superuser. Supabase
  Security Advisor flags it as a false positive. Mark as resolved /
  ignore.

---

## Maps / geocoding

### Never trust OSM/Nominatim street names directly
- Nominatim returns inconsistent / outdated / combined names for
  Прилеп: e.g. `"Илка Василеска (Присаѓанка)-Божана"` when the canonical
  current name is `"Илка Присаѓанка"`.
- ✅ Always run reverse-geocoded names through `matchStreet()` from
  `lib/data/streets.ts` to normalize to the local canonical entry.
  Falls back to empty if no confident match — never pollutes the form.

### A new single-segment pretty URL must be added to `RESERVED_USERNAMES`
- Added a `/prevoz` rewrite → `/utility/transport`. The page then rendered with
  3 columns + a perpetual right-panel skeleton, only on the pretty URL. Cause:
  the shell picks columns from `pathname`, and `isProfileRoute()` treats ANY
  single-segment path that isn't a reserved username as a `/<username>` profile
  (→ 3-col + sponsor panel). `/prevoz` wasn't reserved → mistaken for a profile.
- ✅ Whenever you add a top-level route segment (especially a rewrite alias),
  add it to `RESERVED_USERNAMES` in `lib/utils.ts`. Then `usesThreeColumns`
  falls through to `THREE_COLUMN_ROUTES` (add it there too if you want 3-col).
  Bonus: also stops anyone registering that word as a username.

### Diagnose layout bugs from the SHELL, not the feature inside it
- "Layout is wrong + GPS wrong" on `/prevoz` looked like a map bug; I wrongly
  blamed the route `line-offset` and removed it. The real cause was the shell
  treating the new single-segment URL as a profile route (see the
  RESERVED_USERNAMES lesson above). The offset is intended and lives fine in
  prod.
- ✅ When a whole page "looks wrong," check column/shell logic
  (`lib/layout.ts`, `Shell.tsx`) FIRST. Don't rip out a feature on a hunch —
  confirm against production (`git show HEAD:<file>`) before reverting.

### Pin reverse-geocoding is best-effort, not authoritative
- If `matchStreet()` returns null, leave the street field empty.
  Don't auto-fill garbage just to put something there.

### Local street DB is the source of truth
- `lib/data/prilep-streets.json` has Cyrillic + Latin + old names +
  search_terms (lowercased, prefix-stripped). Both `StreetAutocomplete`
  and `LocationPickerModal` use the same Fuse index for consistency.

---

## UI / UX

### iOS Safari sticky + `backdrop-blur-md` = transparent bug
- A sticky element with `backdrop-blur-md` can render the bg as fully
  transparent on iOS.
- ✅ Solid bg via Tailwind class + inline `style={{ backgroundColor }}`
  as belt-and-suspenders.

### iOS auto-zoom on inputs under 16px
- Mobile Safari zooms into focused inputs if `font-size < 16px`.
- ✅ Global rule in `globals.css` forces 16px on touch devices for
  `input`, `select`, `textarea`. Use shorter padding to make controls
  appear smaller without changing font size.

### Native `<select>` is unstyleable across iOS/Chromium
- Hover, item radius, panel-width-fit-content all impossible.
- ✅ Use the custom `<FilterSelect>` component for any visible filter
  dropdown. Keeps native `<select>` only inside forms where the wheel
  picker is acceptable UX.

### Cards on mobile: full-bleed, no border-radius
- IssueCard wrapper uses `rounded-none lg:rounded-xl border-y lg:border`
  so cards flow edge-to-edge on phone but feel like cards on desktop.

### BlurImage "stuck skeleton" on cached images
- Next.js `<Image>` doesn't always fire `onLoad` when the image is
  already in the browser cache → image stays at `opacity-0`.
- ✅ In `useEffect`, check `img.complete && img.naturalWidth > 0` and
  flip `loaded` manually. Also add `onError` to drop the skeleton even
  on broken images.

---

## DevOps / build

### `cdnUrl()` helper protects against pre-DNS deploys
- The helper falls back to the original Supabase URL when
  `NEXT_PUBLIC_CDN_HOST` is unset.
- Means: it's safe to deploy the code BEFORE the CDN domain is live.
  Just don't set the env var until SSL is provisioned, or images break.

### Always run `npx tsc --noEmit && npx eslint . --ext .ts,.tsx` before
   declaring a task complete. Exit code 0 from both = clean.

---

## UI / rendering

### A blurry HTML map marker = scaling UP, not the image
- Custom MapLibre markers built small then `transform: scale()`d UP
  rasterize at the small size and stretch → the WHOLE pill blurs
  (background, text, photo), not just the bitmap.
- Rule: build the marker at its LARGEST size and only ever scale DOWN
  (downscaling stays crisp). Don't blame the asset before checking the
  transform.

### Don't blank derived UI on a strict snap threshold
- Gating prev/next stops on `snap.gap <= SNAP_MAX_M` made the timeline
  stations vanish whenever GPS jittered off the coarse polyline.
- Rule: resolve "nearest stop" info from the projected point regardless
  of gap; reserve the threshold for deciding whether to visually snap.

## Bus timetable data (July 2026)

### Sheet stop names: sequence-matching is a guess — surface every alias
- The operator's sheets use street names that don't match our stops;
  matching by neighbour sequence is a first guess, not a fact. "Стерна"
  turned out to be Болница Кружен тек (not Завод за Здравство) and
  "Тутунски сала" its own new stop (not Амбуланта Тутунски).
- Rule: list every non-obvious alias in the reply for a one-pass review,
  and keep the alias table in busTimetables.ts' header comment current.

## Workflow

### One "push" is not standing permission to keep pushing
- After the user says "push the code", commit+push THAT, then stop.
  Follow-up fixes need their own explicit go-ahead — they may want to
  review locally first.

---

## How to add new lessons

When the user corrects something I did:

1. Identify the underlying pattern (not just the specific fix).
2. Add a section here with a short title, the one-line context, and
   the rule.
3. If it overlaps an existing lesson, EDIT that one rather than adding
   a new section. Better one good rule than five overlapping ones.
4. Keep it short. If a lesson grows past ~5 lines, split it.

## Facebook Page posts need a *Page* access token, not the user token
Context: /api/social/publish IG posts worked but FB `/{page}/feed` failed with
error #200 ("requires pages_read_engagement and pages_manage_posts") even though
the System User token had both perms.
Rule: Instagram publishing works with the user/System-User token, but posting to
a Page feed requires the **Page** access token. Derive it once via
`GET /{page-id}?fields=access_token&access_token=<user-token>` and use that for
`/{page-id}/feed`. Page tokens minted from a never-expiring System User token
also don't expire, so cache it.

## A dead IG media id in the ledger may mean "deleted", not "never posted"
Context: after auto-posting an event, its `social_posts.ig_post_id` returned
"Object does not exist" (subcode 33) and the post wasn't in the account's
`/media` list. I concluded the IG auto-publish had silently failed — but the
user had actually deleted the post; it *did* publish.
Rule: `media_publish` only returns an id on success, so a non-resolving IG id +
absence from the feed most likely means the post was **published then deleted**,
not that posting failed. Reconcile with the user (ask for the post link / whether
they deleted it) before assuming a code bug.

## An "idle/save-cost" pause must not freeze a view whose purpose is monitoring
Context: I added an idle auto-pause (3 min untouched → stop polling) to the bus
map to cap request cost on forgotten tabs. But the owner's admin view exists to
*watch the fleet*: when Line 1 came back online while the owner's tab sat
untouched, the map stayed frozen on the stale (offline) frame — a greyed bus
looks identical to "my map stopped checking," so the owner never noticed.
Rule: before adding a "pause when idle" optimization, ask *what breaks if this
view goes stale*. For a live-monitoring surface, degrade to a **slow heartbeat**,
never a hard stop — the loop must always eventually pick up state changes without
user interaction. Reserve the full stop for views where staleness is harmless
(and where the request cost actually justifies it, e.g. anonymous/cached tabs).

## Silent deploy failures: read the config error before blaming the plumbing
Context: pushes to `main` stopped producing Vercel deployments. I diagnosed a
broken GitHub↔Vercel integration and sent the user through disconnecting and
reconnecting the Git repo, auditing GitHub App permissions, inspecting the
Webhooks page, and pushing several empty commits. None of it was relevant. The
real cause: I had added an hourly cron (`"0 * * * *"`) to `vercel.json`, and the
account is on the Hobby plan, which allows at most one cron run per day. Vercel
validates `vercel.json` *before creating a deployment*, so every push was
rejected outright and produced **no entry at all** in the Deployments list — no
error row, no queued build. That gap looks exactly like a dead webhook.
`npx vercel --prod` printed the reason in one line; the dashboard never did.
Rule: when a deploy silently doesn't happen, suspect **the config I most
recently changed** before suspecting infrastructure — diff `vercel.json` /
`next.config.ts` against the last commit known to have deployed. "No entry in
the list" ≠ "the trigger didn't fire"; it also means "rejected at validation" (a
failed *build* shows an Error row, a failed *config validation* shows nothing).
Reach for the CLI early. And note a passing local `npm run build` proves only
that the *code* is fine — it is not evidence the deploy should work.

## Platform limits constrain feature design, not just config
Context: same incident. Dropping the cron to daily wasn't a one-line schedule
change. The reminder logic gated on `min(11:00, start - 3h)`, which assumes a
later run exists to catch an event once its window opens. Under a daily schedule
the single morning run judges every evening event not-yet-due and nothing fires
again that day — the feature would have looked healthy while silently sending
nothing.
Rule: when forced to change a schedule, re-derive whether the logic riding on it
still holds. Ask "what here assumes this runs again soon?"

## Verify a path from the right directory before concluding a file is missing
Context: I ran `test -f tasks/lessons.md`, got "MISSING", and wrote a fresh file
— destroying 370 lines of existing lessons. The check had run from
`ppp/` rather than `ppp/pprilep/`, a cwd reset this repo hits repeatedly.
Rule: before creating a file that would overwrite one, confirm with a
repo-relative check that cannot silently target the wrong root — `git ls-files
<path>` or an absolute path. If a file is expected to exist and appears not to,
treat that as a cwd bug until proven otherwise.

## A new page is not done until it is registered in lib/layout.ts
Context: I added /taxi, /bus-station and the Паркинзи section, verified them with
tsc + `next build`, and reported them finished. All three rendered in the
2-column fallback with no right panel, because `THREE_COLUMN_ROUTES` is an
opt-in list and I never added them. The build cannot catch this — an unregistered
route is a valid route, just a differently-shaped one.
Rule: when adding a route under app/(main), edit `lib/layout.ts` in the same
change. Decide explicitly between the default right panel (add to
THREE_COLUMN_ROUTES only) and an injected one (also add to CUSTOM_PANEL_ROUTES).
"It compiles" is not evidence the layout is right.

## A mobile change is invisible until it is built or OTA-published
Context: I described the parking permit section as added while the user was
looking at an App Store build of 1.0.7. Editing a file in mojprilep-mobile/
changes nothing on any device — unlike the web, where a running server picks the
edit up on the next render.
Rule: when reporting mobile work, say what has to happen for it to become
visible (dev client + reload, `eas update` against the matching appVersion, or a
new build). Never let "added" stand for "shipped" on the app.

## Deciding what a thing should do is not building it
**2026-08-26** — Asked to point the per-route "Купи билет" at the same URL as the
top button, I replied that `TICKETS_URL` was already the single constant and
called it settled. The user came back with "the button is still missing" — the
per-route button had never been rendered at all. Confirming a design decision
reads as completion to nobody but me. When a request names a UI element, the
turn is not finished until that element exists in the DOM and I have checked it
there.

## A component gated on an effect can render nothing at all

`NextDepartures` was written as `useState<Clock | null>(null)` plus a
`useEffect` that filled it in, returning `null` until then. On a page with
`revalidate = 3600` it simply never appeared: no console error, correct import,
correct JSX. The fix was to seed the state from the clock itself
(`useState(prilepNow)`) and put `suppressHydrationWarning` on the list.

**Rule:** never gate a component's entire render on state an effect fills in.
Seed the initial value synchronously and let the effect refine it. "Renders
nothing, throws nothing" is the signature of this bug — look at the state
initializer before looking anywhere else.

## Two data sources means the reader sees the disagreement, not the design

The bus screen showed the station's own sheet grouped by carrier AND the
pelagonija.mk portal list underneath. The portal prints the minute a coach
passes THROUGH Prilep, so "12:47" appeared under a section whose own times were
all different. The user read it as random numbers — reasonably.

**Rule:** when two sources cover the same thing, do not stack them and expect
the reader to reconcile them. Pick the authoritative one for the cases it
covers and drop the other there entirely (and stop fetching it). Also: a
browse list must be built from what we actually have — the "all destinations"
list was the portal's 137 stations when only 18 had timetables.

## A hidden browser tab is not a broken component

While verifying the new `/sport` right panel, the injected panel never appeared in the
Browser pane — the third column kept rendering the skeleton even though a `console.log`
proved the `useLayoutEffect` ran and `setOverridePanel` was the real function, not the
context default. Four rounds of instrumentation went into the component before the
decisive check: `document.visibilityState` was `"hidden"`, and `/kindergarten` — the same
pattern, live in production for months — behaved exactly the same way in that pane.

**Rule:** before instrumenting new code that "doesn't render", run the *existing*
equivalent through the same harness. If the known-good path fails identically, the
harness is the variable, not the change. And on any headless/hidden pane, check
`document.visibilityState` first — React defers non-urgent updates there, so an
effect can run without its state update ever painting.

## „Мобилно ≠ второкласно" — не решавај наместо корисникот дека нешто е само за веб

Двапати одлучив дека формата за пријава на клуб и уредувањето на профилот „остануваат
на веб" зашто имаат upload на лого и повторувачки редови — фиделно, но корисникот
всушност очекуваше целосна форма и на телефон („its available only on the web, its
missing on the mobile app"). Fiddly-to-build не е причина да се скрати опсегот наместо
корисникот.

**Зошто:** намалувањето на опсегот е одлука на корисникот, не моја. RN веќе има
`pickImage()` (HEIC→JPEG) и chip-контроли; „тешко за градење" беше преценето.

**Како да се примени:** кога веб има форма што ја нема мобилно, изгради ја со ист
endpoint (`getRequestUser` прима Bearer) наместо да ставиш линк кон веб — освен ако
корисникот експлицитно не побара линк. Ако сепак изоставам дел, кажи го јасно и
прашај, не одлучувај тивко.

## Confirm the concept, not just the details (Oct 2026)

Context: "Рециклажа за угостители". The user said "venue orders" and I built a
venue-facing pickup-ordering system (orders, secret codes, QR, admin queue).
They corrected twice: venues don't apply, then — the HoReCa sector isn't
involved at all; we just list/promote green venues from ПАКОМАК's data.

- **Before building a multi-part feature, restate WHO uses it and WHAT they
  do in one sentence and get a yes.** My clarifying questions asked about
  details (streams, fulfiller, platforms) on top of an assumed concept.
- When a correction lands mid-build, re-question the whole premise, not just
  the one part the user pointed at.
