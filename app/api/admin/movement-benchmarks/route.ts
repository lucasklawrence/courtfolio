/**
 * Admin-only collection endpoint for movement benchmark inserts (#131).
 *
 * Replaces the dev-only file-write API removed alongside this issue
 * with a Supabase-backed write gated by the `NEXT_PUBLIC_ADMIN_EMAILS`
 * allowlist (PRD §7.10, §7.13). Uses the service-role client so the
 * INSERT bypasses RLS — the row-level policies on `movement_benchmarks`
 * only allow SELECT for anon/authenticated, so all writes funnel
 * through this gate.
 *
 * Pair with `[date]/route.ts` for PUT/DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { BenchmarkSchema } from '@/lib/schemas/movement'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Insert a new benchmark entry. Body must conform to `BenchmarkSchema`.
 *
 * Status codes:
 * - 201 — created
 * - 400 — payload failed Zod validation or wasn't valid JSON
 * - 401 — not signed in
 * - 403 — signed in but email not on the allowlist
 * - 409 — an entry already exists for `date` (use PUT to overwrite)
 * - 500 — unexpected Supabase error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    entry = BenchmarkSchema.parse(payload)
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
    .insert(entry)
    .select()
    .single()

  if (error) {
    // Postgres unique-violation on the `date` primary key.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Benchmark for ${entry.date} already exists. Use PUT to overwrite.` },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Failed to insert benchmark: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}
