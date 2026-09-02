-- Weight Room "grease the groove" achievements (#336).
--
-- Backs the Trophy Room at `/training-facility/weight-room/achievements`: a
-- badge ladder over the existing `weight_room_sets` log. A tier is a
-- (exercise, scope, threshold) triple — "100 pushups in a day", "1000 pushups
-- in a week", "30-day streak" — and is earned whenever the corresponding
-- metric reaches its threshold.
--
-- WHY A DEDICATED TABLE (not a code constant): the ladder is owner-editable at
-- runtime — add/rename/retune a tier without a deploy — so the tiers live in
-- Supabase and are managed through an admin-gated API route
-- (`app/api/admin/weight-room/achievements/*`), mirroring the OTF mileage
-- awards (#321) and the Weight Room goals / monthly-focus model.
--
-- STATELESS BY DESIGN: nothing about "earned" is persisted. The Trophy Room
-- recomputes every badge (and its first-earned date) from the full set log on
-- each render, so retuning a threshold immediately re-lights the wall and a
-- backdated set retroactively earns what it should. Same contract as #321.
--
-- RLS mirrors `weight_room_goals`: anon + authenticated SELECT only. Writes go
-- through the service-role key via the admin API route.
--
-- This file is the canonical record of the migration; it is also applied to the
-- `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`) via the Supabase
-- tooling. All DDL is idempotent so re-applying on a fresh dev project (or after
-- a branch reset) is a safe no-op.

create table if not exists public.weight_room_achievements (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) > 0),
  exercise text,
  scope text not null check (scope in ('day', 'week', 'month', 'streak', 'lifetime', 'set')),
  threshold integer not null check (threshold > 0),
  color text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_achievements is
  'Achievement ladder for the Weight Room Trophy Room (#336). One row per badge tier: a label + the metric it measures (exercise + scope) + the threshold that earns it. Earned state is never stored — it is recomputed from weight_room_sets on every render, so retuning a threshold or backdating a set re-resolves the whole wall. Read anon (SELECT); written only through the service-role admin route.';

comment on column public.weight_room_achievements.exercise is
  'Exercise this tier measures, matching weight_room_goals.exercise (e.g. pushups). NULL means the pooled "all movements" ladder: reps summed across every exercise for the volume scopes, the longest run of days hitting at least one goal for streak, and the best single set of any exercise for set. Deliberately NOT a foreign key — deleting a goal should not silently delete its trophies, and a tier for a retired movement stays as a historical record.';

comment on column public.weight_room_achievements.scope is
  'Which metric the threshold applies to. day/week/month = reps summed over that calendar bucket (ISO Mon-Sun weeks). streak = consecutive days hitting the exercise daily_target. lifetime = cumulative reps, all-time. set = reps in a single unbroken set.';

comment on column public.weight_room_achievements.threshold is
  'The value the scope metric must reach to earn the badge; reps for every scope except streak, which counts days. Reached-exactly earns it (>=). Must be positive.';

comment on column public.weight_room_achievements.color is
  'Optional hex badge tint (e.g. #EA580C). Null lets the UI fall back to the exercise goal color, then to a default accent.';

comment on column public.weight_room_achievements.icon is
  'Optional emoji shown on the badge face (e.g. 💯). Null renders a scope-derived default glyph.';

-- One tier per (exercise, scope, threshold). `coalesce` collapses the pooled
-- NULL exercise to a sentinel because Postgres treats NULLs as distinct in a
-- plain unique constraint, which would let two identical pooled tiers coexist.
-- Labels are intentionally NOT unique — "Century Club" should be able to exist
-- for both pushups and squats.
create unique index if not exists weight_room_achievements_metric_idx
  on public.weight_room_achievements (coalesce(exercise, '*'), scope, threshold);

-- The wall is grouped by exercise and read low → high within a scope.
create index if not exists weight_room_achievements_order_idx
  on public.weight_room_achievements (exercise, scope, threshold);

alter table public.weight_room_achievements enable row level security;

-- Postgres has no `create policy if not exists`; swallow the duplicate-object
-- error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read weight room achievements"
    on public.weight_room_achievements
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
