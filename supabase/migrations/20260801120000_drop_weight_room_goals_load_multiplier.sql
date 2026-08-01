-- Drop the dead `weight_room_goals.load_multiplier` column (#384, follow-up to #373).
--
-- #373 moved this column to `weight_room_exercises` — it describes how a
-- movement is performed, so it has to exist for movements that have no daily
-- goal at all. The data layer has joined it back onto `ExerciseGoal` from the
-- catalog since that migration, and `GOALS_COLUMNS` stopped selecting the goals
-- copy in the same commit, so nothing has read this column since.
--
-- It could not be dropped in #373 itself: production applies migrations *ahead*
-- of the code that lands with them (see CLAUDE.md), so dropping it while the
-- deployed build still named it in its `select` would have broken the live
-- Weight Room read for the window between apply and promote. That window has
-- closed — production promoted the catalog build (4403960) before this ran.
--
-- Idempotent, and harmless on a fresh project where the column never existed.

alter table public.weight_room_goals
  drop column if exists load_multiplier;
