/**
 * Admin-only collection endpoint for Weight Room achievement tiers (#336).
 *
 * The Trophy Room lights up a badge when a metric (day / week / month volume,
 * streak, lifetime total, single set) reaches its tier's threshold. The ladder
 * lives in `weight_room_achievements`, whose RLS permits SELECT only, so the
 * admin editor funnels creates through this gate on the service-role client —
 * mirroring the OTF mileage-award routes.
 *
 * Pair with `[id]/route.ts` for PATCH (edit) and DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomAchievementCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Postgres unique-violation SQLSTATE — raised when the
 * `(exercise, scope, threshold)` triple collides with an existing tier.
 */
const UNIQUE_VIOLATION = '23505'

/** Columns echoed back on write, matching the data layer's read whitelist. */
const RETURNING = 'id, label, exercise, scope, threshold, color, icon'

/**
 * Create an achievement tier. Body must conform to
 * {@link WeightRoomAchievementCreateSchema} — `label`, `scope`, and `threshold`
 * required; `exercise` optional (omitted or `null` creates a pooled
 * "all movements" tier); `color` / `icon` optional.
 *
 * Status codes:
 * - 201 — created (response echoes the inserted row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 409 — a tier already exists for that exercise + scope + threshold
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomAchievementCreateSchema}.
 * @throws when Supabase env vars are missing (misconfigured deploy). Domain
 *   failures are returned as JSON responses, not thrown.
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

  let achievement
  try {
    achievement = WeightRoomAchievementCreateSchema.parse(payload)
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
  const { data, error } = await supabase
    .from('weight_room_achievements')
    .insert({
      label: achievement.label,
      exercise: achievement.exercise,
      scope: achievement.scope,
      threshold: achievement.threshold,
      color: achievement.color ?? null,
      icon: achievement.icon ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(RETURNING)
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        {
          error: `A ${achievement.scope} tier at ${achievement.threshold} already exists for ${achievement.exercise ?? 'all movements'}.`,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to create achievement: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/achievements', handlePOST)
