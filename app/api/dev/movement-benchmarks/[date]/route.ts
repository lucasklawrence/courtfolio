/**
 * Dev-only item endpoint for movement benchmark updates and deletes
 * (PRD §7.3, §7.11). The collection POST lives one directory up; this
 * file owns PUT (overwrite by date) and DELETE (remove by date).
 *
 * Both handlers return 404 when not running under `next dev` so a
 * production build never exposes a write surface.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import {
  BenchmarkUpdateSchema,
  isDevRuntime,
  isValidDate,
  readBenchmarks,
  writeBenchmarks,
} from '@/lib/dev/movement-benchmarks-store'

interface Context {
  params: Promise<{ date: string }>
}

/**
 * Overwrite the benchmark identified by `date` with the partial fields
 * in the body (`BenchmarkUpdate` shape — never the date itself).
 *
 * Status codes:
 * - 200 — updated
 * - 400 — bad date format or payload failed Zod validation
 * - 404 — not running under `next dev`, OR no benchmark exists for `date`
 */
export async function PUT(request: NextRequest, ctx: Context): Promise<NextResponse> {
  if (!isDevRuntime()) return notFound()

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
      return NextResponse.json({ error: 'Validation failed.', issues: err.flatten() }, { status: 400 })
    }
    throw err
  }

  const list = await readBenchmarks()
  const idx = list.findIndex((b) => b.date === date)
  if (idx === -1) {
    return NextResponse.json({ error: `No benchmark for ${date}.` }, { status: 404 })
  }

  const merged = { ...list[idx], ...updates }
  list[idx] = merged
  await writeBenchmarks(list)
  return NextResponse.json(merged, { status: 200 })
}

/**
 * Remove the benchmark identified by `date`.
 *
 * Status codes:
 * - 200 — deleted (response body echoes the removed entry)
 * - 400 — bad date format
 * - 404 — not running under `next dev`, OR no benchmark exists for `date`
 */
export async function DELETE(_request: NextRequest, ctx: Context): Promise<NextResponse> {
  if (!isDevRuntime()) return notFound()

  const { date } = await ctx.params
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  const list = await readBenchmarks()
  const idx = list.findIndex((b) => b.date === date)
  if (idx === -1) {
    return NextResponse.json({ error: `No benchmark for ${date}.` }, { status: 404 })
  }

  const [removed] = list.splice(idx, 1)
  await writeBenchmarks(list)
  return NextResponse.json(removed, { status: 200 })
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 })
}
