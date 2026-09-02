/**
 * Admin-only item endpoints for a single template slot (#375) — edit it, and
 * remove it.
 *
 * PATCH edits the slot **in place**, preserving its id. That is deliberate and
 * load-bearing: #376 links each logged set to the slot it was performed for via
 * `weight_room_sets.template_slot_id`, so a save that deleted and recreated
 * slots would null out that link on every past session and silently destroy
 * adherence history. Steps and alternates *are* replaced wholesale, because
 * nothing outside a slot references them.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { replaceSlotChildren } from '@/lib/data/template-slot-children'
import { WeightRoomTemplateSlotUpdateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ id: string; slotId: string }>
}

/** Postgres FK violation — an exercise slug that isn't in the catalog. */
const FK_VIOLATION = '23503'
/** Postgres `invalid_text_representation` — a segment that isn't a UUID. */
const INVALID_UUID = '22P02'

/** Slot columns echoed back, matching `WeightRoomTemplateSlotRowSchema`. */
const SLOT_COLUMNS =
  'id, template_id, position, exercise, target_sets, target_sets_max, target_reps, target_reps_max, target_weight_lbs, rest_seconds, notes'

/**
 * Edit a slot. Body must conform to {@link WeightRoomTemplateSlotUpdateSchema} —
 * every field optional, at least one required.
 *
 * `steps` / `alternates` replace those lists wholesale when supplied and leave
 * them untouched when omitted, so renaming a slot never wipes its swaps.
 *
 * Status codes:
 * - 200 — updated (response echoes the slot row)
 * - 400 — invalid JSON, failed validation, or an inverted range
 * - 401 / 403 — not signed in / not on the allowlist
 * - 404 — no such slot on this template
 * - 409 — an exercise slug isn't in the catalog
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request matching {@link WeightRoomTemplateSlotUpdateSchema}.
 * @param ctx Next.js route context; `id` is the template, `slotId` the slot.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handlePATCH(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id, slotId } = await ctx.params
  const templateId = id.trim()
  const slot = slotId.trim()
  if (templateId.length === 0 || slot.length === 0) {
    return NextResponse.json({ error: 'id and slotId must be non-empty.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let patch
  try {
    patch = WeightRoomTemplateSlotUpdateSchema.parse(payload)
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

  // Scope the write by template as well as slot id, so a slot can't be edited
  // through the wrong template's URL.
  const { steps, alternates, ...scalars } = patch
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined) changes[key] = value
  }

  const { data, error } = await supabase
    .from('weight_room_template_slots')
    .update(changes)
    .eq('id', slot)
    .eq('template_id', templateId)
    .select(SLOT_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No slot '${slot}' on this template.` }, { status: 404 })
    }
    if (error.code === FK_VIOLATION) {
      return NextResponse.json(
        { error: 'That exercise is not in the movement catalog.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: `Failed to update slot: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `No slot '${slot}' on this template.` }, { status: 404 })
  }

  const childFailure = await replaceSlotChildren(supabase, slot, steps, alternates)
  if (childFailure !== null) {
    return NextResponse.json({ error: childFailure.message }, { status: childFailure.status })
  }

  return NextResponse.json(data, { status: 200 })
}

/**
 * Remove a slot. Its steps and alternates cascade; logged sets that referenced
 * it fall back to `template_slot_id = null` rather than being deleted.
 *
 * Leaves a gap in the remaining positions, which is fine — ordering is by
 * `position`, and nothing requires it to be contiguous.
 *
 * Status codes: 200 · 400 · 401 / 403 · 404 · 500.
 *
 * @param _request Unused — DELETE has no body.
 * @param ctx Next.js route context; `id` is the template, `slotId` the slot.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id, slotId } = await ctx.params
  const templateId = id.trim()
  const slot = slotId.trim()
  if (templateId.length === 0 || slot.length === 0) {
    return NextResponse.json({ error: 'id and slotId must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_template_slots')
    .delete()
    .eq('id', slot)
    .eq('template_id', templateId)
    .select(SLOT_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No slot '${slot}' on this template.` }, { status: 404 })
    }
    return NextResponse.json({ error: `Failed to delete slot: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `No slot '${slot}' on this template.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry(
  'PATCH /api/admin/weight-room/templates/[id]/slots/[slotId]',
  handlePATCH
)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry(
  'DELETE /api/admin/weight-room/templates/[id]/slots/[slotId]',
  handleDELETE
)
