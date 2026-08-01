/**
 * Admin-only endpoint for cancelling a **scheduled** daily-target change (#371).
 *
 * `POST /api/admin/weight-room/goals` can queue a change for a future date; this
 * is how you take it back. It deletes exactly one `weight_room_goal_targets`
 * row, addressed by the goal it belongs to and its `effective_from`.
 *
 * **Only future rows are deletable.** An entry dated on or before today is
 * already in effect and is *history* — every rollup that scored a past day
 * resolved its target through it, so removing one would silently re-score days
 * already completed, which is the exact failure effective-dating exists to
 * prevent (#362). Those return 409, not 404: the row is there, it just isn't
 * yours to erase.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { pacificDayKey } from '@/lib/training-facility/day-keys'

interface Context {
  params: Promise<{ exercise: string; effective_from: string }>
}

/** `YYYY-MM-DD`, the shape `effective_from` is stored and addressed as. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Cancel a scheduled target change.
 *
 * Status codes:
 * - 200 — deleted (response echoes the removed row)
 * - 400 — empty `exercise`, or `effective_from` isn't a `YYYY-MM-DD` day key
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no target row for that exercise + date
 * - 409 — the row is dated on or before today, so it's history, not a schedule
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by the Next.js
 *   handler signature.
 * @param ctx Route context; both segments arrive already URL-decoded.
 * @throws when Supabase env vars are missing (misconfigured deploy). Domain
 *   failures are returned as JSON responses, not thrown.
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { exercise, effective_from: effectiveFrom } = await ctx.params
  const trimmedExercise = exercise.trim()
  if (trimmedExercise.length === 0) {
    return NextResponse.json({ error: 'exercise must be non-empty.' }, { status: 400 })
  }
  if (!DAY_KEY_PATTERN.test(effectiveFrom)) {
    return NextResponse.json(
      { error: 'effective_from must be a YYYY-MM-DD date.' },
      { status: 400 }
    )
  }

  // Pacific, matching how the read path decides which entry is current (#319,
  // #371). Comparing against a UTC date would make a change scheduled for
  // tomorrow look already-active for the last 7-8 hours of today.
  const today = pacificDayKey(new Date())
  if (effectiveFrom <= today) {
    return NextResponse.json(
      {
        error: `The ${effectiveFrom} target is already in effect — past targets are history and can't be removed. Only a change scheduled for a future date can be cancelled.`,
      },
      { status: 409 }
    )
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_goal_targets')
    .delete()
    .eq('exercise', trimmedExercise)
    .eq('effective_from', effectiveFrom)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to cancel scheduled target: ${error.message}` },
      { status: 500 }
    )
  }
  if (data === null) {
    return NextResponse.json(
      { error: `No scheduled target for '${trimmedExercise}' on ${effectiveFrom}.` },
      { status: 404 }
    )
  }

  // The mirror column deliberately isn't touched. It holds the target in effect
  // *today*, and cancelling a future change doesn't move today's number — the
  // read path resolves it from history on every read anyway (#371).
  return NextResponse.json(data, { status: 200 })
}

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry(
  'DELETE /api/admin/weight-room/goals/[exercise]/targets/[effective_from]',
  handleDELETE
)
