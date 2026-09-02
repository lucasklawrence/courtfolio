/**
 * Admin-only item endpoints for Weight Room workout sessions (#374) — end /
 * rename / annotate, and delete.
 *
 * DELETE removes the *session*, never its sets. `weight_room_sets.workout_id`
 * is `on delete set null`, so the sets fall back to loose sets — exactly what
 * they were before the session existed. Deleting a container must not delete
 * training history; that lesson is the whole reason #373 moved the roster off a
 * cascading FK.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomWorkoutUpdateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { endsBeforeStart } from '@/lib/training-facility/workout-sessions'

interface Context {
  params: Promise<{ id: string }>
}

/** Columns echoed back by both handlers, matching `WeightRoomWorkoutRowSchema`. */
const WORKOUT_COLUMNS = 'id, started_at, ended_at, template_id, title, location, notes'

/** Postgres `invalid_text_representation` — a route segment that isn't a UUID. */
const INVALID_UUID = '22P02'

/**
 * End, rename, or annotate a session. Body must conform to
 * {@link WeightRoomWorkoutUpdateSchema} — every field optional, at least one
 * required.
 *
 * Ending is `{ ended_at }`. Passing `ended_at: null` **reopens** a session,
 * which is the escape hatch for a mis-tapped "end" — it can fail with 409 when
 * another session is already open, since only one may be in progress.
 *
 * Status codes:
 * - 200 — updated (response echoes the row)
 * - 400 — invalid JSON, failed Zod validation, or `ended_at` before `started_at`
 * - 401 / 403 — not signed in / not on the allowlist
 * - 404 — no workout with that id
 * - 409 — reopening would leave two sessions in progress
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomWorkoutUpdateSchema}.
 * @param ctx Next.js route context; `ctx.params.id` is the workout UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handlePATCH(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const workoutId = id.trim()
  if (workoutId.length === 0) {
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
    patch = WeightRoomWorkoutUpdateSchema.parse(payload)
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

  // Validate the window against the stored start rather than trusting the
  // caller, so a 400 explains the problem instead of a 500 wrapping the CHECK.
  if (typeof patch.ended_at === 'string') {
    const { data: existing, error: readError } = await supabase
      .from('weight_room_workouts')
      .select('started_at')
      .eq('id', workoutId)
      .maybeSingle()

    if (readError) {
      if (readError.code === INVALID_UUID) {
        return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
      }
      return NextResponse.json(
        { error: `Failed to read workout: ${readError.message}` },
        { status: 500 }
      )
    }
    if (!existing) {
      return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
    }
    // Instants, not strings: ISO 8601 only sorts lexicographically when every
    // value shares one UTC offset, and this codebase mixes `Z` with Pacific
    // offsets. See {@link endsBeforeStart}.
    const inverted = endsBeforeStart(existing.started_at, patch.ended_at)
    if (inverted === null) {
      return NextResponse.json(
        { error: 'ended_at must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      )
    }
    if (inverted) {
      return NextResponse.json({ error: 'ended_at cannot be before started_at.' }, { status: 400 })
    }
  }

  // Zod's field transforms always materialize the key, so an omitted field
  // arrives as `title: undefined` rather than as an absent key. Strip those or
  // "leave this alone" becomes indistinguishable from "clear this" — the exact
  // distinction {@link clearableTextField} exists to preserve.
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) changes[key] = value
  }

  const { data, error } = await supabase
    .from('weight_room_workouts')
    .update(changes)
    .eq('id', workoutId)
    .select(WORKOUT_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
    }
    // Reopening while another session is open trips the partial unique index.
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error:
            'Another workout is already in progress, so this one cannot be reopened. End that one first.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to update workout: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete a session. Its sets survive as loose sets — `workout_id` is
 * `on delete set null`, so no training history is lost.
 *
 * Status codes:
 * - 200 — deleted (response echoes the removed row)
 * - 400 — empty `id` segment
 * - 401 / 403 — not signed in / not on the allowlist
 * - 404 — no workout with that id
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by the Next.js handler
 *   signature.
 * @param ctx Next.js route context; `ctx.params.id` is the workout UUID.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const workoutId = id.trim()
  if (workoutId.length === 0) {
    return NextResponse.json({ error: 'id must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_workouts')
    .delete()
    .eq('id', workoutId)
    .select(WORKOUT_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === INVALID_UUID) {
      return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
    }
    return NextResponse.json(
      { error: `Failed to delete workout: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No workout for '${workoutId}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry('PATCH /api/admin/weight-room/workouts/[id]', handlePATCH)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry('DELETE /api/admin/weight-room/workouts/[id]', handleDELETE)
