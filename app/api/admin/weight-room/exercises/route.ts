/**
 * Admin-only collection endpoint for the Weight Room movement roster (#373).
 *
 * The Settings catalog editor hits this both to add a movement and to correct
 * an existing one's metadata. `slug` is the primary key, so a single POST with
 * `onConflict: 'slug'` covers create and replace — same shape as the goals
 * route, and for the same reason (no separate PUT).
 *
 * Pair with `[slug]/route.ts` for the partial edit (PATCH) and delete.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomExerciseUpsertSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Upsert a catalog movement — create-or-replace by `slug`. Body must conform to
 * {@link WeightRoomExerciseUpsertSchema}, which lowercases `slug` so `Bench-Press`
 * and `bench-press` collapse onto one roster entry instead of splitting a
 * movement's history across two.
 *
 * This is a full replace: every field the schema defaults (`load_multiplier`,
 * `is_unilateral`, `archived`) is written even when the caller omitted it. Use
 * `PATCH [slug]` to change one field without restating the rest.
 *
 * Status codes:
 * - 200 — upserted (response echoes the row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomExerciseUpsertSchema}.
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

  let exercise
  try {
    exercise = WeightRoomExerciseUpsertSchema.parse(payload)
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
  // Stamp `updated_at` explicitly so an edit advances the audit timestamp —
  // without it the existing-row branch keeps the original insert time and the
  // data layer's `MAX(updated_at)` freshness never reflects catalog edits.
  // Same reasoning as the goals upsert.
  const { data, error } = await supabase
    .from('weight_room_exercises')
    .upsert({ ...exercise, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to upsert exercise: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 200 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/exercises', handlePOST)
