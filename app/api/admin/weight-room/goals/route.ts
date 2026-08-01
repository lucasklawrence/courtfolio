/**
 * Admin-only collection endpoint for Weight Room goal upserts (#79).
 *
 * Settings UI hits this both for adding a new exercise and for updating
 * an existing goal's `daily_target` / `color`. The exercise name is the
 * primary key, so a single POST with `onConflict: 'exercise'` covers
 * both create and update — no separate PUT.
 *
 * Changing a target is an **append**, not a destructive update (#362): the
 * new value lands in `weight_room_goal_targets` dated from `effective_from`
 * (today unless backdated), and `weight_room_goals.daily_target` is
 * re-derived from that history as a current-value mirror. Overwriting in
 * place is what made a goal change re-score every past day — same reasoning
 * as the append-only OTF upsert in #268.
 *
 * Pair with `[exercise]/route.ts` for DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { ensureWeightRoomExercise } from '@/lib/data/ensure-weight-room-exercise'
import { WeightRoomGoalUpsertSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { currentTarget } from '@/lib/training-facility/goal-targets'
import { pacificDayKey } from '@/lib/training-facility/day-keys'
import type { GoalTargetPoint } from '@/types/weight-room'

/**
 * Synthetic floor date for a retroactive baseline row.
 *
 * Only reachable when an existing goal has no target history at all — the
 * migration backfilled every goal, and every create through this route seeds
 * one, so in practice this is dead defensive code. If it ever does fire,
 * dating the *old* target from the epoch means no logged day is left
 * uncovered, which is what stops the new target from silently re-scoring the
 * past. It is never rendered: `goalTargetChanges` treats the oldest entry as
 * the baseline rather than a change.
 */
const BASELINE_EFFECTIVE_FROM = '1970-01-01'

/**
 * The target recorded as in effect on `dayKey`, or `undefined` when no entry
 * covers it.
 *
 * Distinct from {@link targetForDay}, which is a *read* helper and therefore
 * always answers with something usable (falling back to the earliest entry, or
 * to the goal's current target). The write path needs to tell "no entry covers
 * this day" apart from "an entry covers it and happens to match", because only
 * the former should append.
 *
 * @param history Target entries for one exercise, any order.
 * @param dayKey `YYYY-MM-DD` day to resolve.
 */
function resolveRecordedTarget(
  history: readonly GoalTargetPoint[],
  dayKey: string
): number | undefined {
  let best: GoalTargetPoint | undefined
  for (const point of history) {
    if (point.effective_from > dayKey) continue
    if (best === undefined || point.effective_from > best.effective_from) best = point
  }
  return best?.daily_target
}

/**
 * Fold the rows just written into the history read a moment ago, so the mirror
 * can be resolved without a second round trip. Rows written win on a
 * `effective_from` collision, matching the upsert's `onConflict` behavior.
 *
 * @param existing History as read before the write.
 * @param written Rows passed to the upsert (may be empty).
 */
function mergeHistory(
  existing: readonly GoalTargetPoint[],
  written: readonly { daily_target: number; effective_from: string }[]
): GoalTargetPoint[] {
  const byDate = new Map<string, GoalTargetPoint>()
  for (const point of existing) byDate.set(point.effective_from, point)
  for (const row of written) {
    byDate.set(row.effective_from, {
      daily_target: row.daily_target,
      effective_from: row.effective_from,
    })
  }
  return [...byDate.values()]
}

/**
 * Upsert a goal — create-or-replace by `exercise`. Body must conform
 * to {@link WeightRoomGoalUpsertSchema}, which lowercases `exercise` so
 * `Pushups` and `pushups` collapse onto the same row instead of
 * creating duplicates.
 *
 * A `daily_target` change appends a `weight_room_goal_targets` row rather
 * than overwriting history (#362). `effective_from` in the body declares the
 * day the new target takes effect and may be **backdated** ("the 50 goal
 * actually started Aug 1") or **scheduled** ("pull-ups goes to 50 on Sept 1",
 * #371); omitted, it defaults to today.
 *
 * A future date used to be rejected, because the mirror column is written here
 * and nothing would re-sync it when the date arrived. The read path now
 * resolves the current target from history on every read, so the change simply
 * becomes current on its day — see `ExerciseGoal.daily_target`. The mirror is
 * still written below, but only as a best-effort cache: `targetForDay` excludes
 * entries dated after today, so scheduling a change deliberately leaves the
 * mirror on the *old* value until it activates.
 *
 * Write order is deliberate: history first, mirror second. If the history
 * write fails, nothing has changed and the request is cleanly retryable; if
 * only the mirror update fails, the historical scoring is still correct and
 * the next save repairs the label. The reverse order could leave a target
 * change recorded nowhere but the mirror.
 *
 * Status codes:
 * - 200 — upserted (response echoes the merged row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomGoalUpsertSchema}.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let goal
  try {
    goal = WeightRoomGoalUpsertSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  const { effective_from: requestedEffectiveFrom, ...goalFields } = goal
  const today = pacificDayKey(new Date())
  const effectiveFrom = requestedEffectiveFrom ?? today

  const supabase = createAdminSupabaseClient()
  const nowIso = new Date().toISOString()

  // What's on file already? Distinguishes a create (seed history alongside
  // the row) from an edit, and supplies the value a retroactive baseline
  // carries when a goal somehow has no history.
  const { data: existing, error: existingError } = await supabase
    .from('weight_room_goals')
    .select('exercise, daily_target')
    .eq('exercise', goalFields.exercise)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: `Failed to read goal: ${existingError.message}` },
      { status: 500 }
    )
  }

  // The whole history for this exercise. It's a handful of rows (a target
  // moves a few times a year), so fetching it beats three separate probes —
  // and it lets the decisions below reuse the same tested resolver the read
  // path uses instead of reimplementing resolution in SQL.
  const { data: historyRaw, error: historyReadError } = await supabase
    .from('weight_room_goal_targets')
    .select('daily_target, effective_from')
    .eq('exercise', goalFields.exercise)
    .order('effective_from', { ascending: true })

  if (historyReadError) {
    return NextResponse.json(
      { error: `Failed to read goal target history: ${historyReadError.message}` },
      { status: 500 }
    )
  }

  const history: GoalTargetPoint[] = (historyRaw ?? []).map(row => ({
    daily_target: row.daily_target,
    effective_from: row.effective_from,
  }))

  // The history table is FK'd to weight_room_goals, so a brand-new goal's row
  // has to exist before its seed entry can be written.
  if (existing === null) {
    // ...and as of #373 the goal itself FKs the movement catalog, so the roster
    // entry has to exist before the goal. Adding a daily target for a movement
    // that isn't in the catalog yet is the normal case for this form — it was
    // the *only* way to register an exercise before the catalog existed — so
    // provision it rather than making the admin visit two editors.
    const catalogError = await ensureWeightRoomExercise(supabase, goalFields.exercise)
    if (catalogError !== null) {
      return NextResponse.json({ error: catalogError }, { status: 500 })
    }

    const { error: insertError } = await supabase
      .from('weight_room_goals')
      .insert({ ...goalFields, updated_at: nowIso })
    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create goal: ${insertError.message}` },
        { status: 500 }
      )
    }
  }

  const historyRows: {
    exercise: string
    daily_target: number
    effective_from: string
    updated_at: string
  }[] = []

  // Retroactive baseline: a goal with no history at all needs its *old* target
  // anchored before everything, or the resolver's before-first fallback scores
  // the entire past against the new value — the exact re-scoring this feature
  // exists to prevent. Writing it unconditionally (not only when the target
  // moves) also repairs a goal left history-less by an earlier failed write,
  // which a change-gated version could never revisit.
  if (history.length === 0 && existing !== null) {
    historyRows.push({
      exercise: goalFields.exercise,
      daily_target: existing.daily_target,
      effective_from: BASELINE_EFFECTIVE_FROM,
      updated_at: nowIso,
    })
  }

  // Append when the requested target differs from whatever was *already in
  // effect on `effectiveFrom`* — not from the current mirror. Comparing
  // against the mirror silently dropped a backdate whose value matched it
  // ("the 50 actually started Aug 1" while the mirror already read 50), which
  // is precisely the backdating case this endpoint exists to support.
  const targetOnEffectiveFrom =
    history.length === 0 ? existing?.daily_target : resolveRecordedTarget(history, effectiveFrom)

  if (targetOnEffectiveFrom !== goalFields.daily_target) {
    historyRows.push({
      exercise: goalFields.exercise,
      daily_target: goalFields.daily_target,
      effective_from: effectiveFrom,
      updated_at: nowIso,
    })
  }

  if (historyRows.length > 0) {
    const { error: historyError } = await supabase
      .from('weight_room_goal_targets')
      .upsert(historyRows, { onConflict: 'exercise,effective_from' })
    if (historyError) {
      return NextResponse.json(
        { error: `Failed to record goal target history: ${historyError.message}` },
        { status: 500 }
      )
    }
  }

  // Re-derive the mirror from the post-write history rather than trusting the
  // payload: a backdated change can land *behind* a newer entry, in which case
  // the current target is unchanged and writing the payload value would
  // wrongly advance it. Merged in memory so this costs no extra round trip.
  const mergedHistory = mergeHistory(history, historyRows)
  // `currentTarget` keeps the mirror on the value actually in effect even when
  // the merged history is entirely future-dated — `targetForDay` would fall
  // back to the earliest (scheduled) entry and advance it early (#371).
  const currentDailyTarget = currentTarget({ ...goalFields, target_history: mergedHistory }, today)

  // Stamp `updated_at` explicitly so the upsert advances the row's audit
  // timestamp on edits — without this, the existing-row branch keeps
  // `updated_at` frozen at the original insert time and the data layer's
  // `MAX(updated_at)` freshness computation never reflects goal edits.
  // Mirrors the pattern used by the cardio import script's upserts.
  const upsertRow = {
    ...goalFields,
    daily_target: currentDailyTarget,
    updated_at: nowIso,
  }
  const { data, error } = await supabase
    .from('weight_room_goals')
    .upsert(upsertRow, { onConflict: 'exercise' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: `Failed to upsert goal: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/goals', handlePOST)
