-- Link a logged set to the template slot it was performed for (#376).
--
-- One nullable column, and it is what makes prescribed-vs-actual computable at
-- all — deliberately without a separate substitutions table:
--
--   * A set carrying a `template_slot_id` was performed **for** that slot.
--     Compare its `exercise` to the slot's and a mismatch *is* the record of a
--     substitution. Nothing else needs storing: the rack was taken, you did
--     dumbbell bench against the barbell-bench slot, and both halves are on the
--     row already.
--   * A set inside a workout with a NULL `template_slot_id` is extra work —
--     something added on the day that the template never prescribed.
--   * A set with no workout at all is loose grease-the-groove volume, exactly
--     as before.
--
-- `on delete set null`, so editing or deleting a template later degrades old
-- sessions to "untemplated sets" rather than erroring or, worse, silently
-- rewriting what a past workout says it was doing. #375 keeps slot ids stable
-- across edits precisely so this link survives ordinary template maintenance.
--
-- Idempotent.

alter table public.weight_room_sets
  add column if not exists template_slot_id uuid null
  references public.weight_room_template_slots(id) on delete set null;

comment on column public.weight_room_sets.template_slot_id is
  'The template slot this set was performed for (#376), or NULL for extra work inside a workout / a loose grease-the-groove set. A set whose `exercise` differs from its slot''s IS the substitution record — there is no separate table. ON DELETE SET NULL so template maintenance degrades old sessions rather than breaking them.';

create index if not exists weight_room_sets_template_slot_idx
  on public.weight_room_sets (template_slot_id)
  where template_slot_id is not null;
