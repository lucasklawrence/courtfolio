/**
 * Admin-only collection endpoint for Weight Room monthly focuses (#255).
 *
 * Lets the admin queue a "grease the groove" exercise of the month
 * without a seed migration — the Up Next roadmap reads straight from
 * `weight_room_monthly_focus`. RLS on that table permits SELECT only, so
 * writes funnel through this gate via the service-role client.
 *
 * Each create does two writes: it first ensures a `kind: 'focus'` goal
 * anchor exists for the exercise (so set logging satisfies the
 * `weight_room_sets.exercise` FK and the rings/rollup reuse existing
 * machinery), then inserts the focus row. The anchor upsert uses
 * `ignoreDuplicates` so it never clobbers an exercise that already has a
 * goal (e.g. a permanent pushups goal stays permanent).
 *
 * Pair with `[id]/route.ts` for DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomMonthlyFocusCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Create a monthly focus. Body must conform to
 * {@link WeightRoomMonthlyFocusCreateSchema} — `exercise` (lowercased),
 * `daily_target`, `color`, `start_date`, `end_date` required;
 * `target_kind` defaults to `'reps'`.
 *
 * Status codes:
 * - 201 — created (response echoes the focus row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 500 — unexpected Supabase error (anchor upsert or focus insert)
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomMonthlyFocusCreateSchema}.
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

  let focus
  try {
    focus = WeightRoomMonthlyFocusCreateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 },
      )
    }
    throw err
  }

  const supabase = createAdminSupabaseClient()

  // 1. Ensure the goal anchor exists. ignoreDuplicates leaves an existing
  //    goal untouched so we never flip a permanent exercise to 'focus'.
  const now = new Date().toISOString()
  const { error: anchorError } = await supabase.from('weight_room_goals').upsert(
    {
      exercise: focus.exercise,
      daily_target: focus.daily_target,
      color: focus.color,
      kind: 'focus',
      updated_at: now,
    },
    { onConflict: 'exercise', ignoreDuplicates: true },
  )
  if (anchorError) {
    return NextResponse.json(
      { error: `Failed to anchor focus goal: ${anchorError.message}` },
      { status: 500 },
    )
  }

  // 2. Insert the focus row.
  const { data, error } = await supabase
    .from('weight_room_monthly_focus')
    .insert({
      exercise: focus.exercise,
      daily_target: focus.daily_target,
      target_kind: focus.target_kind,
      color: focus.color,
      category: focus.category,
      start_date: focus.start_date,
      end_date: focus.end_date,
      updated_at: now,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to create monthly focus: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/monthly-focus', handlePOST)
