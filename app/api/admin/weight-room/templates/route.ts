/**
 * Admin-only collection endpoints for workout templates (#375).
 *
 * `GET` returns every template with its slots, steps, and alternates attached —
 * the shape the builder hydrates from. `POST` creates an empty template; slots
 * are added through `[id]/slots`.
 *
 * Pair with `[id]/route.ts` for PATCH / DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { assembleWorkoutTemplates } from '@/lib/data/weight-room-shared'
import { WeightRoomTemplateCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * List every template, nested, ordered by position at each level.
 *
 * Includes archived templates — the builder needs them to un-archive; pickers
 * filter for themselves.
 *
 * Status codes: 200 · 401 / 403 · 500.
 *
 * @param _request Unused; the route takes no query params.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleGET(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    const templates = await assembleWorkoutTemplates(createAdminSupabaseClient())
    return NextResponse.json(templates, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load templates.' },
      { status: 500 }
    )
  }
}

/**
 * Create a template. Body must conform to
 * {@link WeightRoomTemplateCreateSchema} — only `name` is required.
 *
 * Created empty: slots are added through `[id]/slots` so each one gets a
 * durable id from the moment it exists. #376 links logged sets to those ids,
 * so an editing flow that recreated slots would orphan adherence history.
 *
 * Status codes:
 * - 201 — created (response echoes the row, with an empty `slots`)
 * - 400 — invalid JSON or failed Zod validation
 * - 401 / 403 — not signed in / not on the allowlist
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request matching {@link WeightRoomTemplateCreateSchema}.
 * @throws when Supabase env vars are missing (misconfigured deploy).
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

  let entry
  try {
    entry = WeightRoomTemplateCreateSchema.parse(payload)
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
  const insertRow: Record<string, unknown> = {
    name: entry.name,
    position: entry.position,
    archived: entry.archived,
    updated_at: new Date().toISOString(),
  }
  if (entry.description != null) insertRow.description = entry.description
  if (entry.color != null) insertRow.color = entry.color
  if (entry.category != null) insertRow.category = entry.category

  const { data, error } = await supabase
    .from('weight_room_workout_templates')
    .insert(insertRow)
    .select('id, name, description, color, category, position, archived')
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to create template: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ...data, slots: [] }, { status: 201 })
}

/** `handleGET` wrapped with one-event-per-request telemetry (#220). */
export const GET = withTelemetry('GET /api/admin/weight-room/templates', handleGET)

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/templates', handlePOST)
