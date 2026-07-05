/**
 * Cardio lifestyle-trend upsert endpoint (#279 follow-up).
 *
 * Upserts daily measurements (HRV, walking HR, steps, sleep, active energy,
 * body mass) into their corresponding Supabase trend tables. Uses service-role
 * credentials to bypass RLS — unlike raw MCP SQL which gets blocked by
 * SELECT-only policies.
 *
 * Authenticated via admin check (signed-in user only); no API key needed.
 * This is for manual logging via the weight/cardio skills, not for
 * automated device ingestion (which has its own /api/health/auto-sync).
 *
 * Request body: `{ date: "YYYY-MM-DD", metric: "hrv" | "walking_hr" | "steps" | "sleep" | "active_energy" | "body_mass", value: number }`
 * Response: 200 on success, 400 on validation error, 401 on auth, 500 on DB error.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Metric type to table name mapping.
 */
const METRIC_TABLES: Record<string, string> = {
  hrv: 'cardio_hrv_trend',
  walking_hr: 'cardio_walking_hr_trend',
  steps: 'cardio_step_count_trend',
  sleep: 'cardio_sleep_trend',
  active_energy: 'cardio_active_energy_trend',
  body_mass: 'cardio_body_mass_trend',
}

const CardioTrendUpsertSchema = z.object({
  /** ISO date string (YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Metric type — one of the keys in METRIC_TABLES. */
  metric: z.enum(['hrv', 'walking_hr', 'steps', 'sleep', 'active_energy', 'body_mass']),
  /** Numeric value (units depend on metric). */
  value: z.number().nonnegative(),
})

type CardioTrendUpsert = z.infer<typeof CardioTrendUpsertSchema>

/**
 * POST /api/admin/cardio/trends — upsert a cardio lifestyle-trend measurement.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

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

  // Get the table name
  const table = METRIC_TABLES[input.metric]
  if (!table) {
    return NextResponse.json(
      { error: `Unknown metric: ${input.metric}` },
      { status: 400 }
    )
  }

  // Upsert via service-role client (bypasses RLS)
  const supabase = createAdminSupabaseClient()
  const { error, data } = await supabase
    .from(table)
    .upsert({ date: input.date, value: input.value })
    .select()

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
