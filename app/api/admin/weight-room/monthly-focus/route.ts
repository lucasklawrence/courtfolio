/**
 * Admin-only collection endpoint for Weight Room monthly focuses (#255).
 *
 * Lets the admin queue a "grease the groove" exercise of the month
 * without a seed migration — the Up Next roadmap reads straight from
 * `weight_room_monthly_focus`. RLS on that table permits SELECT only, so
 * writes funnel through this gate via the service-role client.
 *
 * Each create ensures the movement is in the catalog, then calls
 * `create_weight_room_monthly_focus`, which in one transaction inserts a
 * `kind: 'focus'` goal anchor if the movement has no goal yet (so the ring and
 * rollup reuse existing machinery; `on conflict do nothing` never clobbers a
 * permanent goal) and then the focus row. It shares a per-movement lock with
 * the goal DELETE's `delete_weight_room_goal`, so a goal can't be deleted
 * between the anchor and the insert and leave the focus without its ring.
 *
 * Pair with `[id]/route.ts` for DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { ensureWeightRoomExercise } from '@/lib/data/ensure-weight-room-exercise'
import { WeightRoomMonthlyFocusCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Create a monthly focus. Body must conform to
 * {@link WeightRoomMonthlyFocusCreateSchema} — `exercise` (lowercased),
 * `daily_target`, `color`, `category` (`'upper'` | `'lower'`),
 * `start_date`, `end_date` required; `target_kind` defaults to `'reps'`.
 *
 * Status codes:
 * - 201 — created (response echoes the focus row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 500 — unexpected Supabase error (catalog upsert or the create RPC)
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
        { status: 400 }
      )
    }
    throw err
  }

  const supabase = createAdminSupabaseClient()

  // 0. Ensure the movement is in the catalog. Both the goal anchor below and
  //    the focus row itself FK it as of #373, so a brand-new focus exercise
  //    would fail with a raw 23503 without this.
  const catalogError = await ensureWeightRoomExercise(supabase, focus.exercise)
  if (catalogError !== null) {
    return NextResponse.json({ error: catalogError }, { status: 500 })
  }

  // 1. Anchor + focus insert, atomically (see the module docblock).
  const { data, error } = await supabase.rpc('create_weight_room_monthly_focus', {
    p_exercise: focus.exercise,
    p_daily_target: focus.daily_target,
    p_target_kind: focus.target_kind,
    p_color: focus.color,
    p_category: focus.category,
    p_start_date: focus.start_date,
    p_end_date: focus.end_date,
  })

  if (error) {
    return NextResponse.json(
      { error: `Failed to create monthly focus: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/monthly-focus', handlePOST)
