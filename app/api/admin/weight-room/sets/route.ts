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
 * - 409 — `exercise` doesn't exist in `weight_room_goals` (FK violation;
 *   add it via the settings UI first)
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomSetCreateSchema}.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
        { status: 400 },
      )
    }
    throw err
  }

  const supabase = createAdminSupabaseClient()
  const insertRow = {
    exercise: entry.exercise,
    reps: entry.reps,
    logged_at: entry.logged_at ?? new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('weight_room_sets')
    .insert(insertRow)
    .select()
    .single()

  if (error) {
    // Postgres FK violation — exercise isn't in weight_room_goals.
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error: `Exercise '${entry.exercise}' is not configured. Add it via the settings UI before logging sets.`,
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Failed to insert set: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}
