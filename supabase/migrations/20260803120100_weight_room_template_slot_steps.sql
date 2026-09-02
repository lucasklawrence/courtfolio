-- Set ranges and within-set sequences for workout templates (#375).
--
-- Both came out of transcribing six real templates rather than imagined ones,
-- and neither fits the shape the first migration created:
--
--   * "Skull Crushers 4-5 sets" is a range on *sets*. The slot had a range on
--     reps but a single `target_sets`, so the top of the range had nowhere to
--     live and a 5th set would have scored as exceeding the prescription
--     rather than hitting it.
--   * "Rack Run 35,30,25,20 2 sets" is a drop set — one set is really four
--     mini-sets at descending load, run twice. A slot carries one
--     `target_weight_lbs`, so it could not be expressed at all.
--
-- `weight_room_template_slot_steps` models the second as an ordered sequence
-- performed *inside* one set. A slot with no steps is an ordinary straight-set
-- prescription and behaves exactly as before — steps are strictly additive.
--
-- Each step's `exercise` is nullable, and that nullability is the whole design:
--
--   * NULL  → the step is the slot's own movement at a different load or rep
--             count. That is a **drop set** (the rack run).
--   * set   → the step is a *different* movement performed back-to-back. That
--             is a **superset**.
--
-- One mechanism, both structures, no second migration when supersets turn up.
-- They are not the same thing and shouldn't be presented as one in UI, but they
-- are the same shape, and modelling the shape once is what makes the second
-- free.
--
-- All DDL is idempotent.

alter table public.weight_room_template_slots
  add column if not exists target_sets_max integer null;

do $$
begin
  alter table public.weight_room_template_slots
    add constraint weight_room_template_slots_set_range_check
    check (target_sets_max is null or target_sets_max >= target_sets);
exception when duplicate_object then null;
end $$;

comment on column public.weight_room_template_slots.target_sets_max is
  'Top of a set range — "4-5 sets" is target_sets 4, target_sets_max 5. NULL means target_sets is exact. Scoring in #377 should treat anything within the range as hitting the prescription, not exceeding it.';

create table if not exists public.weight_room_template_slot_steps (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null
    references public.weight_room_template_slots(id) on delete cascade,
  position integer not null check (position >= 0),
  exercise text null
    references public.weight_room_exercises(slug) on delete restrict on update cascade,
  target_reps integer null check (target_reps is null or target_reps > 0),
  target_weight_lbs numeric null check (target_weight_lbs is null or target_weight_lbs >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deferrable for the same reason the slot ordering is: reordering steps swaps
-- positions, and an immediate check fires halfway through the swap.
do $$
begin
  alter table public.weight_room_template_slot_steps
    add constraint weight_room_template_slot_steps_position_key
    unique (slot_id, position) deferrable initially deferred;
exception when duplicate_table or duplicate_object then null;
end $$;

comment on table public.weight_room_template_slot_steps is
  'An ordered sequence performed inside ONE set of a template slot (#375). A slot with no steps is an ordinary straight set. Steps with a NULL exercise are the slot''s own movement at a different load — a drop set. Steps naming a different exercise are a superset. Same shape, different training intent; surfaces should label them distinctly.';

comment on column public.weight_room_template_slot_steps.exercise is
  'NULL inherits the slot''s movement (drop set). A catalog slug makes this step a different movement performed back-to-back (superset).';

comment on column public.weight_room_template_slot_steps.target_weight_lbs is
  'Load on ONE implement for this step, same convention as weight_room_sets.weight_lbs — a 35 lb rack-run step is 35 per hand, and effective load is this x the movement''s load_multiplier.';

create index if not exists weight_room_template_slot_steps_slot_idx
  on public.weight_room_template_slot_steps (slot_id, position);

alter table public.weight_room_template_slot_steps enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room template slot steps"
    on public.weight_room_template_slot_steps
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
