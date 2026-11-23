-- Heartbeat for scheduled ingests (#456).
--
-- One row per *successful* completion of a scheduled job, written as the job's
-- last step by scripts/record-ingest-run.mjs. An alert on
-- `max(ran_at) where job = '<job>'` going stale catches the failure an
-- in-workflow step never can: the run that never happens (a disabled schedule,
-- a dropped scheduled run, a cron edit that never fires).
--
-- The signal is "the job ran", deliberately not "data arrived": OTF attendance
-- is a few classes a week, so a data-freshness alert would either fire on every
-- quiet stretch or be too loose to catch real breakage.
--
-- Private: RLS on, no policies, anon/authenticated privileges revoked. The job
-- writes with the service-role key, which bypasses RLS. A dashboard reader gets
-- its own read-only role with `select` on this table only (see scripts/README.md).

create table if not exists public.ingest_runs (
  id bigint generated always as identity primary key,
  job text not null,
  ran_at timestamptz not null default now(),
  run_url text
);

comment on table public.ingest_runs is
  'One row per successful scheduled-ingest run; heartbeat for staleness alerts (#456).';
comment on column public.ingest_runs.job is
  'Stable job key, e.g. otbeat-ingest. Matches the workflow''s ALERT_JOB.';
comment on column public.ingest_runs.ran_at is
  'When the run finished successfully.';
comment on column public.ingest_runs.run_url is
  'GitHub Actions run URL, when written from a workflow.';

create index if not exists ingest_runs_job_ran_at_idx
  on public.ingest_runs (job, ran_at desc);

alter table public.ingest_runs enable row level security;

-- Supabase grants anon and authenticated table privileges by default; take
-- them back so the table is reachable only by the service role and roles
-- granted explicitly.
revoke all on public.ingest_runs from anon, authenticated;
