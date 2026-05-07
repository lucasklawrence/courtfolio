-- Weight Room data model (#79) — bodyweight strength tracking, "grease the
-- groove" pattern. Two tables backing the Weight Room sub-area at
-- `/training-facility/weight-room`:
--
--   * weight_room_goals — one row per exercise (pushups, pullups, …) with
--     a daily target rep count and a display color. Settings UI manages
--     this list; rows are foreign-keyed by sets so an exercise's daily
--     target is always live.
--   * weight_room_sets  — one row per logged set (an exercise + a rep
--     count + a timestamp). The Today View's quick-log writes here.
--
-- RLS mirrors `cardio_sessions` / `movement_benchmarks`: anon +
-- authenticated SELECT only. Writes go through the service-role key
-- via admin-gated API routes (`app/api/admin/weight-room/*`), so
-- end-users editing in the browser are funneled through the admin
-- allowlist, not direct table access.
--
-- All DDL is idempotent so re-applying on a fresh dev project (or after
-- a branch reset) is a safe no-op.

create table if not exists public.weight_room_goals (
  exercise text primary key,
  daily_target integer not null check (daily_target > 0),
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_goals is
  'Per-exercise daily targets for the Weight Room sub-area (PRD §7.6 / #79). Primary key is the exercise name (e.g. ''pushups'') so the settings UI can upsert by name. Color is a hex string (e.g. ''#EA580C'') used by the Today View activity rings and the History View heatmap.';

alter table public.weight_room_goals enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room goals"
    on public.weight_room_goals
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.weight_room_sets (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null,
  exercise text not null references public.weight_room_goals(exercise) on delete cascade,
  reps integer not null check (reps > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_sets is
  'Logged strength sets for the Weight Room sub-area (PRD §7.6 / #79). One row per set; the Today View quick-log inserts here. FK on `exercise` cascades on delete so removing an exercise from `weight_room_goals` cleans up its history without orphan rows.';

create index if not exists weight_room_sets_logged_at_idx
  on public.weight_room_sets (logged_at desc);

create index if not exists weight_room_sets_exercise_logged_at_idx
  on public.weight_room_sets (exercise, logged_at desc);

alter table public.weight_room_sets enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room sets"
    on public.weight_room_sets
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- Seed default exercises so the Today View's activity rings have
-- something to render the moment a fresh project comes online. Pushups
-- / pullups match the PRD's "grease the groove" defaults; rim-orange
-- and teal pull from the existing chartPalette tokens.
insert into public.weight_room_goals (exercise, daily_target, color)
values
  ('pushups', 100, '#EA580C'),
  ('pullups', 30, '#0EA5A1')
on conflict (exercise) do nothing;
