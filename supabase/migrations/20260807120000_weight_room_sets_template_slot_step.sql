-- #407 — link a set to the within-set step it was performed for.
--
-- #375 modelled the sequence (`weight_room_template_slot_steps`): a drop set is
-- the slot's own movement at descending loads, a superset is different
-- movements back to back. Back Day 1 has a real one seeded — a rack run down
-- 35 → 30 → 25 → 20, performed twice.
--
-- #376 could not record it faithfully. One row per mini-set keeps the four
-- descending loads but makes the slot read `8 / 2`, because completion counted
-- rows against `target_sets`. One row per round fixes the counter and throws
-- the loads away — and the loads are the entire point of a rack run.
--
-- The row-per-mini-set data was always right; what was missing was knowing
-- which step each row belonged to. With that, a pass down the rack is one
-- prescribed set again: the slot is N sets deep when *every* step has been
-- logged N times.
--
-- `on delete set null` mirrors `template_slot_id` (#376): editing or deleting a
-- template later degrades a past session to "step unknown" rather than erasing
-- what it recorded. The set itself, and its load, always survive.

alter table public.weight_room_sets
  add column if not exists template_slot_step_id uuid null
    references public.weight_room_template_slot_steps (id)
    on delete set null;

comment on column public.weight_room_sets.template_slot_step_id is
  'The within-set step this set was performed for (#407) — one rung of a drop '
  'set, or one movement of a superset. Null for an ordinary straight set, which '
  'is the overwhelming majority, and null for a set whose step was deleted with '
  'the template. Only meaningful alongside template_slot_id; a step belongs to a '
  'slot, so a set carrying a step without a slot is malformed.';

-- Sets are read per workout and grouped by slot, then by step. Indexed for the
-- same reason `template_slot_id` is: the grouping is on the read path of every
-- summary and every live refetch.
create index if not exists weight_room_sets_template_slot_step_id_idx
  on public.weight_room_sets (template_slot_step_id)
  where template_slot_step_id is not null;
