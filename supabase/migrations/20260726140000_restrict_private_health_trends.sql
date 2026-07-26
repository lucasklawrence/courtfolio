-- Restrict bodyweight and sleep to authenticated readers (#345).
--
-- Publishing the Weight Room and Gym puts `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
-- reach of the public: any client component importing the browser Supabase
-- client inlines it at build time. #345 removes that dependency from the public
-- routes, but "no client component imports the browser client" is a property
-- one careless import can undo silently. This migration is the second,
-- independent layer: even holding the anon key, the private tables are not
-- readable.
--
-- WHY THESE TWO AND NOT THE OTHER TRENDS: the rest of the lifestyle tables
-- (resting HR, walking HR, HRV, VO2max, step count, active energy) back charts
-- on the Gym pages being published, so restricting them would silently blank
-- live content. Bodyweight and sleep are the two the owner chose not to
-- publish, and they are the most sensitive of the set.
--
-- Read paths are unaffected while signed in: `createServerSupabaseClient()`
-- carries the session cookie, so an admin's server reads run as
-- `authenticated`. For anon, RLS with no permitting policy returns **zero
-- rows** rather than an error, so consumers degrade instead of throwing —
-- `app/training-facility/weight-room/history/page.tsx` already guards its
-- relative-strength chart on `bodyMass.length > 0`, so it self-hides.
--
-- Writes are untouched: the ingest path (`app/api/health/auto-sync`,
-- `app/api/admin/cardio/trends`) uses the service-role client, which bypasses
-- RLS entirely.
--
-- This file is the canonical record of the migration; it is also applied to the
-- `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`) via the Supabase
-- tooling. Idempotent — `drop policy if exists` then recreate — so re-applying
-- on a fresh project or a branch reset is a safe no-op.

-- Bodyweight: plotted against pull-up volume on the Weight Room history page,
-- and as a standalone trend on the Gym overview. Deliberately not public.
drop policy if exists "anon and authenticated can read body mass trend"
  on public.cardio_body_mass_trend;

create policy "authenticated can read body mass trend"
  on public.cardio_body_mass_trend
  for select
  to authenticated
  using (true);

-- Sleep: not part of the published training story.
drop policy if exists "anon and authenticated can read sleep trend"
  on public.cardio_sleep_trend;

create policy "authenticated can read sleep trend"
  on public.cardio_sleep_trend
  for select
  to authenticated
  using (true);
