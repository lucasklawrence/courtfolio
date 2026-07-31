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
import { WeightRoomGoalUpsertSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { pacificDayKey } from '@/lib/training-facility/load-management'

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
 * Upsert a goal — create-or-replace by `exercise`. Body must conform
 * to {@link WeightRoomGoalUpsertSchema}, which lowercases `exercise` so
 * `Pushups` and `pushups` collapse onto the same row instead of
 * creating duplicates.
 *
 * A `daily_target` change appends a `weight_room_goal_targets` row rather
 * than overwriting history (#362). `effective_from` in the body declares the
 * day the new target takes effect and may be **backdated** ("the 50 goal
 * actually started Aug 1"); omitted, it defaults to today. Future dates are
 * rejected — the mirror column below records the target in effect *now*, and
 * a future-dated change would leave it stale from the moment that date
 * arrived with nothing to re-sync it.
 *
 * Write order is deliberate: history first, mirror second. If the history
 * write fails, nothing has changed and the request is cleanly retryable; if
 * only the mirror update fails, the historical scoring is still correct and
 * the next save repairs the label. The reverse order could leave a target
 * change recorded nowhere but the mirror.
 *
 * Status codes:
 * - 200 — upserted (response echoes the merged row)
 * - 400 — payload failed Zod validation, wasn't valid JSON, or
 *   `effective_from` is in the future
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
  if (effectiveFrom > today) {
    return NextResponse.json(
      {
        error:
          'effective_from cannot be in the future — a target change takes effect on or before today.',
      },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()
  const nowIso = new Date().toISOString()

  // What's on file already? Distinguishes a create (seed history alongside
  // the row) from an edit (append only when the target actually moved), and
  // a colour-only edit must not manufacture a history entry.
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

  // The history table is FK'd to weight_room_goals, so a brand-new goal's row
  // has to exist before its seed entry can be written.
  if (existing === null) {
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

  const targetChanged = existing !== null && existing.daily_target !== goalFields.daily_target

  if (existing === null || targetChanged) {
    const historyRows = [
      {
        exercise: goalFields.exercise,
        daily_target: goalFields.daily_target,
        effective_from: effectiveFrom,
        updated_at: nowIso,
      },
    ]

    // Defensive baseline: an existing goal whose target is changing but which
    // carries no history would leave every day before `effectiveFrom`
    // uncovered, and the resolver's before-first fallback would score them
    // against the *new* target — the very re-scoring this feature exists to
    // prevent. Anchor the old value at the epoch so the past stays intact.
    if (targetChanged) {
      const { count, error: countError } = await supabase
        .from('weight_room_goal_targets')
        .select('id', { count: 'exact', head: true })
        .eq('exercise', goalFields.exercise)
      if (countError) {
        return NextResponse.json(
          { error: `Failed to read goal target history: ${countError.message}` },
          { status: 500 }
        )
      }
      if ((count ?? 0) === 0) {
        historyRows.unshift({
          exercise: goalFields.exercise,
          daily_target: existing.daily_target,
          effective_from: BASELINE_EFFECTIVE_FROM,
          updated_at: nowIso,
        })
      }
    }

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

  // Re-derive the mirror from history rather than trusting the payload: a
  // backdated change can land *behind* a newer entry, in which case the
  // current target is unchanged and writing the payload value would wrongly
  // advance it.
  const { data: currentTarget, error: currentError } = await supabase
    .from('weight_room_goal_targets')
    .select('daily_target')
    .eq('exercise', goalFields.exercise)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (currentError) {
    return NextResponse.json(
      { error: `Failed to resolve current goal target: ${currentError.message}` },
      { status: 500 }
    )
  }

  // Stamp `updated_at` explicitly so the upsert advances the row's audit
  // timestamp on edits — without this, the existing-row branch keeps
  // `updated_at` frozen at the original insert time and the data layer's
  // `MAX(updated_at)` freshness computation never reflects goal edits.
  // Mirrors the pattern used by the cardio import script's upserts.
  const upsertRow = {
    ...goalFields,
    daily_target: currentTarget?.daily_target ?? goalFields.daily_target,
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
