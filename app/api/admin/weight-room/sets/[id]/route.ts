/**
 * Admin-only item endpoints for a Weight Room set (#79, #376) — correct one,
 * and delete one. Sibling of the collection POST: same admin gate, same
 * service-role client.
 *
 * PATCH exists because correcting a typo previously meant delete-and-re-enter,
 * which silently loses the set's `logged_at` and, inside a workout, its place
 * in the order. Mid-lift that is exactly the wrong trade.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomSetUpdateSchema } from '@/lib/schemas/weight-room'
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

/**
 * Correct one strength set. Body must conform to
 * {@link WeightRoomSetUpdateSchema} — every field optional, at least one
 * required.
 *
 * `weight_lbs` and `variant` accept an explicit `null` to clear them, so a set
 * logged as weighted by mistake can become a bodyweight set again. An omitted
 * key always means "leave alone".
 *
 * Deliberately cannot move a set between workouts or slots: those links are
 * the record of where the set was performed, and a typo in the reps is not a
 * reason to let a fat finger re-attribute it.
 *
 * Status codes:
 * - 200 — updated (response echoes the row)
 * - 400 — malformed id, invalid JSON, or failed Zod validation
 * - 401 / 403 — not signed in / not on the allowlist
 * - 404 — no set for `id`
 * - 409 — `exercise` isn't in the movement catalog
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request matching {@link WeightRoomSetUpdateSchema}.
 * @param ctx Next.js route context; `ctx.params.id` is the set's UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
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
    patch = WeightRoomSetUpdateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  // Zod's transforms materialize every key, so an omitted field arrives as
  // `undefined`. Strip those or "leave alone" becomes indistinguishable from
  // "clear" — the distinction the nullable fields above exist to preserve.
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) changes[key] = value
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_sets')
    .update(changes)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'That exercise is not in the movement catalog.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: `Failed to update set: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `No set for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry('PATCH /api/admin/weight-room/sets/[id]', handlePATCH)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/sets/[id]', handleDELETE)
