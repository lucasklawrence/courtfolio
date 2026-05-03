-- Per-session HR sample stream (PRD §7.4) — extends #152's cardio schema (#165).
--
-- The base `cardio_sessions` table stores aggregates only (avg/max HR,
-- five zone-second columns). To render a per-session HR curve on the
-- detail page (`/training-facility/gym/session/[started_at]`), we need
-- the raw HR sample stream that Apple Watch records during a workout.
--
-- Storage cost is bounded at this scale: ~2,200 samples/session ×
-- ~200 sessions/year × ~100 bytes/row ≈ 50 MB/year. Supabase free tier
-- (500 MB) holds ~10 years of history before any pruning is needed.
--
-- Cascade delete on `session_started_at` keeps samples consistent if a
-- session is ever pruned by the import script's "exact mirror" logic
-- (PRD §7.11 — fix in HealthKit, re-import). Without it, a deleted
-- session would leave orphan samples that the dashboard never queries
-- but that count against the storage budget.
--
-- RLS mirrors `cardio_sessions`: anon + authenticated SELECT only.
-- Writes go through the service-role import script (bypasses RLS); no
-- write API routes exist for cardio data.
--
-- This file is the canonical record of the migration. The DDL is
-- idempotent so re-applying on a fresh dev project is a safe no-op.

create table if not exists public.cardio_session_hr_samples (
  session_started_at timestamptz not null
    references public.cardio_sessions(started_at) on delete cascade,
  sample_at timestamptz not null,
  bpm numeric not null check (bpm >= 0),
  primary key (session_started_at, sample_at)
);

comment on table public.cardio_session_hr_samples is
  'Raw HR sample stream for cardio sessions (#165). One row per Apple Watch HR sample during a workout, FK-linked to cardio_sessions with cascade delete. Powers the per-session detail page''s HR curve.';

create index if not exists cardio_session_hr_samples_session_idx
  on public.cardio_session_hr_samples (session_started_at);

alter table public.cardio_session_hr_samples enable row level security;

-- Postgres has no `create policy if not exists`; use a DO block to
-- swallow the duplicate-object error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read cardio hr samples"
    on public.cardio_session_hr_samples
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
