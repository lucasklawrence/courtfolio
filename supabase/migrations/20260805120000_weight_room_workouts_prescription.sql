-- #377 — freeze the prescription a workout was running when it started.
--
-- `weight_room_workouts.template_id` (#376) records *which* template a session
-- ran, and `weight_room_sets.template_slot_id` records which slot each set was
-- performed for. Together those survive renaming and reordering a template —
-- but not editing one. Change a slot's `target_sets` from 4 to 5 and every
-- finished workout that hit 4 is retroactively scored incomplete; change a
-- slot's `exercise` and honest sets are retroactively relabelled substitutions.
--
-- That contradicts the invariant `types/weight-room.ts` documents for
-- WorkoutTemplate: a template is a plan, not a record, and editing it must
-- never change what a past session says it prescribed.
--
-- The fix is a snapshot taken at start. A jsonb column rather than a snapshot
-- table because it is written once, read whole, and never queried across rows —
-- there is nothing to join or index, and a table would add three more entities
-- to keep in step with the template editor for no gain.
--
-- Nullable, and the read path falls back to the live template when it's absent,
-- so sessions that predate this column still resolve. In practice there are
-- none: this lands while `weight_room_workouts` is empty, which is exactly why
-- it's being done now rather than after there's history to migrate.

alter table public.weight_room_workouts
  add column if not exists prescription jsonb;

comment on column public.weight_room_workouts.prescription is
  'Frozen copy of the template prescription this session started against (#377): '
  '{ template_id, name, slots: [{ id, position, exercise, target_sets, '
  'target_sets_max?, target_reps?, target_reps_max?, target_weight_lbs?, notes? }] }. '
  'Written once at start and never updated — editing the source template must not '
  'rewrite what a finished session says it prescribed. Null for a freestyle session, '
  'and for any session recorded before this column existed (the read path falls back '
  'to the live template for those).';
