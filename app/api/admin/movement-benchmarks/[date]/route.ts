/**
 * Admin-only item endpoint for movement benchmark updates and deletes
 * (#131, PRD §7.11). Sibling of the collection POST — same admin gate,
 * same service-role write path.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { BenchmarkUpdateSchema, isValidDate } from '@/lib/schemas/movement'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

interface Context {
  params: Promise<{ date: string }>
}

/**
 * Update the benchmark identified by `date` with the partial fields in
 * the body (`BenchmarkUpdate` shape — never the date itself, which is
 * the URL key).
 *
 * Status codes:
 * - 200 — updated (response body echoes the merged row)
 * - 400 — bad date format or payload failed Zod validation
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no benchmark exists for `date`
 * - 500 — unexpected Supabase error
 *
 * @param request Incoming PUT request whose body is a partial-update
 *   payload (matches `BenchmarkUpdateSchema`, i.e. no `date` field).
 * @param ctx Next.js route context; `ctx.params.date` is the entry's
 *   primary key parsed from the URL segment.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
export async function PUT(request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { date } = await ctx.params
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  let updates
  try {
    updates = BenchmarkUpdateSchema.parse(payload)
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
  const { data, error } = await supabase
    .from('movement_benchmarks')
    .update(updates)
    .eq('date', date)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to update benchmark: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No benchmark for ${date}.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}

/**
 * Delete the benchmark identified by `date`.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed row)
 * - 400 — bad date format
 * - 401 — not signed in
 * - 403 — not on the allowlist
 * - 404 — no benchmark exists for `date`
 * - 500 — unexpected Supabase error
 *
 * @param _request Unused — DELETE has no body. Required by Next.js
 *   handler signature.
 * @param ctx Next.js route context; `ctx.params.date` is the entry's
 *   primary key parsed from the URL segment.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Domain failures are returned as JSON responses, not thrown.
 */
export async function DELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { date } = await ctx.params
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('movement_benchmarks')
    .delete()
    .eq('date', date)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete benchmark: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: `No benchmark for ${date}.` }, { status: 404 })
  }
  return NextResponse.json(data, { status: 200 })
}
