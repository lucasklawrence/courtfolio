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

-- Seed the default ladder. Thresholds are calibrated against the real log as of
-- 2026-07-25 so the wall opens with a handful already earned and a long tail to
-- chase — a ladder where everything is unlocked (or nothing is) motivates
-- nothing. Reference bests at seed time: pushups 180/day, 790/week, 2336/month,
-- 4746 lifetime, 15/set; pullups 100/day, 275/week, 816/month, 1501 lifetime,
-- 10/set; pooled 540/day, 2491/week, 7480/month, 10575 lifetime; longest streak
-- 17 days (shrugs).
--
-- `on conflict do nothing` on the metric index keeps re-applying idempotent and
-- never clobbers a threshold the owner has since retuned.
insert into public.weight_room_achievements (label, exercise, scope, threshold, color, icon)
values
  -- Pushups — daily volume. The 100 tier is the standing daily goal.
  ('Century Club',        'pushups', 'day',      100, '#EA580C', '💯'),
  ('Century and a Half',  'pushups', 'day',      150, '#F97316', '🔥'),
  ('Double Century',      'pushups', 'day',      200, '#DC2626', '⚡'),
  ('Triple Century',      'pushups', 'day',      300, '#A21CAF', '👑'),
  -- Pushups — weekly / monthly volume.
  ('Five-Hundred Week',   'pushups', 'week',     500, '#EA580C', '📅'),
  ('Seven-Fifty Week',    'pushups', 'week',     750, '#F97316', '📅'),
  ('Four-Figure Week',    'pushups', 'week',    1000, '#DC2626', '🗓️'),
  ('Two-Grand Month',     'pushups', 'month',   2000, '#EA580C', '🏅'),
  ('Three-Grand Month',   'pushups', 'month',   3000, '#DC2626', '🏅'),
  ('Five-Grand Month',    'pushups', 'month',   5000, '#A21CAF', '🏆'),
  -- Pushups — lifetime + single set.
  ('Five Thousand Club',  'pushups', 'lifetime', 5000, '#EA580C', '🎖️'),
  ('Ten Thousand Club',   'pushups', 'lifetime',10000, '#DC2626', '🎖️'),
  ('Twenty-Five K Club',  'pushups', 'lifetime',25000, '#A21CAF', '💎'),
  ('Twenty Unbroken',     'pushups', 'set',       20, '#EA580C', '💪'),
  ('Twenty-Five Unbroken','pushups', 'set',       25, '#F97316', '💪'),
  ('Thirty Unbroken',     'pushups', 'set',       30, '#DC2626', '🦾'),
  -- Pushups — streaks.
  ('Perfect Week',        'pushups', 'streak',     7, '#EA580C', '🔥'),
  ('Perfect Fortnight',   'pushups', 'streak',    14, '#F97316', '🔥'),
  ('Perfect Month',       'pushups', 'streak',    30, '#DC2626', '☄️'),

  -- Pullups — the daily goal is 30, so the ladder starts above it.
  ('Half Century',        'pullups', 'day',       50, '#0EA5A1', '💯'),
  ('Seventy-Five',        'pullups', 'day',       75, '#14B8A6', '🔥'),
  ('Century Club',        'pullups', 'day',      100, '#0D9488', '👑'),
  ('Two-Hundred Week',    'pullups', 'week',     200, '#0EA5A1', '📅'),
  ('Three-Hundred Week',  'pullups', 'week',     300, '#14B8A6', '📅'),
  ('Five-Hundred Week',   'pullups', 'week',     500, '#0D9488', '🗓️'),
  ('Grand Month',         'pullups', 'month',   1000, '#0EA5A1', '🏅'),
  ('Fifteen-Hundred Month','pullups','month',   1500, '#0D9488', '🏆'),
  ('Twenty-Five Hundred Club', 'pullups', 'lifetime', 2500, '#0EA5A1', '🎖️'),
  ('Five Thousand Club',  'pullups', 'lifetime', 5000, '#14B8A6', '🎖️'),
  ('Ten Thousand Club',   'pullups', 'lifetime',10000, '#0D9488', '💎'),
  ('Twelve Unbroken',     'pullups', 'set',       12, '#0EA5A1', '💪'),
  ('Fifteen Unbroken',    'pullups', 'set',       15, '#14B8A6', '💪'),
  ('Twenty Unbroken',     'pullups', 'set',       20, '#0D9488', '🦾'),
  ('Perfect Week',        'pullups', 'streak',     7, '#0EA5A1', '🔥'),
  ('Perfect Fortnight',   'pullups', 'streak',    14, '#14B8A6', '🔥'),
  ('Perfect Month',       'pullups', 'streak',    30, '#0D9488', '☄️'),

  -- Squats.
  ('Century Club',        'squats',  'day',      100, '#2563EB', '💯'),
  ('Double Century',      'squats',  'day',      200, '#1D4ED8', '⚡'),
  ('Five-Hundred Week',   'squats',  'week',     500, '#2563EB', '📅'),
  ('Four-Figure Week',    'squats',  'week',    1000, '#1D4ED8', '🗓️'),
  ('Two-Grand Month',     'squats',  'month',   2000, '#2563EB', '🏅'),
  ('Five Thousand Club',  'squats',  'lifetime', 5000, '#1D4ED8', '🎖️'),
  ('Perfect Week',        'squats',  'streak',     7, '#2563EB', '🔥'),
  ('Perfect Month',       'squats',  'streak',    30, '#1D4ED8', '☄️'),

  -- Shrugs (the current monthly focus movement).
  ('Century Club',        'shrugs',  'day',      100, '#C9A268', '💯'),
  ('Double Century',      'shrugs',  'day',      200, '#B08D4F', '⚡'),
  ('Four-Figure Week',    'shrugs',  'week',    1000, '#C9A268', '🗓️'),
  ('Three-Grand Month',   'shrugs',  'month',   3000, '#B08D4F', '🏅'),
  ('Five Thousand Club',  'shrugs',  'lifetime', 5000, '#C9A268', '🎖️'),
  ('Perfect Fortnight',   'shrugs',  'streak',    14, '#C9A268', '🔥'),
  ('Perfect Month',       'shrugs',  'streak',    30, '#B08D4F', '☄️'),

  -- Pooled "all movements" ladder (exercise IS NULL).
  ('Triple Threat',        null, 'day',        300, '#F5D08A', '🎯'),
  ('Five-Hundred Day',     null, 'day',        500, '#EAB308', '🎯'),
  ('Seven-Fifty Day',      null, 'day',        750, '#CA8A04', '🌟'),
  ('Fifteen-Hundred Week', null, 'week',      1500, '#F5D08A', '📅'),
  ('Twenty-Five-Hundred Week', null, 'week',  2500, '#EAB308', '🗓️'),
  ('Four-Grand Week',      null, 'week',      4000, '#CA8A04', '🌟'),
  ('Five-Grand Month',     null, 'month',     5000, '#F5D08A', '🏅'),
  ('Seventy-Five-Hundred Month', null, 'month', 7500, '#EAB308', '🏆'),
  ('Ten-Grand Month',      null, 'month',    10000, '#CA8A04', '👑'),
  ('Ten Thousand Reps',    null, 'lifetime', 10000, '#F5D08A', '🎖️'),
  ('Twenty-Five K Reps',   null, 'lifetime', 25000, '#EAB308', '💎'),
  ('Fifty K Reps',         null, 'lifetime', 50000, '#CA8A04', '💎'),
  ('Hundred K Reps',       null, 'lifetime',100000, '#A21CAF', '👑'),
  ('Week of Work',         null, 'streak',       7, '#F5D08A', '🔥'),
  ('Fortnight of Work',    null, 'streak',      14, '#EAB308', '🔥'),
  ('Month of Work',        null, 'streak',      30, '#CA8A04', '☄️'),
  ('Sixty-Day Grind',      null, 'streak',      60, '#DC2626', '☄️'),
  ('Hundred-Day Grind',    null, 'streak',     100, '#A21CAF', '👑')
on conflict do nothing;
