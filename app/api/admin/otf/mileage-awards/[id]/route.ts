/**
 * Admin-only item endpoint for OTF mileage milestone tiers (#321) — edit
 * (PATCH) and remove (DELETE). Sibling of the collection POST: same admin
 * gate, same service-role client, same `otf_mileage_awards` table whose RLS
 * permits SELECT only.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { OtfMileageAwardUpdateSchema } from '@/lib/schemas/otf'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/** Next.js route context; `params.id` is the award row's UUID from the URL. */
interface Context {
  params: Promise<{ id: string }>
}

/**
 * Loose UUID guard — keeps the 400 (malformed id, a client bug) vs 404
 * (valid-but-missing id) distinction clean before hitting Postgres.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres unique-violation SQLSTATE — raised when a renamed `label` collides. */
const UNIQUE_VIOLATION = '23505'

/**
 * Edit one mileage tier by `id`. Body must conform to
 * {@link OtfMileageAwardUpdateSchema} — every field optional, but at least one
 * of `label` / `miles` / `color` required. Only the supplied fields change.
 *
 * Status codes:
 * - 200 — updated (response echoes the row)
 * - 400 — `id` not a UUID, empty patch, or payload failed validation / bad JSON
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no tier exists for `id`
 * - 409 — the new `label` collides with another tier
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link OtfMileageAwardUpdateSchema}.
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
    patch = OtfMileageAwardUpdateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 },
      )
    }
    throw err
  }

  // Patch semantics: only fields present in the validated body are written, so
  // omitting a field leaves the column untouched. The schema rejects an empty
  // string for `color`, so a tier's accent can be changed but not cleared here.
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) update.label = patch.label
  if (patch.miles !== undefined) update.miles = patch.miles
  if (patch.color !== undefined) update.color = patch.color

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('otf_mileage_awards')
    .update(update)
    .eq('id', id)
    .select('id, label, miles, color')
    .maybeSingle()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: `A milestone labeled '${patch.label}' already exists.` },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Failed to update mileage award: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No mileage award for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete one mileage tier by `id`.
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
    .from('otf_mileage_awards')
    .delete()
    .eq('id', id)
    .select('id, label, miles, color')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete mileage award: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No mileage award for id '${id}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry('PATCH /api/admin/otf/mileage-awards/[id]', handlePATCH)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/otf/mileage-awards/[id]', handleDELETE)
