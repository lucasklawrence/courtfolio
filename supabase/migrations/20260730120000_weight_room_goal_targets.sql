-- Effective-dated Weight Room goal targets (#362). Extends the strength
-- model (#79, `20260507120000_weight_room_tables.sql`) with a *history* of
-- each exercise's daily target.
--
-- The problem: `weight_room_goals.daily_target` is a single mutable scalar,
-- so every historical rollup (heatmap `pct`, streak hit-test, stats panel,
-- Today View rings, achievement `'streak'` scope) divides by whatever the
-- target is *right now*. Raising the pullups goal from 30 to 50 silently
-- re-scores the entire past: days that closed the ring at 30 stop counting
-- as hits, the longest streak collapses, and full-intensity heatmap cells
-- drop to half — retroactively rewriting history that was actually
-- completed. Lowering a target is the same bug in reverse, retroactively
-- crediting days that didn't clear the bar at the time.
--
-- The fix: a goal's target becomes a series of (daily_target,
-- effective_from) rows. The value in effect on day D is the most recent row
-- with effective_from <= D. `weight_room_goals.daily_target` stays as a
-- denormalized mirror of the newest row so the cheap "what's the target
-- now" read doesn't need a join; the admin write path
-- (`app/api/admin/weight-room/goals`) updates both in the same request, and
-- the backfill below seeds the two consistently.
--
-- RLS mirrors weight_room_goals / weight_room_sets: anon + authenticated
-- SELECT only; writes go through the service-role key via admin-gated API
-- routes. All DDL is idempotent so re-applying on a fresh dev project (or
-- after a branch reset) is a safe no-op.

-- 1. The history table.
create table if not exists public.weight_room_goal_targets (
  id uuid primary key default gen_random_uuid(),
  exercise text not null references public.weight_room_goals(exercise) on delete cascade,
  daily_target integer not null check (daily_target > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One target per exercise per day. Re-saving the same effective date is an
  -- update of that day's value, not a second competing row — which is what
  -- lets the write path upsert on (exercise, effective_from) when a target
  -- change is corrected before it ships.
  unique (exercise, effective_from)
);

comment on table public.weight_room_goal_targets is
  'Effective-dated daily targets for Weight Room goals (#362). One row per (exercise, effective_from); the target in effect on day D is the most recent row with effective_from <= D. Historical rollups resolve per-day through this table so changing a goal never re-scores days already completed. weight_room_goals.daily_target mirrors the newest row for cheap current-value reads.';

comment on column public.weight_room_goal_targets.effective_from is
  'Inclusive first day this target applies to. Backdatable: setting it to a past date retroactively declares when a target change actually took effect, which is the point — the admin API accepts an explicit date rather than always stamping today.';

-- Resolution always scans one exercise's rows newest-first, so the index
-- order matches the lookup.
create index if not exists weight_room_goal_targets_exercise_effective_idx
  on public.weight_room_goal_targets (exercise, effective_from desc);

alter table public.weight_room_goal_targets enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room goal targets"
    on public.weight_room_goal_targets
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- 2. Backfill — one seed row per existing goal, carrying that goal's current
--    target. This is the step that must NOT re-score anything: seeding the
--    *current* value means every existing chart, streak, and badge resolves
--    to exactly the number it resolved to before this migration.
--
--    `effective_from` is dated at or before the earliest day the exercise
--    could be scored on — the earlier of its first logged set and the goal's
--    own created_at — so no logged day falls before the seed. Pacific is the
--    anchor (same as load-management.ts / achievements.ts / monthly-focus.ts)
--    because that's the timezone the app buckets days in; a set logged at
--    10 pm Pacific must not land on the following UTC day and slip in front
--    of its own seed row.
--
--    Belt-and-braces: `targetForDay` independently falls back to the
--    earliest known target for any day preceding the first row, so even a
--    backdated set inserted later still resolves to this same seed value
--    rather than dividing by zero.
--
--    The `not exists` guard makes this idempotent and keeps it from
--    re-stamping a goal whose history has since moved on — re-running after
--    a real target change must not resurrect the original value.
insert into public.weight_room_goal_targets (exercise, daily_target, effective_from)
select
  g.exercise,
  g.daily_target,
  least(
    (
      select min((s.logged_at at time zone 'America/Los_Angeles')::date)
      from public.weight_room_sets s
      where s.exercise = g.exercise
    ),
    (g.created_at at time zone 'America/Los_Angeles')::date
  )
from public.weight_room_goals g
where not exists (
  select 1
  from public.weight_room_goal_targets t
  where t.exercise = g.exercise
);
