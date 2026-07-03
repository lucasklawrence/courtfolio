-- Mark anomalous OTbeat sessions invalid/excluded, without deleting them (#268).
--
-- Some rows in otf_sessions aren't real workouts — e.g. an equipment
-- malfunction where the OTbeat belt logs a "class" with near-zero output and
-- no treadmill or rower block (the 05/30/2026 Jacob Buckenmeyer class: 4
-- calories, 0 splat, no machine data). Deleting them would lose the audit
-- trail and re-appear on the next email re-pull; instead we flag them so the
-- OTF view leaves them out of every aggregate and chart while the session log
-- still lists them, muted.
--
-- `excluded` defaults to false so every existing and future row is valid until
-- proven otherwise. The ingest path (`recordToRow` → `classifyOtfAnomaly` in
-- scripts/lib/otbeat-anomaly.mjs) sets the flag at first insert for new
-- anomalies; the backfill below covers rows that predate the feature. Because
-- the importer is append-only (upsert with ignoreDuplicates), a manual
-- override set later in Supabase is never clobbered by a re-pull.
--
-- All DDL is idempotent (add column if not exists) so re-applying on a fresh
-- dev project or after a branch reset is a safe no-op.

alter table public.otf_sessions
  add column if not exists excluded boolean not null default false;

alter table public.otf_sessions
  add column if not exists excluded_reason text;

comment on column public.otf_sessions.excluded is
  'True when the session is invalid/anomalous (e.g. equipment malfunction) and must be left out of aggregates and charts. The row is kept, not deleted; the session log still shows it, muted. Auto-set at ingest by classifyOtfAnomaly (#268) and overridable manually.';

comment on column public.otf_sessions.excluded_reason is
  'Human-readable reason the session was excluded; prefixed "auto:" when set by the ingest heuristic. Null when the session is valid.';

-- Backfill rows that predate this feature. Keep the WHERE clause in sync with
-- classifyOtfAnomaly (scripts/lib/otbeat-anomaly.mjs): no machine block AND
-- near-zero calories AND ~zero splat. `and not excluded` makes the backfill
-- re-runnable and never stomps a manual override.
update public.otf_sessions
set
  excluded = true,
  excluded_reason = 'auto: near-zero output with no treadmill or rower block (likely equipment malfunction)'
where not excluded
  and treadmill is null
  and rower is null
  and coalesce(calories, 0) < 25
  and coalesce(splat, 0) <= 1;
