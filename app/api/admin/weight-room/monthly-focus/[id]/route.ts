/**
 * Admin-only item endpoint for Weight Room monthly-focus deletion (#255).
 * Sibling of the collection POST — same admin gate, same service-role
 * client. Removes a queued/active focus from the roadmap.
 *
 * Only the `weight_room_monthly_focus` row is deleted; the `kind: 'focus'`
 * goal anchor and any logged sets are intentionally left in place so the
 * exercise's history survives removing it from the rotation. (Pruning the
 * orphaned anchor is a possible follow-up.)
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ id: string }>
}

/**
 * Loose UUID guard — keeps the 400 (malformed id, a client bug) vs 404
 * (valid-but-missing id) distinction clean before hitting Postgres.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Delete one monthly focus by `id`.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — `id` is not a valid UUID
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no focus exists for `id`
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by the Next.js
 *   handler signature.
 * @param ctx Next.js route context; `ctx.params.id` is the focus row's
 *   UUID primary key parsed from the URL segment.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
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
    .from('weight_room_monthly_focus')
    .delete()
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete monthly focus: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No monthly focus for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry(
  'DELETE /api/admin/weight-room/monthly-focus/[id]',
  handleDELETE,
)
