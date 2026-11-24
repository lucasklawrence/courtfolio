-- Clear two Supabase performance-advisor findings (#487).
--
-- 1. auth_rls_initplan (WARN). The owner-only read policies from
--    20260726150000 call `auth.uid()` bare, so Postgres re-evaluates it for
--    every row it scans. Wrapping it in a scalar subquery, `(select auth.uid())`,
--    lets the planner run it once per statement as an InitPlan and compare a
--    constant. The predicate is the same, so who can read what does not change:
--    the owner's id still passes, any other signed-in user still reads zero rows,
--    and anon still has no policy at all.
--
--    `alter policy` rather than drop-and-create: it keeps the policy's role
--    (`authenticated`) and command (`select`) exactly as they are, never leaves
--    a window with the policy missing, and re-running it is a no-op.
--
-- 2. unindexed_foreign_keys (INFO). Five foreign keys have no index whose
--    leading column is the FK column. Postgres doesn't index the referencing
--    side automatically, so a delete or key update on the parent (a catalog
--    exercise, an OTF booking) has to scan the whole child table to enforce the
--    constraint. Every table here is small today; these keep that true as they
--    grow. Plain `create index` (not `concurrently`): migrations run inside a
--    transaction, and at these sizes the build lock is momentary.
--
--    `weight_room_template_alternates` already has a unique (slot_id, exercise)
--    index, but `exercise` is its second column, so it can't serve a lookup by
--    exercise alone.
--
-- Out of scope, checked and left as they are:
--   - The eight "unused index" findings. Low traffic makes an index look
--     unused; that alone isn't evidence to drop one.
--   - `panel_runs` has RLS on with no policies. Intentional: it is service-role
--     only (20260710120000_panel_runs.sql), and zero policies deny anon and
--     authenticated outright.
--   - `applied_migrations()` is executable by anon. Intentional: it is what
--     `npm run migrations:check` and the Migration drift workflow call with the
--     anon key (20260726130000), and it returns only migration names already
--     published in this repo.
--
-- Idempotent: `alter policy` and `create index if not exists` are both safe to
-- re-apply on a project that already has them.

alter policy "owner can read body mass trend"
  on public.cardio_body_mass_trend
  using ((select auth.uid()) = 'b82e447c-0814-408c-92be-c6dd4abdf6e4'::uuid);

alter policy "owner can read sleep trend"
  on public.cardio_sleep_trend
  using ((select auth.uid()) = 'b82e447c-0814-408c-92be-c6dd4abdf6e4'::uuid);

create index if not exists otf_sessions_booking_id_idx
  on public.otf_sessions (booking_id);

create index if not exists weight_room_monthly_focus_exercise_idx
  on public.weight_room_monthly_focus (exercise);

create index if not exists weight_room_template_alternates_exercise_idx
  on public.weight_room_template_alternates (exercise);

create index if not exists weight_room_template_slot_steps_exercise_idx
  on public.weight_room_template_slot_steps (exercise);

create index if not exists weight_room_template_slots_exercise_idx
  on public.weight_room_template_slots (exercise);
