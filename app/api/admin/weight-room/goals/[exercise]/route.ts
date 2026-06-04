/**
 * Admin-only item endpoint for Weight Room goal deletion (#79). Sibling
 * of the collection POST — same admin gate, same service-role client.
 * Used by the Settings UI's "remove exercise" affordance.
 *
 * Deletes are FK-cascaded: removing a goal also drops every set logged
 * for that exercise (per the migration's `on delete cascade`). The
 * Settings UI surfaces a confirmation prompt before calling DELETE so
 * the cascade isn't silent.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ exercise: string }>
}

/**
 * Delete a goal (and, via FK cascade, every set for that exercise).
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — empty `exercise` segment (shouldn't happen — Next.js routing
 *   wouldn't match — but kept defensive in case of a manual fetch)
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no goal exists for `exercise`
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by Next.js
 *   handler signature.
 * @param ctx Next.js route context; `ctx.params.exercise` is the goal's
 *   primary key parsed from the URL segment.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  // Next.js App Router decodes dynamic route segments before handing them
  // to the handler, so `params.exercise` is the already-decoded user input
  // — no `decodeURIComponent` call here (matches the
  // `movement-benchmarks/[date]/route.ts` precedent and avoids the
  // URIError crash a malformed `%` sequence would otherwise produce).
  const { exercise } = await ctx.params
  const trimmed = exercise.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'exercise must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_goals')
    .delete()
    .eq('exercise', trimmed)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: `Failed to delete goal: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `No goal for '${trimmed}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/goals/[exercise]', handleDELETE)
