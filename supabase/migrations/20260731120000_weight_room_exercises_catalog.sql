-- Weight Room exercise catalog (#373) — split the movement roster out of
-- `weight_room_goals` so a movement can exist without a daily rep target.
--
-- Before this migration `weight_room_goals` did two jobs: it was the FK target
-- for every set (the roster) *and* the grease-the-groove daily-target config
-- (`daily_target integer not null check (daily_target > 0)`). That conflation
-- was free while every tracked movement had a daily ring, but it makes a gym
-- lift unloggable — bench press has no honest `daily_target`, and inventing one
-- would put a phantom ring on the Today view and a phantom streak in the stats.
--
-- After this migration:
--
--   * weight_room_exercises — the roster. One row per movement, with the
--     display label and the equipment/muscle metadata a template builder needs.
--     FK target for sets, goals, and monthly focus.
--   * weight_room_goals     — an *overlay* on the roster: the handful of
--     movements that also have a daily ring. Still keyed by exercise name.
--
-- Two deliberate behavior changes ride along:
--
--   * Sets now `on delete restrict` into the catalog instead of
--     `on delete cascade` into goals. Deleting a goal used to destroy every set
--     ever logged for that movement; removing a daily goal now means "stop
--     ringing this movement", not "erase its history". Retiring a movement from
--     the roster is `archived = true`, which is why the catalog carries it.
--   * `on update cascade` on every repointed FK, so renaming a slug propagates
--     instead of erroring. The settings UI keeps slugs immutable, but the
--     database no longer forbids a rename.
--
-- NOT done here, on purpose: dropping `weight_room_goals.load_multiplier`.
-- The catalog is its source of truth from this migration on and the app stops
-- reading the goals column, but production applies migrations *ahead* of the
-- code that lands with them (see CLAUDE.md), so dropping it now would break the
-- deployed read — `GOALS_COLUMNS` still names it — for the window between apply
-- and promote. The drop is a follow-up applied after this deploys.
--
-- RLS mirrors every sibling table: anon + authenticated SELECT only; writes go
-- through the service-role key via `app/api/admin/weight-room/*`.
--
-- All DDL is idempotent — re-applying on a fresh project or after a branch
-- reset is a safe no-op.

-- ---------------------------------------------------------------------------
-- 1. The catalog
-- ---------------------------------------------------------------------------

create table if not exists public.weight_room_exercises (
  slug text primary key,
  display_name text not null check (btrim(display_name) <> ''),
  equipment text not null check (
    equipment in (
      'barbell', 'dumbbell', 'kettlebell', 'machine',
      'cable', 'band', 'bodyweight', 'other'
    )
  ),
  muscle_group text not null check (
    muscle_group in (
      'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full-body'
    )
  ),
  load_multiplier integer not null default 1 check (load_multiplier > 0),
  is_unilateral boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_exercises is
  'Movement roster for the Weight Room (#373). One row per exercise, keyed by slug. FK target for weight_room_sets, weight_room_goals, and weight_room_monthly_focus — a movement must exist here before it can be logged. Carries the display label and the equipment/muscle metadata; weight_room_goals is a separate overlay holding only the movements that also have a grease-the-groove daily target.';

comment on column public.weight_room_exercises.load_multiplier is
  'How many loaded implements this movement moves per set. weight_room_sets.weight_lbs records the load on ONE implement (a "60 lb dumbbell shrug" is 60 per hand), so effective load is weight_lbs x load_multiplier. Two-dumbbell movements set 2; barbell, vest, dip belt, and bodyweight stay 1. Moved here from weight_room_goals so a movement with no daily ring can still carry it.';

comment on column public.weight_room_exercises.is_unilateral is
  'True when the movement trains one side at a time (single-arm dumbbell row). Distinct from load_multiplier, which counts implements moved simultaneously: a single-arm row is unilateral with multiplier 1, a two-dumbbell press is bilateral with multiplier 2.';

comment on column public.weight_room_exercises.archived is
  'Soft-retire flag. Sets FK into this table with on delete restrict, so a movement with history can never be deleted — archiving hides it from pickers while leaving every logged set intact.';

create index if not exists weight_room_exercises_active_idx
  on public.weight_room_exercises (muscle_group, slug)
  where archived = false;

alter table public.weight_room_exercises enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room exercises"
    on public.weight_room_exercises
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill the roster from what already exists
-- ---------------------------------------------------------------------------
-- Every currently-configured goal becomes a catalog row, carrying its
-- load_multiplier across. The four live movements get explicit equipment and
-- muscle groups; anything else (a goal added between this file being written
-- and it being applied) lands on 'other'/'full-body' rather than blocking the
-- migration, and can be corrected in the settings UI.
--
-- `on conflict do nothing` makes this re-runnable, and means a re-apply never
-- re-stamps a row whose metadata was since edited by hand.

insert into public.weight_room_exercises (slug, display_name, equipment, muscle_group, load_multiplier)
select
  g.exercise,
  initcap(replace(g.exercise, '-', ' ')),
  case g.exercise
    when 'pushups' then 'bodyweight'
    when 'pullups' then 'bodyweight'
    when 'squats'  then 'bodyweight'
    when 'shrugs'  then 'dumbbell'
    else 'other'
  end,
  case g.exercise
    when 'pushups' then 'chest'
    when 'pullups' then 'back'
    when 'squats'  then 'legs'
    when 'shrugs'  then 'shoulders'
    else 'full-body'
  end,
  coalesce(g.load_multiplier, 1)
from public.weight_room_goals g
on conflict (slug) do nothing;

-- Defensive: the FK repoint below fails if any set or focus names a movement
-- the catalog doesn't hold. Today's FKs make that impossible (both point at
-- goals), but a project where a goal was removed under the old cascade — or a
-- staging copy mid-restore — would otherwise hit a constraint error mid-apply
-- with the roster half-built. Cheap to guarantee, expensive to debug.

insert into public.weight_room_exercises (slug, display_name, equipment, muscle_group)
select distinct s.exercise, initcap(replace(s.exercise, '-', ' ')), 'other', 'full-body'
from public.weight_room_sets s
on conflict (slug) do nothing;

insert into public.weight_room_exercises (slug, display_name, equipment, muscle_group)
select distinct f.exercise, initcap(replace(f.exercise, '-', ' ')), 'other', 'full-body'
from public.weight_room_monthly_focus f
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Repoint the foreign keys at the catalog
-- ---------------------------------------------------------------------------
-- Drop-then-add rather than `add constraint if not exists` (which Postgres
-- doesn't support). The drop is guarded, so the pair is idempotent: a re-apply
-- drops the constraint this migration created and recreates it identically.

alter table public.weight_room_sets
  drop constraint if exists weight_room_sets_exercise_fkey;

alter table public.weight_room_sets
  add constraint weight_room_sets_exercise_fkey
  foreign key (exercise) references public.weight_room_exercises(slug)
  on delete restrict on update cascade;

comment on table public.weight_room_sets is
  'Logged strength sets for the Weight Room sub-area (PRD §7.6 / #79). One row per set. FK on `exercise` points at weight_room_exercises with ON DELETE RESTRICT (#373) — a movement with logged history cannot be deleted, only archived. It previously cascaded from weight_room_goals, which meant removing a daily goal silently destroyed that movement''s entire training log.';

alter table public.weight_room_goals
  drop constraint if exists weight_room_goals_exercise_fkey;

alter table public.weight_room_goals
  add constraint weight_room_goals_exercise_fkey
  foreign key (exercise) references public.weight_room_exercises(slug)
  on delete restrict on update cascade;

comment on table public.weight_room_goals is
  'Grease-the-groove daily targets (#79), an overlay on the weight_room_exercises roster (#373). Only movements with a daily ring have a row here; a gym lift lives in the catalog with no goal. Deleting a row stops the ring and drops its target history — it no longer touches logged sets.';

alter table public.weight_room_monthly_focus
  drop constraint if exists weight_room_monthly_focus_exercise_fkey;

alter table public.weight_room_monthly_focus
  add constraint weight_room_monthly_focus_exercise_fkey
  foreign key (exercise) references public.weight_room_exercises(slug)
  on delete restrict on update cascade;

-- weight_room_goal_targets.exercise deliberately keeps its FK into
-- weight_room_goals with ON DELETE CASCADE: it is daily-target history, which
-- is goal-scoped by definition. Removing a goal should take its target history
-- with it, and a catalog-only movement has no target history to hold.

-- ---------------------------------------------------------------------------
-- 4. Seed a starting gym roster
-- ---------------------------------------------------------------------------
-- Enough to build the first templates against; refine in the settings UI.
-- load_multiplier is 2 for movements carried as a pair of dumbbells (see the
-- column comment) and 1 for barbell / machine / cable / bodyweight work.
-- is_unilateral marks movements trained one side at a time.

insert into public.weight_room_exercises
  (slug, display_name, equipment, muscle_group, load_multiplier, is_unilateral)
values
  -- barbell
  ('barbell-bench-press',      'Barbell Bench Press',      'barbell',    'chest',     1, false),
  ('barbell-incline-press',    'Barbell Incline Press',    'barbell',    'chest',     1, false),
  ('barbell-overhead-press',   'Barbell Overhead Press',   'barbell',    'shoulders', 1, false),
  ('barbell-back-squat',       'Barbell Back Squat',       'barbell',    'legs',      1, false),
  ('barbell-front-squat',      'Barbell Front Squat',      'barbell',    'legs',      1, false),
  ('barbell-deadlift',         'Barbell Deadlift',         'barbell',    'back',      1, false),
  ('barbell-romanian-deadlift','Barbell Romanian Deadlift','barbell',    'legs',      1, false),
  ('barbell-row',              'Barbell Row',              'barbell',    'back',      1, false),
  ('barbell-hip-thrust',       'Barbell Hip Thrust',       'barbell',    'legs',      1, false),
  ('barbell-curl',             'Barbell Curl',             'barbell',    'arms',      1, false),
  -- dumbbell (pairs carry two implements — load_multiplier 2)
  ('dumbbell-bench-press',     'Dumbbell Bench Press',     'dumbbell',   'chest',     2, false),
  ('dumbbell-incline-press',   'Dumbbell Incline Press',   'dumbbell',   'chest',     2, false),
  ('dumbbell-shoulder-press',  'Dumbbell Shoulder Press',  'dumbbell',   'shoulders', 2, false),
  ('dumbbell-lateral-raise',   'Dumbbell Lateral Raise',   'dumbbell',   'shoulders', 2, false),
  ('dumbbell-curl',            'Dumbbell Curl',            'dumbbell',   'arms',      2, false),
  ('dumbbell-row',             'Dumbbell Row',             'dumbbell',   'back',      1, true),
  ('dumbbell-lunge',           'Dumbbell Lunge',           'dumbbell',   'legs',      2, false),
  ('dumbbell-romanian-deadlift','Dumbbell Romanian Deadlift','dumbbell', 'legs',      2, false),
  ('farmers-carry',            'Farmer''s Carry',          'dumbbell',   'full-body', 2, false),
  -- machine / cable
  ('lat-pulldown',             'Lat Pulldown',             'cable',      'back',      1, false),
  ('seated-cable-row',         'Seated Cable Row',         'cable',      'back',      1, false),
  ('cable-tricep-pushdown',    'Cable Tricep Pushdown',    'cable',      'arms',      1, false),
  ('cable-face-pull',          'Cable Face Pull',          'cable',      'shoulders', 1, false),
  ('chest-press-machine',      'Chest Press Machine',      'machine',    'chest',     1, false),
  ('pec-deck',                 'Pec Deck',                 'machine',    'chest',     1, false),
  ('leg-press',                'Leg Press',                'machine',    'legs',      1, false),
  ('leg-curl',                 'Leg Curl',                 'machine',    'legs',      1, false),
  ('leg-extension',            'Leg Extension',            'machine',    'legs',      1, false),
  ('calf-raise',               'Calf Raise',               'machine',    'legs',      1, false),
  -- bodyweight
  ('dips',                     'Dips',                     'bodyweight', 'chest',     1, false),
  ('chinups',                  'Chinups',                  'bodyweight', 'back',      1, false),
  ('hanging-leg-raise',        'Hanging Leg Raise',        'bodyweight', 'core',      1, false),
  ('plank',                    'Plank',                    'bodyweight', 'core',      1, false)
on conflict (slug) do nothing;
