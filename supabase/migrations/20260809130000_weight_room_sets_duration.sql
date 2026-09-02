-- #400 — record isometric holds as time, because reps cannot describe them.
--
-- A plank is not performed for repetitions. The notes log it as seconds, in
-- three different shapes across the years — a `Time (seconds)` table column, a
-- bare list under `Planks`, and `45 seconds` written out per set. Every one of
-- those is a duration.
--
-- Until now the importer had nowhere to put it. The tabular shape was reported
-- and skipped; the freeform shape slipped through the generic rep path and
-- landed 12 sets claiming 35-50 *reps* of plank, which is exactly the silent
-- mistranslation this column exists to prevent. Those rows are corrected by
-- re-running the import, which upserts them on their existing keys.
--
-- `reps` stays `not null`: a held set is one repetition of the hold, so a plank
-- is `reps = 1, duration_seconds = 45`. Making `reps` nullable instead would
-- ripple through every rollup that sums it — the daily ring, tonnage, personal
-- bests — for a single movement family, and each of those would then have to
-- decide what a null rep count means.

alter table public.weight_room_sets
  add column if not exists duration_seconds integer;

do $$
begin
  alter table public.weight_room_sets
    add constraint weight_room_sets_duration_check
    check (duration_seconds is null or duration_seconds > 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.weight_room_sets.duration_seconds is
  'How long an isometric set was held, in seconds. Null for the overwhelming '
  'majority — every set counted in repetitions. Set alongside ''reps = 1'' for a '
  'hold (a plank of 45 seconds is one repetition lasting 45 seconds), so rollups '
  'that sum reps keep working without special-casing the movement, and surfaces '
  'that can say ''45s'' read this instead of printing ''1 rep''.';
