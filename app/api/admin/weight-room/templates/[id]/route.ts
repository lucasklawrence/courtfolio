/**
 * Admin-only item endpoints for a workout template (#375) — rename / recolour /
 * recategorize / reorder / archive, and delete.
 *
 * DELETE cascades to the template's slots, and through them to steps and
 * alternates. That cascade is safe in a way the roster's isn't: a slot carries
 * no training history of its own. Logged sets reference a slot via
 * `template_slot_id` with `on delete set null` (#376), so deleting a template
 * degrades past sessions to "untemplated" rather than destroying anything.
 *
 * Archiving is still the better move for a template you've actually run —
 * it keeps the prescription readable so a past session's adherence resolves.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomTemplateUpdateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ id: string }>
}

/** Columns echoed by both handlers, matching `WeightRoomWorkoutTemplateRowSchema`. */
const TEMPLATE_COLUMNS = 'id, name, description, color, category, position, archived'

/** Postgres `invalid_text_representation` — a route segment that isn't a UUID. */
const INVALID_UUID = '22P02'

/**
 * Update a template's metadata. Body must conform to
 * {@link WeightRoomTemplateUpdateSchema} — every field optional, at least one
 * required. Slots are edited through `slots/`, never here.
 *
 * Status codes: 200 · 400 · 401 / 403 · 404 · 500.
 *
 * @param request Incoming JSON request matching {@link WeightRoomTemplateUpdateSchema}.
 * @param ctx Next.js route context; `ctx.params.id` is the template UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handlePATCH(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const templateId = id.trim()
  if (templateId.length === 0) {
    return NextResponse.json({ error: 'id must be non-empty.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let patch
  try {
    patch = WeightRoomTemplateUpdateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  // Zod's field transforms materialize every key, so an omitted field arrives
  // as `undefined` rather than absent. Strip those or "leave alone" becomes
  // indistinguishable from "clear" — same reasoning as the workouts PATCH.
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) changes[key] = value
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_workout_templates')
    .update(changes)
    .eq('id', templateId)
    .select(TEMPLATE_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
    }
    return NextResponse.json(
      { error: `Failed to update template: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete a template and, by cascade, its slots / steps / alternates.
 *
 * Status codes: 200 · 400 · 401 / 403 · 404 · 500.
 *
 * @param _request Unused — DELETE has no body.
 * @param ctx Next.js route context; `ctx.params.id` is the template UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const templateId = id.trim()
  if (templateId.length === 0) {
    return NextResponse.json({ error: 'id must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_workout_templates')
    .delete()
    .eq('id', templateId)
    .select(TEMPLATE_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
    }
    return NextResponse.json(
      { error: `Failed to delete template: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry('PATCH /api/admin/weight-room/templates/[id]', handlePATCH)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/templates/[id]', handleDELETE)
