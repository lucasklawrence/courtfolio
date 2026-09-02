-- #413 — let Apple Health strength workouts land as Weight Room sessions.
--
-- `scripts/preprocess-health.py` has kept three activity types since the cardio
-- import shipped and dropped the rest, so 507 Traditional Strength Training
-- sessions spanning 2018-01-08 to 2026-07-03 have never been ingested — more
-- sessions than running. They are lifting sessions, and #374 already models
-- exactly what they carry: a start, an end, and a duration.
--
-- What they do NOT carry is sets. Apple Health records that a workout happened,
-- not what was done in it, and only a small subset has a corresponding iCloud
-- note (#400). A setless imported session is therefore the expected steady
-- state, not a gap waiting to be filled — which is why `source` exists: the
-- surfaces need to say "imported, sets not recorded" rather than rendering the
-- empty state meant for a session someone abandoned.

alter table public.weight_room_workouts
  add column if not exists source text not null default 'manual',
  add column if not exists avg_hr numeric,
  add column if not exists max_hr numeric;

do $$
begin
  alter table public.weight_room_workouts
    add constraint weight_room_workouts_source_check
    check (source in ('manual', 'apple_health'));
exception
  when duplicate_object then null;
end $$;

comment on column public.weight_room_workouts.source is
  'Where this session came from (#413). ''manual'' — recorded through the app''s '
  'live recording surface, and carries its own sets. ''apple_health'' — imported '
  'from a Health export, which records that a workout happened but not what was '
  'done in it, so it usually has no sets at all. Mirrors the same convention '
  'body_mass_trend already uses.';

comment on column public.weight_room_workouts.avg_hr is
  'Average heart rate over the session, BPM. Populated for imported sessions from '
  'the raw Health sample stream; null for manually recorded ones, which capture no HR. '
  'For an imported session this and duration are the only intensity signal there is.';

comment on column public.weight_room_workouts.max_hr is
  'Peak heart rate over the session, BPM. Same provenance as avg_hr.';

-- Idempotency. The export's <Workout> elements carry no UUID — only startDate,
-- endDate, duration and sourceName — so the natural key is the instant the
-- session began, which two lifting sessions cannot share. Without this, every
-- re-export would duplicate 8.5 years of history.
--
-- Deliberately NOT partial. A `where source <> 'manual'` predicate would scope
-- it to imported rows, which reads as the tidier constraint — but Postgres only
-- infers `ON CONFLICT (source, started_at)` from a *full* unique index, and
-- supabase-js's `onConflict` option takes column names with no way to restate a
-- predicate. A partial index therefore fails the upsert outright with "no
-- unique or exclusion constraint matching the ON CONFLICT specification",
-- which is how this was caught: rehearsing the import against staging.
--
-- Covering manual rows too costs nothing. `started_at` defaults to `now()` at
-- microsecond precision, and two sessions of the same provenance beginning at
-- the same instant is not a thing that happens — nor a thing that would mean
-- anything if it did.
create unique index if not exists weight_room_workouts_source_started_at_key
  on public.weight_room_workouts (source, started_at);
