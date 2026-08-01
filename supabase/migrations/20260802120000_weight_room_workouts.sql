-- Workout sessions (#374) — group sets into a bounded workout.
--
-- A gym workout is an *event*: walk in, do five movements, walk out. Nothing in
-- the Weight Room model could represent that. `weight_room_sets` carries only
-- `logged_at`, and every consumer buckets by calendar day — correct for
-- grease-the-groove, where the day genuinely is the unit, and useless for
-- "how long was that session and how did it compare to the last one".
--
-- Two columns land on `weight_room_sets`, both nullable, and there is **no
-- backfill**. Historical GTG sets were not workouts; they were sets scattered
-- through a day. Synthesising sessions for them would invent structure that
-- never existed, so a null `workout_id` means "logged loose" — permanently and
-- correctly. Everything that exists today keeps working because everything that
-- exists today ignores these columns.
--
-- **One open workout at a time.** Enforced by a partial unique index on
-- `(ended_at is null) where ended_at is null` — every matching row indexes the
-- same constant `true`, so at most one can exist. Deliberately shaped this way
-- rather than as an application check: when #330 adds household profiles the
-- index becomes `(profile_id) where ended_at is null` and the rule turns into
-- "one open workout *per profile*" with no other change.
--
-- RLS mirrors every sibling table: anon + authenticated SELECT only; writes go
-- through the service-role key via `app/api/admin/weight-room/*`.
--
-- All DDL is idempotent.

create table if not exists public.weight_room_workouts (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  ended_at timestamptz null,
  title text null check (title is null or btrim(title) <> ''),
  location text null check (location is null or location in ('gym', 'home', 'travel', 'other')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_room_workouts_window_check
    check (ended_at is null or ended_at >= started_at)
);

comment on table public.weight_room_workouts is
  'Bounded workout sessions for the Weight Room (#374). A row is one gym visit: started_at .. ended_at, with sets pointing back via weight_room_sets.workout_id. ended_at NULL means in progress. Grease-the-groove sets stay session-less by design — a null workout_id on a set means "logged loose", not "missing data".';

comment on column public.weight_room_workouts.started_at is
  'When the session began. Also the anchor for which calendar day the workout belongs to: a session crossing midnight belongs wholly to its start day, resolved in Pacific via lib/training-facility/day-keys.';

comment on column public.weight_room_workouts.ended_at is
  'When the session finished; NULL while in progress. At most one row may be NULL at a time (see the partial unique index). A session left open past the staleness horizon is auto-ended when the next one starts, stamped at its last set''s logged_at.';

create index if not exists weight_room_workouts_started_at_idx
  on public.weight_room_workouts (started_at desc);

-- At most one in-progress workout. Every open row indexes the same constant
-- `true`, so the unique constraint permits exactly one. Swapping the indexed
-- expression for `(profile_id)` later turns this into one-per-profile (#330).
create unique index if not exists weight_room_workouts_single_open_idx
  on public.weight_room_workouts ((ended_at is null))
  where ended_at is null;

alter table public.weight_room_workouts enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room workouts"
    on public.weight_room_workouts
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Sets join a workout, optionally
-- ---------------------------------------------------------------------------
-- `on delete set null`: deleting a session must never delete training history.
-- The sets fall back to loose sets, which is exactly what they were before the
-- session existed. Same reasoning as #373's move from cascade to restrict.

alter table public.weight_room_sets
  add column if not exists workout_id uuid null
  references public.weight_room_workouts(id) on delete set null;

alter table public.weight_room_sets
  add column if not exists position integer null;

do $$
begin
  alter table public.weight_room_sets
    add constraint weight_room_sets_position_check check (position is null or position >= 0);
exception when duplicate_object then null;
end $$;

comment on column public.weight_room_sets.workout_id is
  'The bounded session this set belongs to (#374), or NULL for a set logged loose — a grease-the-groove set at a desk, and every set predating workouts. Never backfilled: NULL is a real answer, not missing data.';

comment on column public.weight_room_sets.position is
  'Order of this set *within its workout*, not within its exercise — so an interleaved superset or a set squeezed in while waiting on a rack renders in the order it actually happened. Nullable, and gaps are fine; nothing renumbers.';

create index if not exists weight_room_sets_workout_idx
  on public.weight_room_sets (workout_id, position)
  where workout_id is not null;
