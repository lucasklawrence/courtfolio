-- Add a coarse, inferred class-type label to OTbeat sessions, plus a manual
-- override column (#271).
--
-- The OTbeat "Studio Workout Summary" email carries no class-type token (no
-- "2G"/"3G"/"Strength 50"/etc. anywhere in the body), so we can't parse the
-- studio's official format name. Instead the ingest path infers a coarse label
-- from which machine blocks the class logged and how the tread/rower time
-- splits (scripts/lib/otbeat-class-type.mjs → classifyOtfClassType):
--   * no treadmill AND no rower  -> 'Strength / Floor' (>=100 cal) else NULL
--   * treadmill only             -> 'Tread-focused'
--   * rower only                 -> 'Row-focused'
--   * both, rower time > tread    -> 'Row-focused'
--   * both, otherwise            -> 'Tread + Row'
-- The NULL case is the belt-malfunction sentinel — already `excluded` by #268,
-- so it never reaches an aggregate.
--
-- Two columns, mirroring the #268 excluded pattern:
--   * class_type          — the auto-inferred coarse label, written at ingest.
--   * class_type_override — nullable, set MANUALLY in Supabase to the real
--                           format name ('2G', 'Strength 50', …) when known.
-- The OTF view uses `coalesce(class_type_override, class_type)` as the
-- effective type (effectiveOtfClassType in lib/training-facility/otf.ts).
-- Because the importer is append-only (upsert with ignoreDuplicates), both auto
-- columns are only written on a row's first insert, so a manual override is
-- never clobbered by a re-pull.
--
-- All DDL is idempotent (add column if not exists) so re-applying on a fresh
-- dev project or after a branch reset is a safe no-op.

alter table public.otf_sessions
  add column if not exists class_type text;

alter table public.otf_sessions
  add column if not exists class_type_override text;

comment on column public.otf_sessions.class_type is
  'Coarse class-type label inferred at ingest from the machine signature (tread/rower blocks + time split) by classifyOtfClassType (#271). One of ''Tread + Row'', ''Tread-focused'', ''Row-focused'', ''Strength / Floor'', or null for a near-zero malfunction. NOT OTF''s official format name — see class_type_override.';

comment on column public.otf_sessions.class_type_override is
  'Manually-set real OTF format name (e.g. ''2G'', ''Strength 50'') that wins over the inferred class_type. Null unless a human sets it in Supabase; never written by the append-only importer.';

-- Backfill class_type for rows that predate this feature. Keep this CASE in
-- sync with classifyOtfClassType (scripts/lib/otbeat-class-type.mjs). The
-- both-present branch compares rower vs treadmill "MM:SS" total time converted
-- to seconds. `where class_type is null` makes the backfill re-runnable and
-- never re-stamps a row that already has a value.
update public.otf_sessions
set class_type = case
  when treadmill is null and rower is null then
    case when coalesce(calories, 0) >= 100 then 'Strength / Floor' else null end
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
where class_type is null;
