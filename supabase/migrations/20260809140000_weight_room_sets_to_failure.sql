-- #435 — mark a set whose rep count was never recorded because it went to failure.
--
-- A rack run is a drop set of dumbbell curls: pick up the 35s, curl to failure,
-- drop to the 30s, again, and so on down the rack. The notes record the loads
-- that were run (`Set 1: 25, 20, 10`) and never the reps, because the rep count
-- isn't the point — the point is that each drop went until it couldn't.
--
-- `weight_room_sets.reps` is `not null check (reps > 0)`, so until now such a
-- set had nowhere to live and #400 dropped all 25 of them. Making `reps`
-- nullable would model it purely but ripples through 87 call sites across 21
-- files — every ring, streak, tonnage and achievement rollup would have to
-- decide what a null rep count means, for the sake of ~32 sets.
--
-- So the same shape the duration column already uses: `reps = 1` meaning "one
-- set was performed", and a flag saying the count is unrecorded. Rep totals are
-- then understated by a known, small amount rather than wrong in an unbounded
-- way, and every existing rollup keeps working untouched. Surfaces read the
-- flag and print "to failure" instead of "1 rep".

alter table public.weight_room_sets
  add column if not exists to_failure boolean not null default false;

comment on column public.weight_room_sets.to_failure is
  'True when the set was taken to failure and its rep count was never recorded '
  '(#435). Such a set stores ''reps = 1'', meaning one set happened rather than '
  'one repetition — so rep rollups understate it by a known amount instead of '
  'counting a number nobody wrote down. Surfaces should render ''to failure'' '
  'rather than the literal rep count. Mirrors how ''duration_seconds'' handles '
  'isometric holds.';
