/**
 * Admin-only collection endpoint for OTF mileage milestone tiers (#321).
 *
 * The monthly-mileage section lights up a badge as the month's OTF miles cross
 * each tier's threshold (half marathon, marathon, ultra…). The ladder lives in
 * `otf_mileage_awards`, whose RLS permits SELECT only, so the admin editor
 * funnels creates through this gate on the service-role client — mirroring the
 * Weight Room monthly-focus routes.
 *
 * Pair with `[id]/route.ts` for PATCH (edit) and DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { OtfMileageAwardCreateSchema } from '@/lib/schemas/otf'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/** Postgres unique-violation SQLSTATE — raised when `label` collides. */
const UNIQUE_VIOLATION = '23505'

/**
 * Create a mileage milestone tier. Body must conform to
 * {@link OtfMileageAwardCreateSchema} — `label` (unique, trimmed) and `miles`
 * (positive) required; `color` optional.
 *
 * Status codes:
 * - 201 — created (response echoes the inserted row)
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 409 — a tier with the same `label` already exists
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link OtfMileageAwardCreateSchema}.
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

  let award
  try {
    award = OtfMileageAwardCreateSchema.parse(payload)
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
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('otf_mileage_awards')
    .insert({
      label: award.label,
      miles: award.miles,
      color: award.color ?? null,
      updated_at: now,
    })
    .select('id, label, miles, color')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: `A milestone labeled '${award.label}' already exists.` },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Failed to create mileage award: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/otf/mileage-awards', handlePOST)
