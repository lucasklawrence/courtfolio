-- Record which template a workout is running, by id (#376).
--
-- The live panel first resolved the template by matching `title` against
-- template names, which is wrong in three ways that all end with sets attributed
-- to the wrong slots or silently treated as freestyle:
--
--   * Template names are not unique — nothing in #375 constrains them — so two
--     templates sharing a name always resolve to whichever came first.
--   * Renaming a template while its workout is open loses the prescription on
--     the next reload.
--   * `title` is free text a user can edit; it was never meant to be a key.
--
-- `on delete set null` rather than cascade or restrict: deleting a template
-- should leave the session and its sets intact and merely untemplated, matching
-- how `weight_room_sets.template_slot_id` already degrades. A finished workout
-- is a record of what happened, and template maintenance months later must not
-- rewrite or destroy it.
--
-- `title` stays, and stays free text — it's the human label ("Push Day", or
-- something typed for a freestyle session), not the link.
--
-- No backfill: the column lands empty, and the one workout that could exist
-- before this is a test session. Sessions without an id fall back to matching
-- on title, so nothing that predates this loses its prescription.
--
-- Idempotent.

alter table public.weight_room_workouts
  add column if not exists template_id uuid null
  references public.weight_room_workout_templates(id) on delete set null;

comment on column public.weight_room_workouts.template_id is
  'The template this session is running (#376). NULL for a freestyle workout, or for one whose template was deleted afterwards. Resolved by id rather than by matching `title`, which is free text and not unique.';

create index if not exists weight_room_workouts_template_idx
  on public.weight_room_workouts (template_id)
  where template_id is not null;
