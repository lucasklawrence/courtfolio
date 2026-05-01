-- Cardio data tables (PRD §7.4) — Supabase migration of cardio.json (#152, builds on #131).
--
-- Three tables mirror the three top-level arrays in the legacy `CardioData`
-- shape (`types/cardio.ts`):
--   * cardio_sessions   — one row per workout (stair/running/walking)
--   * cardio_resting_hr — one row per measurement day (resting-HR trend)
--   * cardio_vo2max     — one row per measurement day (VO2max trend)
--
-- Granularity: session-level only. Per-second HR samples stay in HealthKit
-- as the system of record. HR-zone seconds are stored as 5 explicit
-- columns on cardio_sessions (zone1_seconds … zone5_seconds) so a future
-- "time in Z3 over months" chart can query them without unpacking JSONB.
--
-- RLS mirrors movement_benchmarks: anon + authenticated SELECT only.
-- Writes go through the service-role key (the import script runs locally
-- with SUPABASE_SERVICE_ROLE_KEY and bypasses RLS); no write API routes
-- exist for cardio because PRD §7.11 keeps cardio entries non-editable
-- from the UI — fix in HealthKit and re-import.
--
-- This file is the canonical record of the migration; it has already been
-- applied to the `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`).
-- All DDL is idempotent so re-applying on a fresh dev project (or after a
-- branch reset) is a safe no-op.

create table if not exists public.cardio_sessions (
  started_at timestamptz primary key,
  activity text not null check (activity in ('stair', 'running', 'walking')),
  duration_seconds numeric not null check (duration_seconds >= 0),
  distance_meters numeric check (distance_meters is null or distance_meters >= 0),
  avg_hr numeric check (avg_hr is null or avg_hr >= 0),
  max_hr numeric check (max_hr is null or max_hr >= 0),
  pace_seconds_per_km numeric check (pace_seconds_per_km is null or pace_seconds_per_km >= 0),
  zone1_seconds numeric check (zone1_seconds is null or zone1_seconds >= 0),
  zone2_seconds numeric check (zone2_seconds is null or zone2_seconds >= 0),
  zone3_seconds numeric check (zone3_seconds is null or zone3_seconds >= 0),
  zone4_seconds numeric check (zone4_seconds is null or zone4_seconds >= 0),
  zone5_seconds numeric check (zone5_seconds is null or zone5_seconds >= 0),
  meters_per_heartbeat numeric check (meters_per_heartbeat is null or meters_per_heartbeat >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_sessions is
  'Cardio workout sessions (stair / running / walking) — PRD §7.4. One row per session, keyed by started_at. HR-zone seconds stored as five explicit columns so individual zones are queryable without JSONB unpacking. Writes happen via the import script (service-role) — no admin write API.';

create index if not exists cardio_sessions_activity_started_at_idx
  on public.cardio_sessions (activity, started_at desc);

alter table public.cardio_sessions enable row level security;

-- Postgres has no `create policy if not exists`; use a DO block to swallow
-- the duplicate-object error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read cardio sessions"
    on public.cardio_sessions
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_resting_hr (
  date date primary key,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_resting_hr is
  'Resting heart-rate trend (PRD §7.4). One row per calendar day; primary key is the calendar date so re-imports overwrite the same day''s value rather than duplicate it.';

alter table public.cardio_resting_hr enable row level security;

do $$
begin
  create policy "anon and authenticated can read resting hr"
    on public.cardio_resting_hr
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_vo2max (
  date date primary key,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_vo2max is
  'VO2max trend (PRD §7.4). One row per measurement day; primary key is the calendar date.';

alter table public.cardio_vo2max enable row level security;

do $$
begin
  create policy "anon and authenticated can read vo2max"
    on public.cardio_vo2max
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
