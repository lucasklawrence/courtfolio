-- Make the goal-delete monthly-focus guard atomic (#384, from the #388 review).
--
-- THE RACE: `DELETE /api/admin/weight-room/goals/[exercise]` refuses (409) while
-- an active or upcoming monthly focus still needs the goal's ring. It did that
-- as two PostgREST calls: a `select` on `weight_room_monthly_focus`, then a
-- separate `delete` on `weight_room_goals`. Meanwhile the focus POST is also two
-- calls: an `ignoreDuplicates` upsert of the goal anchor, then the focus insert.
-- Interleave them (anchor no-op because the goal exists, guard finds no focus,
-- goal deleted, focus inserted) and a live focus is left without its ring.
--
-- Closing it takes both sides. PostgREST can't express
-- `delete ... where not exists (...)`, and a lone conditional delete wouldn't be
-- enough anyway: under READ COMMITTED it reads focuses as of its own snapshot,
-- and the focus POST's anchor step has already run by the time its insert
-- arrives. So each write becomes one function, and both start by locking the
-- same row: the movement's `weight_room_exercises` row, `for no key update`.
-- Every goal and every focus FKs that row, so it's the natural per-movement
-- mutex. Two `for no key update` locks on one row conflict, so the functions
-- serialise against each other. They don't conflict with the `for key share`
-- an FK check takes, so logging a set for the movement never waits on them.
-- With both functions holding it, the two orders are:
--   - create first: the delete waits, then its check (a new statement, so a new
--     snapshot) sees the committed focus and returns `blocked`;
--   - delete first: the create waits, then its anchor insert finds the goal
--     gone and inserts a fresh `kind: 'focus'` anchor, so the focus still gets
--     a ring.
--
-- delete_weight_room_goal(p_exercise, p_today) returns jsonb, so the route can
-- keep its three outcomes distinct:
--   {"status":"blocked","end_date":"YYYY-MM-DD"}  -> 409, a live/queued focus
--   {"status":"not_found"}                        -> 404, no goal for the slug
--   {"status":"deleted","goal":{...row...}}       -> 200, the removed row
-- `blocked` is checked before `not_found`, the same precedence as before.
-- `end_date` is the latest end among the live and queued focuses, the day after
-- which the delete will actually succeed, not just the first one in the way.
-- `p_today` is the caller's Pacific day key (`pacificDayKey`), not
-- `current_date`, so "live" means the same thing as on every surface that
-- renders the rotation. Only windows ending on or after it block: a finished
-- focus is history and should outlive the goal.
--
-- create_weight_room_monthly_focus(...) returns the inserted focus row as jsonb.
-- The anchor insert is `on conflict (exercise) do nothing`, the same
-- never-clobber rule as the old `ignoreDuplicates` upsert: an existing permanent
-- goal stays permanent. The catalog row must already exist (the route still
-- calls `ensureWeightRoomExercise` first). If it doesn't, the FK raises 23503
-- exactly as the direct insert did.
--
-- SECURITY INVOKER. The only caller is the admin routes' service-role client,
-- which bypasses RLS. EXECUTE goes to service_role alone. `search_path` is
-- pinned to '' and every reference is schema-qualified.
--
-- Idempotent: `create or replace` plus unconditional revoke and grant, so
-- re-applying is a safe no-op.

create or replace function public.delete_weight_room_goal(p_exercise text, p_today date)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_blocking_end date;
  v_goal jsonb;
begin
  -- Per-movement mutex shared with create_weight_room_monthly_focus. No catalog
  -- row means no goal or focus can reference the slug, so nothing to lock.
  perform 1
  from public.weight_room_exercises e
  where e.slug = p_exercise
  for no key update;

  select max(f.end_date)
  into v_blocking_end
  from public.weight_room_monthly_focus f
  where f.exercise = p_exercise
    and f.end_date >= p_today;

  if v_blocking_end is not null then
    return jsonb_build_object('status', 'blocked', 'end_date', v_blocking_end);
  end if;

  delete from public.weight_room_goals g
  where g.exercise = p_exercise
  returning to_jsonb(g.*) into v_goal;

  if v_goal is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'deleted', 'goal', v_goal);
end;
$function$;

comment on function public.delete_weight_room_goal(text, date) is
  'Delete a Weight Room daily goal unless an active or upcoming monthly focus (end_date >= p_today) still depends on it, in one transaction. Locks the movement''s weight_room_exercises row FOR NO KEY UPDATE first, the same mutex create_weight_room_monthly_focus takes, so a focus cannot be created between the check and the delete. Returns {"status":"blocked","end_date" (latest live end)} | {"status":"not_found"} | {"status":"deleted","goal"}. Service-role only; called by DELETE /api/admin/weight-room/goals/[exercise] (#384).';

revoke all on function public.delete_weight_room_goal(text, date) from public, anon, authenticated;
grant execute on function public.delete_weight_room_goal(text, date) to service_role;

create or replace function public.create_weight_room_monthly_focus(
  p_exercise text,
  p_daily_target integer,
  p_target_kind text,
  p_color text,
  p_category text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_focus jsonb;
begin
  -- Per-movement mutex shared with delete_weight_room_goal (see header).
  perform 1
  from public.weight_room_exercises e
  where e.slug = p_exercise
  for no key update;

  insert into public.weight_room_goals (exercise, daily_target, color, kind, updated_at)
  values (p_exercise, p_daily_target, p_color, 'focus', now())
  on conflict (exercise) do nothing;

  insert into public.weight_room_monthly_focus (
    exercise, daily_target, target_kind, color, category, start_date, end_date, updated_at
  )
  values (
    p_exercise, p_daily_target, p_target_kind, p_color, p_category, p_start_date, p_end_date, now()
  )
  returning to_jsonb(weight_room_monthly_focus.*) into v_focus;

  return v_focus;
end;
$function$;

comment on function public.create_weight_room_monthly_focus(text, integer, text, text, text, date, date) is
  'Create a monthly focus and, if the movement has no daily goal yet, its kind=focus goal anchor, in one transaction. Locks the movement''s weight_room_exercises row FOR NO KEY UPDATE first, the same mutex delete_weight_room_goal takes, so the goal cannot be deleted between the anchor and the focus insert. Returns the inserted focus row. Service-role only; called by POST /api/admin/weight-room/monthly-focus (#384).';

revoke all on function public.create_weight_room_monthly_focus(text, integer, text, text, text, date, date) from public, anon, authenticated;
grant execute on function public.create_weight_room_monthly_focus(text, integer, text, text, text, date, date) to service_role;
