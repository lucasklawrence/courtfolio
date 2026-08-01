/**
 * Admin-only collection endpoints for a template's slots (#375) — add one, and
 * reorder the lot.
 *
 * Reordering is its own endpoint rather than a series of item PATCHes because
 * it has to be **one statement**: swapping two slots transiently duplicates a
 * position, and `(template_id, position)` is unique. The constraint is
 * `DEFERRABLE INITIALLY DEFERRED` precisely so a single multi-row upsert can
 * pass through that invalid intermediate state and be checked at commit.
 * Sequential per-slot updates would fail on the first write.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { replaceSlotChildren } from '@/lib/data/template-slot-children'
import {
  WeightRoomTemplateSlotCreateSchema,
  WeightRoomTemplateSlotReorderSchema,
} from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ id: string }>
}

/** Postgres FK violation — an exercise slug that isn't in the catalog. */
const FK_VIOLATION = '23503'
/** Postgres `invalid_text_representation` — a segment that isn't a UUID. */
const INVALID_UUID = '22P02'

/**
 * Append a slot to a template. Body must conform to
 * {@link WeightRoomTemplateSlotCreateSchema}.
 *
 * Position is assigned server-side as `max(position) + 1` rather than taken
 * from the client — the builder shouldn't have to know the current length, and
 * a stale client value would collide with the unique constraint.
 *
 * Status codes:
 * - 201 — created (response echoes the slot with its steps and alternates)
 * - 400 — invalid JSON, failed validation, or an inverted range
 * - 401 / 403 — not signed in / not on the allowlist
 * - 404 — no such template
 * - 409 — an exercise slug isn't in the catalog
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request matching {@link WeightRoomTemplateSlotCreateSchema}.
 * @param ctx Next.js route context; `ctx.params.id` is the template UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handlePOST(request: NextRequest, ctx: Context): Promise<NextResponse> {
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

  let entry
  try {
    entry = WeightRoomTemplateSlotCreateSchema.parse(payload)
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

  const { data: template, error: templateError } = await supabase
    .from('weight_room_workout_templates')
    .select('id')
    .eq('id', templateId)
    .maybeSingle()

  if (templateError) {
    if (templateError.code === INVALID_UUID) {
      return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
    }
    return NextResponse.json(
      { error: `Failed to read template: ${templateError.message}` },
      { status: 500 }
    )
  }
  if (!template) {
    return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
  }

  const { data: last, error: lastError } = await supabase
    .from('weight_room_template_slots')
    .select('position')
    .eq('template_id', templateId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    return NextResponse.json(
      { error: `Failed to read slot order: ${lastError.message}` },
      { status: 500 }
    )
  }

  const nowIso = new Date().toISOString()
  const slotRow: Record<string, unknown> = {
    template_id: templateId,
    position: last ? last.position + 1 : 0,
    exercise: entry.exercise,
    target_sets: entry.target_sets,
    updated_at: nowIso,
  }
  if (entry.target_sets_max != null) slotRow.target_sets_max = entry.target_sets_max
  if (entry.target_reps != null) slotRow.target_reps = entry.target_reps
  if (entry.target_reps_max != null) slotRow.target_reps_max = entry.target_reps_max
  if (entry.target_weight_lbs != null) slotRow.target_weight_lbs = entry.target_weight_lbs
  if (entry.rest_seconds != null) slotRow.rest_seconds = entry.rest_seconds
  if (entry.notes != null) slotRow.notes = entry.notes

  const { data: slot, error } = await supabase
    .from('weight_room_template_slots')
    .insert(slotRow)
    .select('id')
    .single()

  if (error) {
    if (error.code === FK_VIOLATION) {
      return NextResponse.json(
        { error: `Exercise '${entry.exercise}' is not in the movement catalog.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: `Failed to add slot: ${error.message}` }, { status: 500 })
  }

  const childFailure = await replaceSlotChildren(
    supabase,
    slot.id,
    entry.steps,
    entry.alternates
  )
  if (childFailure !== null) {
    // The slot insert already committed in its own transaction. Reporting the
    // add as failed while leaving it behind means a retry adds a second slot
    // and the incomplete first one stays in the template — so undo it. The
    // slot has no children worth keeping at this point by definition.
    await supabase.from('weight_room_template_slots').delete().eq('id', slot.id)
    return NextResponse.json({ error: childFailure.message }, { status: childFailure.status })
  }

  return NextResponse.json({ id: slot.id }, { status: 201 })
}

/**
 * Reorder a template's slots in one upsert. Body must conform to
 * {@link WeightRoomTemplateSlotReorderSchema}.
 *
 * One statement, deliberately — see the module docs for why sequential updates
 * can't work against the unique position constraint.
 *
 * Status codes: 200 · 400 · 401 / 403 · 500.
 *
 * @param request Incoming JSON request matching {@link WeightRoomTemplateSlotReorderSchema}.
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

  let entry
  try {
    entry = WeightRoomTemplateSlotReorderSchema.parse(payload)
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

  // Read the required columns, not just the ids. `upsert` is
  // `INSERT ... ON CONFLICT`, and Postgres validates NOT NULL on the candidate
  // row *before* resolving the conflict — so a row carrying only
  // `{id, position}` raises a not-null violation on `exercise` / `target_sets`
  // and the update never happens. Carrying the stored values through makes the
  // insert candidate valid; the DO UPDATE still only moves `position`.
  const { data: owned, error: ownedError } = await supabase
    .from('weight_room_template_slots')
    .select('id, exercise, target_sets')
    .eq('template_id', templateId)

  if (ownedError) {
    if (ownedError.code === INVALID_UUID) {
      return NextResponse.json({ error: `No template for '${templateId}'.` }, { status: 404 })
    }
    return NextResponse.json(
      { error: `Failed to read slot order: ${ownedError.message}` },
      { status: 500 }
    )
  }

  const ownedById = new Map((owned ?? []).map((row) => [row.id, row]))
  const strays = entry.order.filter((row) => !ownedById.has(row.id)).map((row) => row.id)
  if (strays.length > 0) {
    return NextResponse.json(
      { error: `These slots do not belong to this template: ${strays.join(', ')}` },
      { status: 400 }
    )
  }

  const nowIso = new Date().toISOString()
  // One statement, so the DEFERRABLE unique constraint is checked at commit —
  // a swap that transiently duplicates a position passes through legally.
  const { error } = await supabase.from('weight_room_template_slots').upsert(
    entry.order.map((row) => {
      const existing = ownedById.get(row.id)
      return {
        id: row.id,
        template_id: templateId,
        position: row.position,
        exercise: existing?.exercise,
        target_sets: existing?.target_sets,
        updated_at: nowIso,
      }
    }),
    { onConflict: 'id' }
  )

  if (error) {
    return NextResponse.json(
      { error: `Failed to reorder slots: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry(
  'POST /api/admin/weight-room/templates/[id]/slots',
  handlePOST
)

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry(
  'PATCH /api/admin/weight-room/templates/[id]/slots',
  handlePATCH
)
