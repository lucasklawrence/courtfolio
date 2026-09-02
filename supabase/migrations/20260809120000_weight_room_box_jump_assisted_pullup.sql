-- #400 — two movements the iCloud Notes archive trains that the catalog lacks.
--
-- Both were surfaced by the importer refusing to guess: it reports a movement
-- it cannot resolve rather than bending it onto the nearest existing slug,
-- which is how a near-duplicate ends up splitting a movement's history in two.
--
-- `box-jump` covers the plyo work that appears at the end of nearly every leg
-- and chest session ("18 inch plyo", "24 inch plyo", "30 inch plyo"). The box
-- height is the load, so it rides on the set's `variant` rather than becoming
-- three separate slugs — the same treatment grip and tempo already get.
--
-- `assisted-pullups` is deliberately NOT folded into `pullups`. An assisted rep
-- moves less than bodyweight, and counting it toward the same movement would
-- inflate the unassisted pull-up history that the daily ring and the
-- then-vs-now comparison both read.

insert into public.weight_room_exercises
  (slug, display_name, equipment, muscle_group, load_multiplier, is_unilateral)
values
  ('box-jump', 'Box Jump', 'bodyweight', 'legs', 1, false),
  ('assisted-pullups', 'Assisted Pull-ups', 'machine', 'back', 1, false)
on conflict (slug) do nothing;

comment on table public.weight_room_exercises is
  'Movement roster for the Weight Room (#373). Rows are added when a real '
  'movement appears with no home — see #400, which added box jumps and assisted '
  'pull-ups rather than mapping them onto near-duplicate slugs.';
