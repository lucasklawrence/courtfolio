/**
 * Admin-only item endpoint for Weight Room goal deletion (#79). Sibling
 * of the collection POST — same admin gate, same service-role client.
 * Used by the Settings UI's "remove daily goal" affordance.
 *
 * As of #373 this removes the *daily ring only*. Sets FK into
 * `weight_room_exercises` (the roster), not into this table, so the movement
 * and its entire logged history survive — deleting a goal now means "stop
 * ringing this movement", not "erase it". Before #373 the FK cascaded from
 * here and this endpoint destroyed every set for the exercise.
 *
 * The one thing still cascaded is `weight_room_goal_targets`, which is
 * daily-target history and therefore goal-scoped by definition.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { pacificDayKey } from '@/lib/training-facility/day-keys'

interface Context {
  params: Promise<{ exercise: string }>
}

/**
 * What `public.delete_weight_room_goal` returns — one of three outcomes, so the
 * route can keep 409 (blocked by a live focus), 404 (no goal) and 200 apart.
 */
type DeleteGoalResult =
  | { status: 'blocked'; end_date: string }
  | { status: 'not_found' }
  | { status: 'deleted'; goal: Record<string, unknown> }

/**
 * Delete a goal — the daily ring and its target history. Logged sets are
 * untouched (#373); the movement stays in `weight_room_exercises`.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — empty `exercise` segment (shouldn't happen — Next.js routing
 *   wouldn't match — but kept defensive in case of a manual fetch)
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no goal exists for `exercise`
 * - 409 — an active or upcoming monthly focus still depends on this goal (#384)
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by Next.js
 *   handler signature.
 * @param ctx Next.js route context; `ctx.params.exercise` is the goal's
 *   primary key parsed from the URL segment.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  // Next.js App Router decodes dynamic route segments before handing them
  // to the handler, so `params.exercise` is the already-decoded user input
  // — no `decodeURIComponent` call here (matches the
  // `movement-benchmarks/[date]/route.ts` precedent and avoids the
  // URIError crash a malformed `%` sequence would otherwise produce).
  const { exercise } = await ctx.params
  const trimmed = exercise.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'exercise must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  // A live or queued monthly focus depends on this goal for its ring (#384).
  // Before #373 the FK cascaded from here, so deleting the goal took the focus
  // rows with it — which erased the record that, say, July was shrugs month.
  // The focus now survives (deliberately: #363's rotation history needs it),
  // but it would render without its ring, so refuse rather than half-break it.
  // Past windows are not a blocker: a finished focus is history, and history is
  // exactly what should outlive the goal.
  //
  // The check and the delete run as one transaction inside
  // `delete_weight_room_goal`, which takes the same per-movement lock as the
  // focus POST's `create_weight_room_monthly_focus`. As two PostgREST calls, a
  // focus created between them could slip past the guard.
  const today = pacificDayKey(new Date())
  const { data, error } = await supabase.rpc('delete_weight_room_goal', {
    p_exercise: trimmed,
    p_today: today,
  })

  if (error) {
    return NextResponse.json({ error: `Failed to delete goal: ${error.message}` }, { status: 500 })
  }

  const result = data as DeleteGoalResult | null
  if (result?.status === 'blocked') {
    return NextResponse.json(
      {
        error: `'${trimmed}' has a monthly focus running through ${result.end_date}. Remove or end that focus first — deleting the goal now would leave the focus without its daily ring.`,
      },
      { status: 409 }
    )
  }
  if (result?.status === 'deleted') {
    return NextResponse.json(result.goal, { status: 200 })
  }
  if (result?.status === 'not_found') {
    return NextResponse.json({ error: `No goal for '${trimmed}'.` }, { status: 404 })
  }
  return NextResponse.json(
    { error: 'Failed to delete goal: unexpected response from delete_weight_room_goal.' },
    { status: 500 }
  )
}

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/goals/[exercise]', handleDELETE)
