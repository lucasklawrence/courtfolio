-- Add a `source` column to cardio_body_mass_trend so the manual morning
-- weigh-in (log-weight skill, via /api/admin/cardio/trends) and the Apple
-- Health archive import (scripts/import-health.mjs) can coexist in one table
-- without the import overwriting or pruning manual entries.
--
-- Background: the full "Export All Health Data" import treats its payload as
-- authoritative for every table it touches — it upserts each day and then
-- prunes any day NOT in the batch (see `pruneStaleRows`). Apple Health body
-- mass is sparse (only days with a synced scale / manual HealthKit entry), but
-- the log-weight skill records weight daily, so every full import silently
-- deleted the skill-only days and overwrote shared days with the scale value.
-- This column lets the import scope its upsert + prune to
-- `source = 'apple_health'` and leave manual rows untouched.
--
-- Values: 'manual' (log-weight skill) | 'apple_health' (import + auto-sync).
-- Existing rows default to 'apple_health'; the recovery backfill re-tags the
-- known skill-logged days as 'manual'. Idempotent (`add column if not exists`).

alter table public.cardio_body_mass_trend
  add column if not exists source text not null default 'apple_health'
    check (source in ('manual', 'apple_health'));

comment on column public.cardio_body_mass_trend.source is
  'Origin of the measurement: ''manual'' (log-weight skill / manual upsert endpoint) or ''apple_health'' (archive import / auto-sync). The full import upserts and prunes only source=''apple_health'' rows, so manual morning weigh-ins are never overwritten or deleted by a re-import.';
