-- Repair `class_type` for sessions that raced the #271 backfill.
--
-- The original migration (20260704120000_otf_sessions_class_type.sql) added the
-- columns and backfilled every then-existing row. It was applied at
-- 2026-07-04 16:03 UTC. A pull at 2026-07-04 19:22 UTC — ~3h later, still
-- running the pre-#271 importer, which did not yet stamp `class_type` — then
-- inserted three real classes (2026-07-02, 07-03, 07-04, all 671-753 cal with a
-- treadmill block). They landed in the gap: too late for the backfill, too early
-- for the class-type-aware ingest. Every pull from 2026-07-09 on stamps
-- correctly, so this is a one-time window, not an ongoing ingest bug.
--
-- Symptom this fixes: those rows matched no class-type chip, so selecting any
-- type silently dropped them from the log *and* every aggregate, with nothing in
-- the counts to indicate it. They read as missing workouts.
--
-- The CASE is the same expression as the original backfill (keep both in sync
-- with classifyOtfClassType in scripts/lib/otbeat-class-type.mjs). The extra
-- `treadmill is not null or rower is not null` guard is what makes this a repair
-- rather than a re-run: it touches only rows with a machine block, so the
-- 2026-05-30 belt malfunction — correctly `excluded`, correctly `class_type`
-- null, no machine data — is left alone. Re-runnable and idempotent: once
-- stamped, `class_type is null` no longer matches.

update public.otf_sessions
set class_type = case
  when treadmill is not null and rower is null then 'Tread-focused'
  when treadmill is null and rower is not null then 'Row-focused'
  else case
    when (
      coalesce(nullif(split_part(rower ->> 'time', ':', 1), '')::int, 0) * 60
        + coalesce(nullif(split_part(rower ->> 'time', ':', 2), '')::int, 0)
    ) > (
      coalesce(nullif(split_part(treadmill ->> 'time', ':', 1), '')::int, 0) * 60
        + coalesce(nullif(split_part(treadmill ->> 'time', ':', 2), '')::int, 0)
    ) then 'Row-focused'
    else 'Tread + Row'
  end
end
where class_type is null
  and (treadmill is not null or rower is not null);
