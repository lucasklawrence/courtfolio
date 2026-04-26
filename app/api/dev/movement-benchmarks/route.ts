/**
 * Dev-only collection endpoint for movement benchmark writes.
 *
 * Per PRD §7.3 the production site is purely static; the only write
 * surface is this route, which exists exclusively under `next dev`.
 * In any other build the handler returns 404 so a leak doesn't expose
 * a write endpoint on the public site.
 *
 * Pair with `[date]/route.ts` for PUT/DELETE.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import {
  BenchmarkSchema,
  isDevRuntime,
  readBenchmarks,
  writeBenchmarks,
} from '@/lib/dev/movement-benchmarks-store'

/**
 * Append a new benchmark entry. Body must conform to {@link BenchmarkSchema}.
 *
 * Status codes:
 * - 201 — created
 * - 400 — payload failed Zod validation (response body has Zod's flattened error)
 * - 404 — not running under `next dev`
 * - 409 — an entry already exists for `date` (use PUT to overwrite)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDevRuntime()) return notFound()

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
      return NextResponse.json({ error: 'Validation failed.', issues: err.flatten() }, { status: 400 })
    }
    throw err
  }

  const list = await readBenchmarks()
  if (list.some((b) => b.date === entry.date)) {
    return NextResponse.json(
      { error: `Benchmark for ${entry.date} already exists. Use PUT to overwrite.` },
      { status: 409 },
    )
  }

  list.push(entry)
  await writeBenchmarks(list)
  return NextResponse.json(entry, { status: 201 })
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 })
}
