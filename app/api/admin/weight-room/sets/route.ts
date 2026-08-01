/**
 * Admin-only collection endpoint for Weight Room set inserts (#79).
 *
 * The Today View's quick-log writes here whenever the admin taps a set
 * count. RLS on `weight_room_sets` permits SELECT only, so writes
 * funnel through this gate via the service-role client.
 *
 * Pair with `[id]/route.ts` for DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomSetCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { emitMetric } from '@/lib/telemetry/client'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Insert a new strength set. Body must conform to
 * {@link WeightRoomSetCreateSchema} — `exercise` and `reps` required;
 * `logged_at` optional (defaults to `now()` when omitted).
 *
 * Status codes:
 * - 201 — created (response echoes the row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 409 — `exercise` isn't in the `weight_room_exercises` roster (add it via
 *   the settings catalog first), or `workout_id` names a session that doesn't
 *   exist (#374)
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomSetCreateSchema}.
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

  let entry
  try {
    entry = WeightRoomSetCreateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  const supabase = createAdminSupabaseClient()
  const insertRow = {
    exercise: entry.exercise,
    reps: entry.reps,
    logged_at: entry.logged_at ?? new Date().toISOString(),
    // Only send `variant` when the writer supplied one (#254). The
    // schema normalizes empty / whitespace / null to `undefined`, so an
    // omitted grip leaves the column at its `null` DB default rather
    // than writing an empty-string bucket the History View would have
    // to special-case.
    ...(entry.variant != null ? { variant: entry.variant } : {}),
    // External load, per implement (#376). Absent leaves the column null,
    // which is what makes a set bodyweight.
    ...(entry.weight_lbs != null ? { weight_lbs: entry.weight_lbs } : {}),
    // Session membership (#374), only when the caller asked for it. There is
    // deliberately no "attach to whatever workout is open" fallback: a
    // grease-the-groove set logged during a gym window must stay loose.
    ...(entry.workout_id != null ? { workout_id: entry.workout_id } : {}),
    ...(entry.position != null ? { position: entry.position } : {}),
    ...(entry.template_slot_id != null ? { template_slot_id: entry.template_slot_id } : {}),
  }
  const { data, error } = await supabase
    .from('weight_room_sets')
    .insert(insertRow)
    .select()
    .single()

  if (error) {
    // Postgres FK violation. Two FKs can fire here now, so name the right one
    // — blaming the exercise for a bad workout_id sends the caller to the
    // settings page to fix something that isn't broken. The violated
    // constraint's name is in the message; match on the workout FK first
    // since the exercise one is the far more common case and reads as the
    // sensible default.
    if (error.code === '23503') {
      if (error.message.includes('template_slot_id')) {
        return NextResponse.json(
          { error: `Template slot '${entry.template_slot_id}' does not exist.` },
          { status: 409 }
        )
      }
      if (error.message.includes('workout_id')) {
        return NextResponse.json(
          { error: `Workout '${entry.workout_id}' does not exist.` },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error: `Exercise '${entry.exercise}' is not in the movement catalog. Add it in settings before logging sets.`,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: `Failed to insert set: ${error.message}` }, { status: 500 })
  }

  // Domain metric for the App-health dashboard (#220): one sample per
  // logged set, reps as the value. The exercise name is a low-cardinality
  // dimension (the FK above guarantees it's from the configured goal list).
  emitMetric('weight_room_set_logged', entry.reps, {
    unit: 'reps',
    attributes: { exercise: entry.exercise },
  })

  return NextResponse.json(data, { status: 201 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/sets', handlePOST)
