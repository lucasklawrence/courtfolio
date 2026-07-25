-- Load-based Weight Room achievements (#336 follow-up).
--
-- Extends the Trophy Room from "how many reps" to "how much weight": tonnage
-- (weight moved) per day/week/month, heaviest single-set tonnage, and top-set
-- load PRs. Adds two columns:
--
--   weight_room_goals.load_multiplier  — implements carried per set
--   weight_room_achievements.measure   — what the threshold counts
--
-- WHY `load_multiplier`: `weight_room_sets.weight_lbs` stores the load on ONE
-- implement, because that is how loads are read off the equipment — a "60 lb
-- dumbbell shrug" is 60 per hand, not 60 total. Shrugs are carried two dumbbells
-- at a time, so the actual weight under load is 120 and the actual tonnage is
-- reps × 60 × 2. Without this column every shrug number was understated by half
-- (a 53,435 lb lifetime that is really 106,870). Defaults to 1, so every
-- single-implement movement — barbell, vest, belt, bodyweight — is unaffected.
--
-- This is deliberately on the *goal*, not the set: it is a property of how the
-- movement is performed, not of one logged instance, so it stays correct
-- retroactively across the whole log the moment it is set.
--
-- WHY `measure` rather than more `scope` values: scope answers "over what
-- window" (day / week / month / streak / lifetime / set) and measure answers
-- "summing what" (reps / tonnage / load). Keeping them orthogonal means a new
-- combination — lifetime tonnage, say — is a row the owner can add in the admin
-- UI, not a migration.
--
-- This file is the canonical record of the migration; it is also applied to the
-- `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`) via the Supabase
-- tooling. All DDL is idempotent so re-applying on a fresh dev project (or after
-- a branch reset) is a safe no-op.

alter table public.weight_room_goals
  add column if not exists load_multiplier integer not null default 1
    check (load_multiplier > 0);

comment on column public.weight_room_goals.load_multiplier is
  'How many loaded implements are moved per set. weight_room_sets.weight_lbs is the load on ONE implement (how it is read off the equipment), so effective load = weight_lbs * load_multiplier and tonnage = reps * weight_lbs * load_multiplier. 2 for a two-dumbbell carry like shrugs; 1 (the default) for a barbell, weight vest, dip belt, or bodyweight movement.';

-- Seed the one known two-implement movement. Guarded on the default so
-- re-applying the migration cannot clobber a value the owner has since changed
-- to something other than 1.
update public.weight_room_goals
  set load_multiplier = 2, updated_at = now()
  where exercise = 'shrugs' and load_multiplier = 1;

alter table public.weight_room_achievements
  add column if not exists measure text not null default 'reps'
    check (measure in ('reps', 'tonnage', 'load'));

comment on column public.weight_room_achievements.measure is
  'What the threshold counts. reps = rep count (the default; every pre-existing tier). tonnage = pounds moved, summed as reps * weight_lbs * load_multiplier over the scope window; for scope=set it is one set''s reps * load. load = pounds under load on a single set (weight_lbs * load_multiplier) — a strength PR rather than a volume one; only bodyweight-external load counts, so an unweighted set contributes 0.';

-- The uniqueness rule now spans measure: (exercise, scope, measure, threshold).
-- "100 in a day" is a different tier depending on whether it means reps or
-- pounds, so the old three-column index would have wrongly collided them.
drop index if exists public.weight_room_achievements_metric_idx;
create unique index if not exists weight_room_achievements_metric_idx
  on public.weight_room_achievements (coalesce(exercise, '*'), scope, measure, threshold);

-- Seed the load ladder. Calibrated against the real log as of 2026-07-25, with
-- the shrug multiplier applied: best day 11,925 lb, best week 36,300, best
-- month 106,870, best single set 1,400, top load 120 (60s in each hand).
-- Weighted pushups/pullups have no logged sets yet, so those tiers open
-- unearned — a ladder to chase once a vest or belt goes on.
insert into public.weight_room_achievements (label, exercise, scope, measure, threshold, color, icon)
values
  -- Shrugs — tonnage moved per window.
  ('Five-Grand Day',        'shrugs', 'day',   'tonnage',   5000, '#C9A268', '🏋️'),
  ('Ten-Grand Day',         'shrugs', 'day',   'tonnage',  10000, '#B08D4F', '🏋️'),
  ('Fifteen-Grand Day',     'shrugs', 'day',   'tonnage',  15000, '#8A6D3B', '🔩'),
  ('Twenty-Five-Grand Week','shrugs', 'week',  'tonnage',  25000, '#C9A268', '📅'),
  ('Forty-Grand Week',      'shrugs', 'week',  'tonnage',  40000, '#B08D4F', '🗓️'),
  ('Seventy-Five-Grand Month','shrugs','month','tonnage',  75000, '#C9A268', '🏅'),
  ('Hundred-Fifty-Grand Month','shrugs','month','tonnage',150000, '#8A6D3B', '🏆'),
  -- Shrugs — one unbroken set, by weight moved. 2000 lb is a literal ton.
  ('Half-Ton Set',          'shrugs', 'set',   'tonnage',   1000, '#C9A268', '💪'),
  ('One-Ton Set',           'shrugs', 'set',   'tonnage',   2000, '#B08D4F', '🦾'),
  ('Ton-and-a-Half Set',    'shrugs', 'set',   'tonnage',   3000, '#8A6D3B', '🦾'),
  -- Shrugs — top-set load PRs, in total pounds carried (both dumbbells).
  ('Eighty-Pound Carry',    'shrugs', 'set',   'load',        80, '#C9A268', '⚖️'),
  ('Hundred-Pound Carry',   'shrugs', 'set',   'load',       100, '#B08D4F', '⚖️'),
  ('Hundred-Twenty Carry',  'shrugs', 'set',   'load',       120, '#8A6D3B', '⚖️'),
  ('Hundred-Forty Carry',   'shrugs', 'set',   'load',       140, '#DC2626', '🔥'),
  ('Hundred-Sixty Carry',   'shrugs', 'set',   'load',       160, '#A21CAF', '👑'),

  -- Weighted pushups — vest load (single implement, multiplier 1).
  ('Twenty-Pound Vest',     'pushups','set',   'load',        20, '#EA580C', '⚖️'),
  ('Thirty-Five-Pound Vest','pushups','set',   'load',        35, '#DC2626', '⚖️'),
  ('Forty-Five-Pound Vest', 'pushups','set',   'load',        45, '#A21CAF', '👑'),

  -- Weighted pullups — dip-belt load.
  ('Twenty-Five-Pound Belt','pullups','set',   'load',        25, '#0EA5A1', '⚖️'),
  ('Forty-Five-Pound Belt', 'pullups','set',   'load',        45, '#0D9488', '⚖️'),
  ('Seventy-Pound Belt',    'pullups','set',   'load',        70, '#A21CAF', '👑'),

  -- Pooled tonnage across every movement. Shrugs carry these alone today;
  -- they start meaning something broader once another lift gets loaded.
  ('Fifteen-Grand Day',     null,     'day',   'tonnage',  15000, '#F5D08A', '🏋️'),
  ('Fifty-Grand Week',      null,     'week',  'tonnage',  50000, '#EAB308', '🗓️'),
  ('Six-Figure Month',      null,     'month', 'tonnage', 100000, '#CA8A04', '🏆')
on conflict do nothing;
