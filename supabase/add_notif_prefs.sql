-- Per-device notification category preferences.
--
-- Until now push_subscriptions had a single master switch (`enabled`). This
-- adds granular per-category opt-outs so a device can keep push ON but silence
-- individual categories (games/ЗборЧе, city events, sport, utility outages,
-- parking). The mobile account panel writes this via /api/push/prefs.
--
-- Shape: a JSONB object of { <category>: boolean }. A category is ON unless its
-- key is explicitly false, so:
--   - NULL / {}      → opted into everything (the backfill default for every
--                      device that registered before this feature existed)
--   - { "games": false } → everything except ЗборЧе nudges
-- Senders read this column and drop tokens whose category flag is false; an
-- absent key always means "send" (see lib/push/prefs.ts).
--
-- Idempotent — safe to run more than once.

alter table public.push_subscriptions
  add column if not exists notif_prefs jsonb;
