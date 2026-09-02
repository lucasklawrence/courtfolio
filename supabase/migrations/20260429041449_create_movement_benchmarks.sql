-- Movement benchmarks — the combine-style athletic testing table.
--
-- RECONSTRUCTED FROM THE LIVE SCHEMA. This table was applied to the
-- `court-vision` project on 2026-04-29 (migration `create_movement_benchmarks`,
-- version 20260429041449) but its .sql file was never committed, so the repo
-- could not rebuild the database from source. This file closes that gap; the
-- filename deliberately carries the original applied version so the ledger and
-- the repo agree by name, and `scripts/check-migration-drift.mjs` sees it as
-- applied rather than pending.
--
-- Written to match production exactly as introspected:
--   * primary key on `date` (one row per measurement day)
--   * every metric column nullable — a session may test only one movement
--   * RLS on, with a single anon+authenticated SELECT policy; writes go through
--     the service-role key via /api/admin/movement-benchmarks
--   * a `set_updated_at` BEFORE UPDATE trigger
--
-- Applying this to production is a no-op: every statement is idempotent and the
-- objects already exist. It matters for rebuilding a fresh project or a branch.
--
-- NOTE ON THE TRIGGER: `movement_benchmarks` is the ONLY table in this schema
-- that maintains `updated_at` with a trigger. Every table added later (cardio_*,
-- weight_room_*, otf_*, panel_runs) leaves `updated_at` to its column default
-- and lets the writer set it explicitly. Preserved here as-is because it is what
-- production actually does — do not "harmonise" it without checking the admin
-- write path, which relies on the trigger to stamp edits.

-- The trigger function is defined here because this is the first (and only)
-- migration that needs it. `search_path` is pinned to '' per Supabase's
-- function-security guidance, so the body must schema-qualify everything.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger function stamping updated_at = now(). Used only by movement_benchmarks; later tables leave updated_at to the column default.';

create table if not exists public.movement_benchmarks (
  date date primary key,
  bodyweight_lbs numeric,
  shuttle_5_10_5_s numeric,
  vertical_in numeric,
  sprint_10y_s numeric,
  notes text,
  is_complete boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.movement_benchmarks is
  'Combine-style athletic benchmarks, one row per measurement day keyed by date. All metric columns are nullable because a testing session may cover only some movements. Read publicly via RLS; written through the admin API with the service-role key.';

alter table public.movement_benchmarks enable row level security;

-- Postgres has no `create policy if not exists`; use a DO block to swallow the
-- duplicate-object error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read benchmarks"
    on public.movement_benchmarks
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

drop trigger if exists movement_benchmarks_set_updated_at on public.movement_benchmarks;
create trigger movement_benchmarks_set_updated_at
  before update on public.movement_benchmarks
  for each row
  execute function public.set_updated_at();
