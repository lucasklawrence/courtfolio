-- Let a set record its load without claiming a rep count, and group the drops
-- of one working set together (#440).
--
-- A rack run is a single set taken to failure at a descending series of loads:
-- `Rack Run 35,30,25,20 / Set 1: 30, 15`. The note records the weights and
-- never the reps, because each drop simply went until it couldn't. The #435
-- import had nowhere to put "not counted" — `reps` was `not null` with a
-- `> 0` check — so it wrote `1` for every drop. That is 65 rows asserting a
-- rep count that was never measured, feeding rep totals and computing tonnage
-- as 1 x load instead of the work actually done.
--
-- `null` is the honest answer, and it is a different statement from zero: zero
-- means a set with no reps, null means a set whose reps nobody wrote down.
--
-- `set_group` collapses the drops back into the set they were. Rows sharing a
-- (workout_id, exercise, set_group) are one working set, so a two-pass rack run
-- counts as two sets rather than the five rows it takes to describe them.
-- Null means "this row is its own set", which is every ordinary set and stays
-- the default.

alter table weight_room_sets
  alter column reps drop not null;

-- Recreate rather than relax in place: the old constraint has no room for null.
alter table weight_room_sets
  drop constraint if exists weight_room_sets_reps_check;

alter table weight_room_sets
  add constraint weight_room_sets_reps_check
  check (reps is null or reps > 0);

alter table weight_room_sets
  add column if not exists set_group smallint;

alter table weight_room_sets
  drop constraint if exists weight_room_sets_set_group_check;

alter table weight_room_sets
  add constraint weight_room_sets_set_group_check
  check (set_group is null or set_group >= 0);

comment on column weight_room_sets.reps is
  'Repetitions in the set. Null means the count was never recorded — a set taken to failure without counting — which is distinct from zero.';

comment on column weight_room_sets.set_group is
  'Rows sharing (workout_id, exercise, set_group) are one working set, e.g. the drops of a rack run. Null means the row is a set on its own.';
