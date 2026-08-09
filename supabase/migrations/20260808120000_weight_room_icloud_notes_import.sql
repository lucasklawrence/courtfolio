-- #400 — let workouts transcribed from iCloud Notes land in the Weight Room.
--
-- Two years of training (2022-2024) were logged in Apple Notes: one note per
-- session, titled with the template it ran, holding a `Set | Weight | Reps`
-- table per exercise. #413 already imported the Apple Health side of those same
-- sessions — 507 Traditional Strength Training workouts that know *when* and
-- *how hard* but nothing about what was lifted. The notes are the missing half.
--
-- The two halves line up far more tightly than "same day". Spot-checking
-- 2024-04-16: the Health workout ran 21:39:00-22:10:42 local, and the note was
-- created 21:40:38 and last edited 22:07:12 — the note window sits entirely
-- inside the workout window, because the note was typed *during* the session,
-- one row at a time. So the importer attaches sets to the existing
-- `apple_health` row whose window overlaps, rather than inventing a second
-- session for the same hour. `weight-room-supabase.mjs` anticipated exactly
-- this: an imported session can acquire hand-authored sets later.
--
-- 'icloud_notes' as a workout source therefore covers only the residue — a note
-- with no Health counterpart (watch left on the charger, or a session predating
-- the watch).

alter table public.weight_room_workouts
  drop constraint if exists weight_room_workouts_source_check;

alter table public.weight_room_workouts
  add constraint weight_room_workouts_source_check
  check (source in ('manual', 'apple_health', 'icloud_notes'));

comment on column public.weight_room_workouts.source is
  'Where this session came from. ''manual'' — recorded through the app''s live '
  'recording surface (#374). ''apple_health'' — imported from a Health export '
  '(#413); knows its window and HR but usually carries no sets, though #400 may '
  'attach transcribed ones. ''icloud_notes'' — transcribed from an Apple Notes '
  'session log (#400) that had no Health workout to attach to.';

-- Provenance on the sets themselves, not just their workout.
--
-- `resolveAchievements` recomputes every badge from the full set history, and
-- streaks and all-time bests span the whole log — so backfilling two years of
-- training silently re-scores everything. That is not wrong (it *is* the
-- history), but per #400 it has to be a decision the surfaces can make rather
-- than a surprise on the next page load, and that requires being able to tell
-- an imported set from a logged one.
--
-- A column here rather than a join through `workout_id` because the join cannot
-- answer it: grease-the-groove rep lists transcribed from these notes are
-- deliberately *not* attached to a workout (see below), so they would come back
-- indistinguishable from sets logged in the app today.
alter table public.weight_room_sets
  add column if not exists source text not null default 'manual',
  add column if not exists import_key text;

do $$
begin
  alter table public.weight_room_sets
    add constraint weight_room_sets_source_check
    check (source in ('manual', 'icloud_notes'));
exception
  when duplicate_object then null;
end $$;

comment on column public.weight_room_sets.source is
  'Where this set came from. ''manual'' — logged through the app or the '
  'log-workout skill. ''icloud_notes'' — transcribed from a historical Apple '
  'Notes session log (#400). Surfaces that recompute over all-time history '
  '(achievements, streaks, personal bests) can scope on this rather than '
  'silently re-scoring years of backfilled training.';

-- Idempotency for imported sets.
--
-- Unlike workouts, a set has no natural key: the same movement at the same
-- weight for the same reps legitimately appears several times in one session,
-- and `logged_at` is derived from the note's window rather than observed, so it
-- cannot separate them. The importer therefore mints a deterministic key from
-- the note identity and the set's position within it
-- (`icloud:<title>:<date>:<exercise>:<n>`), which makes a re-run an upsert
-- instead of a second copy of the same two years.
--
-- Nullable, and unique over the non-null values only — Postgres allows repeated
-- NULLs in a unique index, so every manually logged set (which has no import
-- key and never will) stays unconstrained. Full rather than partial for the
-- same reason as `weight_room_workouts_source_started_at_key`: supabase-js's
-- `onConflict` names columns and cannot restate a WHERE predicate, so a partial
-- index fails the upsert outright.
create unique index if not exists weight_room_sets_import_key_key
  on public.weight_room_sets (import_key);

comment on column public.weight_room_sets.import_key is
  'Deterministic natural key for a set transcribed by the #400 importer, of the '
  'form ''icloud:<note title>:<note date>:<exercise slug>:<index>''. Null for '
  'every manually logged set. Backs the importer''s upsert so re-running it '
  'converges instead of duplicating.';
