-- Workout templates (#375) — the "plan" half of the gym-workouts arc (#372).
--
-- A template is a named, ordered prescription: "Push Day — 5x5 bench, 3x8
-- overhead press, 3x12 lateral raise". Nothing in the Weight Room could express
-- that. `weight_room_goals` prescribes a *daily rep total* for a single
-- movement — no set structure, no ordering, no grouping across movements — and
-- `weight_room_monthly_focus` is a time-boxed campaign for one movement.
-- Neither composes into a workout.
--
-- Three tables:
--
--   * weight_room_workout_templates   — the named plan
--   * weight_room_template_slots      — its ordered prescriptions, one per movement
--   * weight_room_template_alternates — per-slot swaps, in preference order
--
-- Alternates are a child table rather than a `text[]` on the slot: an array can
-- hold a slug the catalog no longer has, and #373 exists precisely to make the
-- roster referentially real. Both `exercise` FKs are `on delete restrict`, so
-- archiving is how a movement retires — consistent with sets.
--
-- Reps are **totals**, never per-side, matching `weight_room_sets.reps` and the
-- daily goals (the August lunges target is 100/day, described as 50 per side).
-- Keeping one convention means the recording surface (#376) never converts
-- between a prescription and a logged set. `weight_room_exercises.is_unilateral`
-- already flags which movements that nuance applies to.
--
-- RLS mirrors every sibling table: anon + authenticated SELECT only; writes go
-- through the service-role key via `app/api/admin/weight-room/*`.
--
-- All DDL is idempotent.

create table if not exists public.weight_room_workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  description text null,
  color text null,
  category text null check (
    category is null or category in
      ('push', 'pull', 'legs', 'upper', 'lower', 'full-body', 'other')
  ),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_workout_templates is
  'Named workout prescriptions for the Weight Room (#375) — "Push Day", "Legs A". A template is a plan, not a record: running one produces a weight_room_workouts session (#374), and editing a template never changes what a past session says it prescribed.';

create index if not exists weight_room_workout_templates_active_idx
  on public.weight_room_workout_templates (position, name)
  where archived = false;

alter table public.weight_room_workout_templates enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room workout templates"
    on public.weight_room_workout_templates
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Slots — the ordered prescriptions
-- ---------------------------------------------------------------------------

create table if not exists public.weight_room_template_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.weight_room_workout_templates(id) on delete cascade,
  position integer not null check (position >= 0),
  exercise text not null
    references public.weight_room_exercises(slug) on delete restrict on update cascade,
  target_sets integer not null check (target_sets > 0),
  target_reps integer null check (target_reps is null or target_reps > 0),
  target_reps_max integer null,
  target_weight_lbs numeric null check (target_weight_lbs is null or target_weight_lbs >= 0),
  rest_seconds integer null check (rest_seconds is null or rest_seconds >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_room_template_slots_rep_range_check check (
    target_reps_max is null
    or (target_reps is not null and target_reps_max >= target_reps)
  )
);

-- DEFERRABLE is load-bearing, not decoration. Reordering slots means swapping
-- positions, and an immediate unique check fires the moment the first row is
-- written — before the second half of the swap has happened. Deferring to
-- commit lets one multi-row upsert reorder a whole template atomically, which
-- is exactly how the builder saves an order change.
do $$
begin
  alter table public.weight_room_template_slots
    add constraint weight_room_template_slots_position_key
    unique (template_id, position) deferrable initially deferred;
exception when duplicate_table or duplicate_object then null;
end $$;

comment on table public.weight_room_template_slots is
  'One prescribed movement within a workout template (#375), ordered by `position`. Reps are TOTALS, never per-side — same convention as weight_room_sets.reps.';

comment on column public.weight_room_template_slots.target_reps is
  'Prescribed reps per set, or NULL for AMRAP / to failure — a real prescription for dips and pullups, so it is deliberately not forced to a number. Set target_reps_max alongside it for a range (8-12).';

comment on column public.weight_room_template_slots.target_weight_lbs is
  'Prescribed load on ONE implement, matching weight_room_sets.weight_lbs. Effective load is this x weight_room_exercises.load_multiplier, so a two-dumbbell prescription stores the per-hand number. This is the field most likely to be double-counted.';

create index if not exists weight_room_template_slots_template_idx
  on public.weight_room_template_slots (template_id, position);

alter table public.weight_room_template_slots enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room template slots"
    on public.weight_room_template_slots
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Alternates — the pre-declared swaps
-- ---------------------------------------------------------------------------

create table if not exists public.weight_room_template_alternates (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null
    references public.weight_room_template_slots(id) on delete cascade,
  exercise text not null
    references public.weight_room_exercises(slug) on delete restrict on update cascade,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, exercise)
);

comment on table public.weight_room_template_alternates is
  'Pre-declared swaps for a template slot (#375), in preference order: barbell bench -> dumbbell bench -> machine press. Exists so the common "rack is taken" substitution is one tap during recording (#376) rather than a catalog search. Uniqueness is on (slot_id, exercise), so position may repeat without harm.';

create index if not exists weight_room_template_alternates_slot_idx
  on public.weight_room_template_alternates (slot_id, position);

alter table public.weight_room_template_alternates enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room template alternates"
    on public.weight_room_template_alternates
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
