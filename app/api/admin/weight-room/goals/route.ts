/**
 * Admin-only collection endpoint for Weight Room goal upserts (#79).
 *
 * Settings UI hits this both for adding a new exercise and for updating
 * an existing goal's `daily_target` / `color`. The exercise name is the
 * primary key, so a single POST with `onConflict: 'exercise'` covers
 * both create and update — no separate PUT.
 *
 * Pair with `[exercise]/route.ts` for DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomGoalRowSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Upsert a goal — create-or-replace by `exercise`. Body must conform
 * to {@link WeightRoomGoalRowSchema}.
 *
 * Status codes:
 * - 200 — upserted (response echoes the merged row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomGoalRowSchema}.
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

  let goal
  try {
    goal = WeightRoomGoalRowSchema.parse(payload)
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
  const { data, error } = await supabase
    .from('weight_room_goals')
    .upsert(goal, { onConflict: 'exercise' })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to upsert goal: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 200 })
}
