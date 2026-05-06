-- Cardio lifestyle-metric trend tables (PRD §7.4 / #75 slice C-data).
--
-- Six daily-series trends ported from `lucasklawrence/cardio-dashboard` —
-- each one is a `(date, value)` row keyed by calendar date so a re-import
-- overwrites a day's measurement rather than duplicating it. Mirrors the
-- existing `cardio_resting_hr` / `cardio_vo2max` shape from
-- `20260430120000_cardio_tables.sql`; same RLS policy (anon SELECT,
-- service-role writes).
--
--   * cardio_hrv_trend           — heart-rate variability (SDNN), ms
--   * cardio_walking_hr_trend    — walking HR average, BPM
--   * cardio_body_mass_trend     — body mass, normalized to lbs at preprocess time
--   * cardio_step_count_trend    — daily step total, count
--   * cardio_sleep_trend         — total asleep time per wake-day, hours
--   * cardio_active_energy_trend — daily active energy total, kilocalories
--
-- Granularity: one row per local calendar day. Apple Health emits these as
-- per-record bursts; the Python preprocessor (`scripts/preprocess-health.py`)
-- collapses them to per-day aggregates before the import script writes.
-- The aggregation policy is intentional and varies by metric — see the
-- preprocessor for the per-metric rationale.
--
-- Constraints: value is `> 0` for metrics where 0 is implausible (HRV,
-- walking HR, body mass) and `>= 0` for volume metrics where a 0-day is
-- possible (steps, sleep hours, active energy on a full rest day).
--
-- This file is the canonical record of the migration. All DDL is
-- idempotent (`create table if not exists`, `do $$` policy guards) so
-- re-applying on a fresh dev project (or after a branch reset) is safe.

create table if not exists public.cardio_hrv_trend (
  date date primary key,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_hrv_trend is
  'Heart-rate variability (SDNN) trend (PRD §7.4). One row per measurement day; primary key is the calendar date so re-imports overwrite the same day''s value rather than duplicate it.';

alter table public.cardio_hrv_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read hrv trend"
    on public.cardio_hrv_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_walking_hr_trend (
  date date primary key,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_walking_hr_trend is
  'Walking heart-rate average trend (PRD §7.4). One row per measurement day; primary key is the calendar date.';

alter table public.cardio_walking_hr_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read walking hr trend"
    on public.cardio_walking_hr_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_body_mass_trend (
  date date primary key,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_body_mass_trend is
  'Body mass trend (PRD §7.4). One row per measurement day; values normalized to pounds at preprocess time so the dashboard can render without a unit-conversion step.';

alter table public.cardio_body_mass_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read body mass trend"
    on public.cardio_body_mass_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_step_count_trend (
  date date primary key,
  value numeric not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_step_count_trend is
  'Daily step-count total (PRD §7.4). One row per local calendar day; the preprocessor sums Apple Health''s per-burst step records into a single daily total before insert.';

alter table public.cardio_step_count_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read step count trend"
    on public.cardio_step_count_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_sleep_trend (
  date date primary key,
  value numeric not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_sleep_trend is
  'Sleep trend (PRD §7.4). One row per wake-day (the calendar day the user woke up — Apple Health''s convention); value is the total asleep-time in hours, summing only HKCategoryValueSleepAnalysisAsleep* periods so in-bed-but-awake time is excluded.';

alter table public.cardio_sleep_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read sleep trend"
    on public.cardio_sleep_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.cardio_active_energy_trend (
  date date primary key,
  value numeric not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardio_active_energy_trend is
  'Daily active-energy total (PRD §7.4), kilocalories. The preprocessor sums Apple Health''s per-burst active-energy records into one daily total before insert.';

alter table public.cardio_active_energy_trend enable row level security;

do $$
begin
  create policy "anon and authenticated can read active energy trend"
    on public.cardio_active_energy_trend
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
