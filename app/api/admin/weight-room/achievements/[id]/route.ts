/**
 * Admin-only item endpoint for Weight Room achievement tiers (#336) — edit
 * (PATCH) and remove (DELETE). Sibling of the collection POST: same admin gate,
 * same service-role client, same `weight_room_achievements` table whose RLS
 * permits SELECT only.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomAchievementUpdateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/** Next.js route context; `params.id` is the achievement row's UUID from the URL. */
interface Context {
  params: Promise<{ id: string }>
}

/**
 * Loose UUID guard — keeps the 400 (malformed id, a client bug) vs 404
 * (valid-but-missing id) distinction clean before hitting Postgres.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres unique-violation SQLSTATE — raised when a retuned tier collides with another. */
const UNIQUE_VIOLATION = '23505'

/** Columns echoed back on write, matching the data layer's read whitelist. */
const RETURNING = 'id, label, exercise, scope, threshold, color, icon'

/**
 * Edit one achievement tier by `id`. Body must conform to
 * {@link WeightRoomAchievementUpdateSchema} — every field optional, but at
 * least one required. Only the supplied fields change.
 *
 * Note that `exercise` accepts an explicit `null` to convert a per-exercise
 * tier into a pooled "all movements" one; *omitting* the key leaves the column
 * untouched. That distinction is the whole reason the patch is built key-by-key
 * rather than spread.
 *
 * Status codes:
 * - 200 — updated (response echoes the row)
 * - 400 — `id` not a UUID, empty patch, or payload failed validation / bad JSON
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no tier exists for `id`
 * - 409 — the retuned tier collides with an existing exercise + scope + threshold
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomAchievementUpdateSchema}.
 * @param ctx Next.js route context; `ctx.params.id` is the tier's UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy). Domain
 *   failures are returned as JSON responses, not thrown.
 */
async function handlePATCH(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'id must be a UUID.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let patch
  try {
    patch = WeightRoomAchievementUpdateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) update.label = patch.label
  if (patch.exercise !== undefined) update.exercise = patch.exercise
  if (patch.scope !== undefined) update.scope = patch.scope
  if (patch.threshold !== undefined) update.threshold = patch.threshold
  if (patch.color !== undefined) update.color = patch.color
  if (patch.icon !== undefined) update.icon = patch.icon

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_achievements')
    .update(update)
    .eq('id', id)
    .select(RETURNING)
    .maybeSingle()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: 'Another tier already covers that exercise, scope, and threshold.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to update achievement: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No achievement for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete one achievement tier by `id`. Nothing cascades — earned state was
 * never stored, so removing a tier simply takes the banner off the wall.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — `id` is not a valid UUID
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no tier exists for `id`
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by the handler signature.
 * @param ctx Next.js route context; `ctx.params.id` is the tier's UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy). Domain
 *   failures are returned as JSON responses, not thrown.
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'id must be a UUID.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_achievements')
    .delete()
    .eq('id', id)
    .select(RETURNING)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete achievement: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No achievement for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry('PATCH /api/admin/weight-room/achievements/[id]', handlePATCH)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/achievements/[id]', handleDELETE)
