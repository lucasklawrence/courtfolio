/**
 * Admin-only item endpoint for Weight Room set deletion (#79). Sibling
 * of the collection POST — same admin gate, same service-role client.
 * Used by the Today View's swipe-to-delete / undo affordance.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ id: string }>
}

/**
 * Loose UUID guard — Postgres rejects malformed UUIDs at query time, but
 * a pre-check here keeps the 400 vs 404 distinction clean (a malformed
 * id is a client bug, a valid-but-missing id is a 404).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Delete one strength set by `id`.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — `id` is not a valid UUID
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no set exists for `id`
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by Next.js
 *   handler signature.
 * @param ctx Next.js route context; `ctx.params.id` is the set's UUID
 *   primary key parsed from the URL segment.
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
    .from('weight_room_sets')
    .delete()
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: `Failed to delete set: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `No set for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/sets/[id]', handleDELETE)
