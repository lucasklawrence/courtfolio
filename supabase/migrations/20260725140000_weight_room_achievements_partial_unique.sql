-- Replace the achievement uniqueness sentinel with partial indexes (#336).
--
-- CORRECTIVE MIGRATION. `20260725130000_weight_room_load_achievements.sql` is
-- already applied, so per CLAUDE.md § Database migrations the fix ships as its
-- own file rather than an edit to that one.
--
-- THE BUG: uniqueness was expressed as
--
--   unique (coalesce(exercise, '*'), scope, measure, threshold)
--
-- using `'*'` to stand in for the pooled "all movements" ladder, because
-- Postgres treats NULLs as distinct in a plain unique constraint and two
-- identical pooled tiers would otherwise be allowed.
--
-- But `'*'` is a perfectly valid `exercise` value — the write schema accepts any
-- non-empty string — so a tier for an exercise literally named `*` collapses
-- onto the pooled row. The collision is silent in the worst way: a seed row gets
-- skipped by `on conflict do nothing`, or a legitimate admin edit is rejected
-- with a 409 naming a tier the owner can't see. A sentinel that lives in the
-- same value space as the data it's distinguishing from can always collide.
--
-- THE FIX: two partial unique indexes, which say what is actually meant without
-- borrowing a value to mean "no value" —
--
--   * non-pooled rows are unique on (exercise, scope, measure, threshold)
--   * pooled rows are unique on (scope, measure, threshold)
--
-- `exercise = '*'` becomes just another movement name, distinct from pooled.
--
-- Not built `concurrently`: the table holds under a hundred rows, so the
-- ACCESS EXCLUSIVE window is sub-millisecond, and `create index concurrently`
-- cannot run inside the transaction a migration is applied in.
--
-- Both statements are idempotent, so re-applying on a fresh project or a branch
-- reset is a safe no-op. Callers still see SQLSTATE 23505 on a genuine
-- duplicate, so the admin routes' 409 handling is unchanged.

drop index if exists public.weight_room_achievements_metric_idx;

create unique index if not exists weight_room_achievements_metric_movement_idx
  on public.weight_room_achievements (exercise, scope, measure, threshold)
  where exercise is not null;

create unique index if not exists weight_room_achievements_metric_pooled_idx
  on public.weight_room_achievements (scope, measure, threshold)
  where exercise is null;
