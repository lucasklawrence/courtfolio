/**
 * Admin-only collection endpoints for Weight Room workout sessions (#374).
 *
 * `GET` lists sessions (newest first) and, with `?open=true`, returns just the
 * in-progress one — which is what a recording surface asks for on load to
 * decide whether to resume. `POST` starts a session.
 *
 * At most one workout may be in progress at a time, enforced by a partial
 * unique index rather than by this route, so a concurrent double-start fails at
 * the database instead of racing past an application check.
 *
 * Pair with `[id]/route.ts` for PATCH (end / rename / annotate) and DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomWorkoutCreateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { autoEndTimestamp, isStaleOpenWorkout } from '@/lib/training-facility/workout-sessions'

/** Columns returned by both handlers, matching `WeightRoomWorkoutRowSchema`. */
const WORKOUT_COLUMNS = 'id, started_at, ended_at, title, location, notes'

/** How many sessions `GET` returns without `?open=true`. */
const DEFAULT_LIMIT = 50

/**
 * List workout sessions, newest first.
 *
 * `?open=true` narrows to the single in-progress session and returns `null`
 * when there isn't one — the shape a recording surface wants on load, rather
 * than making it filter a list to answer "am I mid-workout?".
 *
 * Status codes:
 * - 200 — a list, or (with `?open=true`) the open workout or `null`
 * - 401 / 403 — not signed in / not on the allowlist
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming request; `open` is the only recognized query param.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleGET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createAdminSupabaseClient()
  // `new URL(request.url)` rather than `request.nextUrl` — identical under
  // Next, but it also works on a plain `Request`, which is what the route
  // tests construct.
  const wantsOpenOnly = new URL(request.url).searchParams.get('open') === 'true'

  if (wantsOpenOnly) {
    const { data, error } = await supabase
      .from('weight_room_workouts')
      .select(WORKOUT_COLUMNS)
      .is('ended_at', null)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: `Failed to read open workout: ${error.message}` },
        { status: 500 }
      )
    }
    return NextResponse.json(data ?? null, { status: 200 })
  }

  const { data, error } = await supabase
    .from('weight_room_workouts')
    .select(WORKOUT_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(DEFAULT_LIMIT)

  if (error) {
    return NextResponse.json(
      { error: `Failed to list workouts: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json(data ?? [], { status: 200 })
}

/**
 * Start a workout session. Body must conform to
 * {@link WeightRoomWorkoutCreateSchema} — every field optional, so the common
 * case is an empty body and a session stamped `now()`.
 *
 * **Stale sessions are auto-ended rather than blocking the new one.** Forgetting
 * to hit "end" is the normal failure mode, and discovering it as an error at
 * the gym two days later is the wrong place to find out. So:
 *
 * - An open session younger than the staleness horizon → **409**. You are
 *   plausibly still in it; ending it is an explicit decision.
 * - An open session older than the horizon → auto-ended at its **last set's
 *   `logged_at`** (or `started_at` when it recorded nothing), then the new
 *   session starts. That timestamp is the last real evidence of training, not
 *   a guess, and it never invents duration that didn't happen.
 *
 * A body carrying `ended_at` records an already-finished session in one call
 * (how #378 will narrate a workout after the fact); it doesn't occupy the
 * single open-session slot, so it never collides.
 *
 * Status codes:
 * - 201 — created (response echoes the row)
 * - 400 — invalid JSON, failed Zod validation, or `ended_at` before `started_at`
 * - 401 / 403 — not signed in / not on the allowlist
 * - 409 — a recent session is still open
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomWorkoutCreateSchema}.
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
    entry = WeightRoomWorkoutCreateSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  const now = new Date()
  const startedAt = entry.started_at ?? now.toISOString()

  // Checked here as well as by the table's CHECK so the caller gets a 400 with
  // an explanation rather than a 500 wrapping a constraint name.
  if (entry.ended_at !== undefined && entry.ended_at < startedAt) {
    return NextResponse.json(
      { error: 'ended_at cannot be before started_at.' },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // A session being recorded after the fact already carries its end, so it
  // never contends for the single open slot — skip the whole dance.
  if (entry.ended_at === undefined) {
    const conflict = await resolveOpenWorkout(supabase, now)
    if (conflict !== null) return conflict
  }

  const insertRow = {
    started_at: startedAt,
    ...(entry.ended_at != null ? { ended_at: entry.ended_at } : {}),
    ...(entry.title != null ? { title: entry.title } : {}),
    ...(entry.location != null ? { location: entry.location } : {}),
    ...(entry.notes != null ? { notes: entry.notes } : {}),
  }

  const { data, error } = await supabase
    .from('weight_room_workouts')
    .insert(insertRow)
    .select(WORKOUT_COLUMNS)
    .single()

  if (error) {
    // The partial unique index is the real guard — a concurrent start that
    // slipped past the check above lands here.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A workout is already in progress. End it before starting another.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to start workout: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}

/**
 * Clear the way for a new session: auto-end a stale open workout, or refuse.
 *
 * @param supabase Service-role client.
 * @param now Evaluation instant for the staleness comparison.
 * @returns `null` when the slot is free (nothing open, or the stale one was
 *   closed); otherwise the response to return — a 409 for a session still
 *   plausibly in progress, or a 500 if a read/write failed.
 */
async function resolveOpenWorkout(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  now: Date
): Promise<NextResponse | null> {
  const { data: open, error: openError } = await supabase
    .from('weight_room_workouts')
    .select('id, started_at')
    .is('ended_at', null)
    .maybeSingle()

  if (openError) {
    return NextResponse.json(
      { error: `Failed to check for an open workout: ${openError.message}` },
      { status: 500 }
    )
  }
  if (!open) return null

  if (!isStaleOpenWorkout(open.started_at, now)) {
    return NextResponse.json(
      {
        error: `A workout started ${open.started_at} is still in progress. End it before starting another.`,
        open_workout_id: open.id,
      },
      { status: 409 }
    )
  }

  // Stale. Close it at its last set — the last evidence the user was training.
  const { data: lastSet, error: lastSetError } = await supabase
    .from('weight_room_sets')
    .select('logged_at')
    .eq('workout_id', open.id)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastSetError) {
    return NextResponse.json(
      { error: `Failed to read the stale workout's sets: ${lastSetError.message}` },
      { status: 500 }
    )
  }

  const { error: closeError } = await supabase
    .from('weight_room_workouts')
    .update({
      ended_at: autoEndTimestamp(open.started_at, lastSet?.logged_at ?? null),
      updated_at: now.toISOString(),
    })
    .eq('id', open.id)

  if (closeError) {
    return NextResponse.json(
      { error: `Failed to close the stale workout: ${closeError.message}` },
      { status: 500 }
    )
  }
  return null
}

/** `handleGET` wrapped with one-event-per-request telemetry (#220). */
export const GET = withTelemetry('GET /api/admin/weight-room/workouts', handleGET)

/** `handlePOST` wrapped with one-event-per-request telemetry (#220). */
export const POST = withTelemetry('POST /api/admin/weight-room/workouts', handlePOST)
