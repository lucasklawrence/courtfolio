/**
 * Cardio lifestyle-trend upsert endpoint.
 *
 * Upserts daily measurements (HRV, walking HR, steps, sleep, active energy,
 * body mass) into their corresponding Supabase trend tables. Uses service-role
 * credentials to bypass RLS — unlike raw MCP SQL which gets blocked by
 * SELECT-only policies.
 *
 * Authenticated via API key header (CARDIO_TRENDS_API_KEY env var).
 * This is for manual logging via the weight/cardio skills.
 *
 * Request body: `{ date: "YYYY-MM-DD", metric: "hrv" | "walking_hr" | "steps" | "sleep" | "active_energy" | "body_mass", value: number }`
 * Response: 200 on success, 400 on validation error, 401 on auth, 500 on DB error.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { z } from 'zod'

import { validateApiKey } from '@/lib/api/validate-api-key'
import {
  CARDIO_METRIC_TABLES,
  type CardioMetric,
} from '@/lib/schemas/cardio-sync'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/** The accepted metric keys, derived from the canonical table map. */
const CARDIO_METRICS = Object.keys(CARDIO_METRIC_TABLES) as [
  CardioMetric,
  ...CardioMetric[],
]

/**
 * Metrics whose DB CHECK is `value > 0` (a 0 reading is implausible). The
 * volume metrics — steps, sleep, active_energy — allow 0 (a true rest day).
 * Mirrors the per-metric constraints in `lib/schemas/cardio-sync.ts` so a
 * 0 for a strictly-positive metric fails here with a clean 400 rather than
 * tripping the DB CHECK and surfacing as a 500.
 */
const POSITIVE_METRICS = new Set<CardioMetric>(['hrv', 'walking_hr', 'body_mass'])

const CardioTrendUpsertSchema = z
  .object({
    /** ISO date string (YYYY-MM-DD). */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Metric type — one of the {@link CARDIO_METRIC_TABLES} keys. */
    metric: z.enum(CARDIO_METRICS),
    /** Numeric value (units depend on metric); 0 only valid for volume metrics. */
    value: z.number().nonnegative(),
  })
  .refine((data) => !POSITIVE_METRICS.has(data.metric) || data.value > 0, {
    message: 'value must be greater than 0 for this metric',
    path: ['value'],
  })

type CardioTrendUpsert = z.infer<typeof CardioTrendUpsertSchema>

/**
 * POST /api/admin/cardio/trends — upsert a cardio lifestyle-trend measurement.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  if (!validateApiKey(request, 'X-Cardio-Trends-Key', 'CARDIO_TRENDS_API_KEY')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Parse request body
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  // Validate against schema
  let input: CardioTrendUpsert
  try {
    input = CardioTrendUpsertSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  // The enum guarantees `metric` is a key of CARDIO_METRIC_TABLES, so the
  // table lookup always resolves.
  const table = CARDIO_METRIC_TABLES[input.metric]

  // Upsert via service-role client (bypasses RLS). Stamp `updated_at`
  // explicitly: the trend tables default it on INSERT but have no update
  // trigger, so overwriting an existing day would otherwise leave the old
  // timestamp — and `imported_at` (MAX(updated_at)) would never advance on a
  // correction/re-log. Matches the import script.
  //
  // Body mass is multi-source: tag these writes `source='manual'` so the full
  // Apple Health import (which only upserts/prunes `source='apple_health'`)
  // never overwrites or deletes a manually-logged weigh-in. Only
  // `cardio_body_mass_trend` has the column, so scope it to that metric.
  const row: {
    date: string
    value: number
    updated_at: string
    source?: 'manual'
  } = { date: input.date, value: input.value, updated_at: new Date().toISOString() }
  if (input.metric === 'body_mass') row.source = 'manual'
  const supabase = createAdminSupabaseClient()
  const { error, data } = await supabase.from(table).upsert(row).select()

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { message: `${input.metric} for ${input.date} upserted successfully.`, data },
    { status: 200 }
  )
}
