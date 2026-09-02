-- Seed the six workout templates and the movements they need (#375).
--
-- The catalog seed in `20260731120000_weight_room_exercises_catalog.sql` set the
-- precedent that movements are migration data, so the eighteen this adds belong
-- here rather than in a one-off script — otherwise a fresh project builds the
-- template tables and cannot populate them, and rebuilding after a restore
-- means re-transcribing six templates by hand.
--
-- The templates themselves were transcribed from phone notes. Two mapping
-- decisions in here are the kind that go wrong quietly and are worth stating:
--
--   * "Squats" on a legs day is `barbell-back-squat`, NOT the bodyweight
--     `squats` movement. `squats` is a 100/day grease-the-groove ring; pointing
--     five sets of loaded squats at it would dump gym volume into that ring and
--     corrupt the streak it measures.
--   * "Military press" is `barbell-overhead-press` — the same movement, kept on
--     one slug so its history doesn't split in two.
--
-- Bare rep lists in the source notes (pull-ups `8/8/7/6`, push-ups `10x10`) are
-- deliberately absent: those were grease-the-groove volume that happened to be
-- written under a workout, not part of its prescription. The two that carried
-- explicit set counts — Chest Day 2's push-ups, Back Day 1's pull-ups — are
-- slots, because they were prescribed.
--
-- Idempotent twice over: `on conflict do nothing` on the movements, and an
-- early return if any template already exists. Re-applying never duplicates,
-- and never overwrites a template edited since.

insert into public.weight_room_exercises
  (slug, display_name, equipment, muscle_group, load_multiplier, is_unilateral)
values
  -- Referenced by the August lower-body focus rather than a template; included
  -- so a rebuilt project has the movement its focus points at.
  ('lunges',                       'Lunges',                       'bodyweight', 'legs',      1, true),
  ('barbell-decline-press',        'Barbell Decline Press',        'barbell',    'chest',     1, false),
  ('skull-crushers',               'Skull Crushers',               'barbell',    'arms',      1, false),
  ('close-grip-bench-press',       'Close Grip Bench Press',       'barbell',    'arms',      1, false),
  ('rope-overhead-extension',      'Rope Overhead Extension',      'cable',      'arms',      1, false),
  ('upright-row',                  'Upright Row',                  'barbell',    'shoulders', 1, false),
  ('ez-bar-curl',                  'EZ Bar Curl',                  'barbell',    'arms',      1, false),
  ('preacher-curl',                'Preacher Curl',                'barbell',    'arms',      1, false),
  ('rope-curl',                    'Rope Curl',                    'cable',      'arms',      1, false),
  ('back-extension',               'Back Extension',               'bodyweight', 'back',      1, false),
  ('walking-lunges',               'Walking Lunges',               'bodyweight', 'legs',      1, true),
  ('single-leg-romanian-deadlift', 'Single Leg Romanian Deadlift', 'dumbbell',   'legs',      1, true),
  ('step-ups',                     'Step Ups',                     'bodyweight', 'legs',      1, true),
  ('calf-press-machine',           'Calf Press (Machine)',         'machine',    'legs',      1, false),
  ('seated-calf-raise',            'Seated Calf Raise',            'machine',    'legs',      1, false),
  ('sled-push',                    'Sled Push',                    'other',      'full-body', 1, false),
  ('knee-tucks',                   'Knee Tucks',                   'bodyweight', 'core',      1, false),
  ('russian-twist',                'Russian Twist',                'other',      'core',      1, false),
  ('decline-crunch',               'Decline Crunch',               'bodyweight', 'core',      1, false)
on conflict (slug) do nothing;

do $$
declare
  t uuid;
  s uuid;
begin
  -- Any existing template means this has run (or the templates were built by
  -- hand); leave them alone rather than duplicating or clobbering.
  if exists (select 1 from public.weight_room_workout_templates) then
    return;
  end if;

  -- ---- Chest Day 1 -------------------------------------------------------
  insert into public.weight_room_workout_templates (name, category, color, position)
  values ('Chest Day 1', 'push', '#DC2626', 0) returning id into t;
  insert into public.weight_room_template_slots
    (template_id, position, exercise, target_sets, target_sets_max)
  values
    (t, 0, 'barbell-bench-press',    4, null),
    (t, 1, 'barbell-incline-press',  4, null),
    (t, 2, 'barbell-decline-press',  4, null),
    (t, 3, 'skull-crushers',         4, 5),
    (t, 4, 'cable-tricep-pushdown',  4, 5);

  -- ---- Chest Day 2 -------------------------------------------------------
  insert into public.weight_room_workout_templates (name, category, color, position)
  values ('Chest Day 2', 'push', '#F97316', 1) returning id into t;
  insert into public.weight_room_template_slots (template_id, position, exercise, target_sets)
  values
    (t, 0, 'barbell-overhead-press',   4),
    (t, 1, 'dumbbell-bench-press',     4),
    (t, 2, 'barbell-incline-press',    4),
    (t, 3, 'pushups',                  4),
    (t, 4, 'dips',                     4),
    (t, 5, 'close-grip-bench-press',   4),
    (t, 6, 'rope-overhead-extension',  4);

  -- ---- Back Day 1 --------------------------------------------------------
  insert into public.weight_room_workout_templates (name, category, color, position)
  values ('Back Day 1', 'pull', '#0891B2', 2) returning id into t;
  insert into public.weight_room_template_slots (template_id, position, exercise, target_sets)
  values
    (t, 0, 'pullups',          4),
    (t, 1, 'seated-cable-row', 4),
    (t, 2, 'dumbbell-row',     4),
    (t, 3, 'upright-row',      4),
    (t, 4, 'ez-bar-curl',      5);
  insert into public.weight_room_template_slots
    (template_id, position, exercise, target_sets, notes)
  values (t, 5, 'dumbbell-curl', 5, 'Seated, alternating');

  -- The rack run: one set is four mini-sets down the rack, run twice.
  insert into public.weight_room_template_slots
    (template_id, position, exercise, target_sets, notes)
  values (t, 6, 'dumbbell-curl', 2, 'Rack run — descending down the rack')
  returning id into s;
  insert into public.weight_room_template_slot_steps
    (slot_id, position, target_weight_lbs)
  values (s, 0, 35), (s, 1, 30), (s, 2, 25), (s, 3, 20);

  -- ---- Back Day 2 --------------------------------------------------------
  insert into public.weight_room_workout_templates
    (name, category, color, position, description)
  values ('Back Day 2', 'pull', '#0E7490', 3, 'Target pace: 35 min') returning id into t;
  insert into public.weight_room_template_slots (template_id, position, exercise, target_sets)
  values
    (t, 0, 'barbell-row',    4),
    (t, 1, 'lat-pulldown',   4),
    (t, 2, 'back-extension', 4),
    (t, 3, 'shrugs',         4),
    (t, 4, 'preacher-curl',  5),
    (t, 5, 'rope-curl',      5);
  insert into public.weight_room_template_slots
    (template_id, position, exercise, target_sets, notes)
  values (t, 6, 'dumbbell-curl', 2, '21s — 7 bottom half / 7 top half / 7 full');

  -- ---- Legs Day 1 --------------------------------------------------------
  insert into public.weight_room_workout_templates (name, category, color, position)
  values ('Legs Day 1', 'legs', '#4F46E5', 4) returning id into t;
  insert into public.weight_room_template_slots (template_id, position, exercise, target_sets)
  values
    (t, 0, 'barbell-back-squat',            5),
    (t, 1, 'walking-lunges',                4),
    (t, 2, 'single-leg-romanian-deadlift',  3),
    (t, 3, 'leg-press',                     3),
    (t, 4, 'calf-press-machine',            3),
    (t, 5, 'plank',                         4),
    (t, 6, 'knee-tucks',                    4);

  -- ---- Legs Day 2 --------------------------------------------------------
  -- "Sled Push 2 sets" in the source listed four blank set lines; the header
  -- wins until corrected in the builder.
  insert into public.weight_room_workout_templates (name, category, color, position)
  values ('Legs Day 2', 'legs', '#7E22CE', 5) returning id into t;
  insert into public.weight_room_template_slots (template_id, position, exercise, target_sets)
  values
    (t, 0, 'barbell-back-squat',         4),
    (t, 1, 'barbell-romanian-deadlift',  4),
    (t, 2, 'step-ups',                   4),
    (t, 3, 'sled-push',                  2),
    (t, 4, 'seated-calf-raise',          5),
    (t, 5, 'russian-twist',              5),
    (t, 6, 'decline-crunch',             5);
end $$;
