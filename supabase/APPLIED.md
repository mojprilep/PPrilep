# Which SQL has been applied?

The scripts in this folder are run **by hand** in the Supabase SQL editor. Nothing
tracks that, so this file is the record. It is only as honest as the last person
to edit it.

**Adding a script? Add a row here in the same commit.** Leave the status as
`❓ unverified` if you haven't run it yet — an unverified row is useful, a missing
row is not.

## Verifying

Paste [`check_applied.sql`](check_applied.sql) into the SQL editor and run it.
It's read-only and reports `OK` / `MISSING` for every table and function these
scripts create, plus three things a name check can't answer: which version of the
help-offer cap is live, whether the push webhook trigger exists, and whether
`pg_net` is installed.

Then bring this table in line with what it told you.

## Why this exists

`add_push_subscriptions.sql` was never applied. Push registration failed with a
500, the mobile client swallowed the error, and the app told users notifications
were **on** for devices that could never receive one. It went unnoticed for
weeks. Every symptom traced back to one table that was never created.

The first run of `check_applied.sql` found a second instance of exactly that bug:
`add_push_broadcasts.sql` had never been applied, so every city event push failed
with a 500 and nobody noticed. Fixed the same day.

## Status

Verified against production with `check_applied.sql` on **2026-08-01**. Every
script not listed separately came back OK on that run.

| Script | Status | Notes |
| --- | --- | --- |
| `schema.sql` | ✅ applied | Base schema. |
| `add_evn_provider.sql` | ✅ applied | Applied 2026-08-04. Adds the `evn` agency + `electricity` provider. |
| `add_manual_partners.sql` | ✅ applied | Applied 2026-08-04. Adds the `partners` table and fixes `admin_approve_membership` silently no-opping on requests with no account. |
| `add_partner_logos.sql` | ❓ unverified | Creates the admin-only `partner-logos` storage bucket. Not yet run. |
| `add_push_subscriptions.sql` | ✅ applied | Applied 2026-08-01, after the failure above. |
| `add_notifications.sql` | ✅ applied | Feed + bell read from this. |
| `add_agency_posts.sql` | ✅ applied | |
| `add_agency_post_schedule.sql` | ✅ applied | Current 9-arg `create_agency_post`. |
| `add_help_offers.sql` | ✅ applied | All three tables present. Backs the mobile Помогни sheet. |
| `update_help_offer_limit.sql` | ✅ applied | Date cap is 3, confirmed by reading the function body. The mobile sheet's `/3` is correct. |
| `add_push_broadcasts.sql` | ✅ applied | Applied 2026-08-01, after the audit found it missing. Without it `/api/push/event` returned 500 and no city event ever pushed. |
| `add_sport_club_owners.sql` | ❓ unverified | Adds `profiles.club_id` + `current_user_club()` / `user_owns_club()`. Needed before a club can edit its own profile or post news. Not yet run. |
| `pause_issue_reporting.sql` | ✅ applied | **Intentionally active.** Reporting is paused. |
| `restore_issue_reporting.sql` | ⛔ not applied | Deliberate — do not run until reporting is being re-enabled. Pair it with `REPORTING_ENABLED` in `components/ui/ActionModal.tsx`. |
| `add_zborche_leaderboard.sql` | ❓ not yet run | Creates `zborche_results` (one row per player per day, insert-only) + the public `zborche_leaderboard()` function for the ЗборЧе cross-user scoreboard. Run to enable the leaderboard. |

## Not in this folder

Created through the Supabase dashboard, so no script exists for them:

- **`push_notify` webhook** — `public.notifications` INSERT → `https://www.mojprilep.mk/api/push/notify`, authenticated with an `x-webhook-secret` header carrying `CRON_SECRET`. Created 2026-08-01. Needs the Database Webhooks integration and the `pg_net` extension.
