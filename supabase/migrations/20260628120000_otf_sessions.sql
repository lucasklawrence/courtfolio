-- OTbeat (OrangeTheory) studio-workout sessions (#251).
--
-- One row per Orangetheory class, ingested from the weekly
-- "Studio Workout Summary" emails (OTbeatReport@orangetheoryfitness.com)
-- by scripts/import-otbeat.mjs.
--
-- WHY A DEDICATED TABLE (not cardio_sessions): an OTF class carries data
-- cardio_sessions has no columns for — splat points, calories, steps, the
-- full treadmill + rower performance blocks, the coach, and the studio.
-- Folding it into cardio_sessions would drop all of that. PRD §7.4's
-- cardio_sessions stays the Apple-Health-derived stair/run/walk record;
-- this table is the studio-class record.
--
-- WHY APPEND-ONLY (no prune): the cardio import (`upsertCardioData`) mirrors
-- the full Apple-Health archive each run and prunes Supabase rows absent
-- from the export. OTbeat is the opposite — an *incremental* weekly pull of
-- whatever emails are newer than the lookback window. The importer
-- (`upsertOtfSessions`) therefore upserts by `started_at` and NEVER prunes,
-- so re-pulling the overlap window is idempotent and history is never lost.
--
-- Zone minutes are five explicit columns (mirroring cardio_sessions'
-- zone1..5_seconds) so a "minutes in the orange/red zone over time" chart can
-- query them without unpacking JSONB. The treadmill / rower blocks are JSONB
-- because they are ~9 fields each, are null on tread-only / anomaly class
-- formats, map 1:1 to the parser's nested output, and feed a per-session
-- detail view rather than cross-session aggregate axes. Promote a field to a
-- real column later if it becomes a chart axis.
--
-- RLS mirrors cardio_sessions: anon + authenticated SELECT only. Writes go
-- through the service-role key (the import script / GitHub Action set
-- SUPABASE_SERVICE_ROLE_KEY and bypass RLS); there is no write API route.
--
-- This file is the canonical record of the migration; it has already been
-- applied to the `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`).
-- All DDL is idempotent so re-applying on a fresh dev project (or after a
-- branch reset) is a safe no-op.

create table if not exists public.otf_sessions (
  started_at timestamptz primary key,
  coach text,
  studio text,
  calories numeric check (calories is null or calories >= 0),
  splat numeric check (splat is null or splat >= 0),
  steps numeric check (steps is null or steps >= 0),
  avg_hr numeric check (avg_hr is null or avg_hr >= 0),
  peak_hr numeric check (peak_hr is null or peak_hr >= 0),
  zone_gray_min numeric check (zone_gray_min is null or zone_gray_min >= 0),
  zone_blue_min numeric check (zone_blue_min is null or zone_blue_min >= 0),
  zone_green_min numeric check (zone_green_min is null or zone_green_min >= 0),
  zone_orange_min numeric check (zone_orange_min is null or zone_orange_min >= 0),
  zone_red_min numeric check (zone_red_min is null or zone_red_min >= 0),
  treadmill jsonb,
  rower jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.otf_sessions is
  'OrangeTheory (OTbeat) studio-class sessions (#251). One row per class, keyed by started_at, ingested from the weekly OTbeatReport summary emails. Append-only (the importer upserts by started_at and never prunes) because the source is an incremental email pull, not a full-archive re-export like cardio_sessions. Zone minutes are explicit columns; the treadmill and rower performance blocks are JSONB (null on class formats that omit them).';

create index if not exists otf_sessions_coach_started_at_idx
  on public.otf_sessions (coach, started_at desc);

alter table public.otf_sessions enable row level security;

-- Postgres has no `create policy if not exists`; use a DO block to swallow
-- the duplicate-object error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read otf sessions"
    on public.otf_sessions
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
