/**
 * Admin-only item endpoints for the Weight Room movement roster (#373) —
 * partial edit and delete. Sibling of the collection POST: same admin gate,
 * same service-role client.
 *
 * DELETE is deliberately the *narrow* path. `weight_room_sets.exercise` is
 * `on delete restrict` into this table, so a movement with any logged history
 * cannot be removed — the editor archives it instead. That restriction is the
 * point of the catalog: before #373 the roster lived on `weight_room_goals`
 * with `on delete cascade`, and removing a movement silently destroyed every
 * set ever logged for it.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { WeightRoomExerciseUpdateSchema } from '@/lib/schemas/weight-room'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

interface Context {
  params: Promise<{ slug: string }>
}

/**
 * Read and normalize the `slug` route segment.
 *
 * Next.js decodes dynamic segments before the handler sees them, so there's no
 * `decodeURIComponent` here — matching the `goals/[exercise]` precedent and
 * avoiding the URIError a malformed `%` sequence would otherwise throw.
 * Lowercased to match {@link WeightRoomExerciseUpsertSchema}'s write-side
 * canonicalization, so `/exercises/Bench-Press` addresses the same row as
 * `/exercises/bench-press`.
 *
 * @param ctx Next.js route context.
 */
async function resolveSlug(ctx: Context): Promise<string> {
  const { slug } = await ctx.params
  return slug.trim().toLowerCase()
}

/**
 * Partially update a catalog movement. Body must conform to
 * {@link WeightRoomExerciseUpdateSchema} — every field optional, at least one
 * required. This is what the editor uses to flip `archived` or fix a label
 * without restating the whole row.
 *
 * `slug` is not patchable: it's the value stored on every logged set, and the
 * editor treats movements as immutable identities. (The FK is `on update
 * cascade`, so the database would propagate a rename — the restriction is
 * product, not schema.)
 *
 * Status codes:
 * - 200 — updated (response echoes the row)
 * - 400 — empty slug segment, invalid JSON, or failed Zod validation
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no catalog row for `slug`
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming JSON request whose body matches
 *   {@link WeightRoomExerciseUpdateSchema}.
 * @param ctx Next.js route context; `ctx.params.slug` is the primary key.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handlePATCH(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const slug = await resolveSlug(ctx)
  if (slug.length === 0) {
    return NextResponse.json({ error: 'slug must be non-empty.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let patch
  try {
    patch = WeightRoomExerciseUpdateSchema.parse(payload)
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
  const { data, error } = await supabase
    .from('weight_room_exercises')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to update exercise: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No exercise for '${slug}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete a catalog movement. Only succeeds for a movement with no logged sets,
 * no daily goal, and no monthly focus — all three FK into this table with
 * `on delete restrict`.
 *
 * A 409 here is the expected outcome for anything you've actually trained, not
 * an error state: archive it instead (`PATCH { archived: true }`), which keeps
 * the history intact and drops the movement out of pickers.
 *
 * Status codes:
 * - 200 — deleted (response echoes the removed row)
 * - 400 — empty `slug` segment
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no catalog row for `slug`
 * - 409 — the movement is referenced by sets, a goal, or a focus
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by the Next.js handler
 *   signature.
 * @param ctx Next.js route context; `ctx.params.slug` is the primary key.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
async function handleDELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const slug = await resolveSlug(ctx)
  if (slug.length === 0) {
    return NextResponse.json({ error: 'slug must be non-empty.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('weight_room_exercises')
    .delete()
    .eq('slug', slug)
    .select()
    .maybeSingle()

  if (error) {
    // Postgres FK violation — something still references this movement. Answer
    // with the remedy rather than the raw constraint name; a 409 here is the
    // normal outcome for any movement with history, not a failure.
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error: `'${slug}' has logged sets, a daily goal, or a monthly focus, so it can't be deleted. Archive it instead — that hides it from pickers and keeps its history.`,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to delete exercise: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No exercise for '${slug}'.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/** `handlePATCH` wrapped with one-event-per-request telemetry (#220). */
export const PATCH = withTelemetry(
  'PATCH /api/admin/weight-room/exercises/[slug]',
  handlePATCH
)

/** `handleDELETE` wrapped with one-event-per-request telemetry (#220). */
export const DELETE = withTelemetry(
  'DELETE /api/admin/weight-room/exercises/[slug]',
  handleDELETE
)
