/**
 * Auto-sync endpoint for Apple Health data from the iPhone Shortcut (#272).
 *
 * Receives daily-aggregated cardio metrics (HRV, walking HR, steps, sleep,
 * active energy, body mass) and upserts them into the corresponding Supabase
 * trend tables. Authenticated via API key header (HEALTH_AUTO_SYNC_API_KEY env
 * var).
 *
 * This is not an admin route because it's triggered by device automation
 * (Apple Shortcut), not a user action. Auth is via a secret key, not user
 * session.
 *
 * Request body: `{ data: [{ date, hrv_ms?, walking_hr_bpm?, steps?, sleep_hours?, active_energy_kcal?, body_mass_lbs? }, ...] }`
 * Response: 200 on success, 400 on validation error, 401 on bad key, 500 on DB error.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { validateApiKey } from '@/lib/api/validate-api-key'
import {
  CARDIO_METRIC_TABLES,
  CardioSyncBatchSchema,
  type CardioMetric,
  type CardioSync,
} from '@/lib/schemas/cardio-sync'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/** Numeric payload fields on {@link CardioSync}, excluding `date`. */
type CardioSyncMetricField = Exclude<keyof CardioSync, 'date'>

/**
 * Maps each optional payload field to the metric whose trend table it feeds.
 * Drives the upsert loop so adding a metric is one row here, not another
 * copy-pasted `if` block.
 */
const SYNC_FIELDS: ReadonlyArray<{
  field: CardioSyncMetricField
  metric: CardioMetric
}> = [
  { field: 'hrv_ms', metric: 'hrv' },
  { field: 'walking_hr_bpm', metric: 'walking_hr' },
  { field: 'steps', metric: 'steps' },
  { field: 'sleep_hours', metric: 'sleep' },
  { field: 'active_energy_kcal', metric: 'active_energy' },
  { field: 'body_mass_lbs', metric: 'body_mass' },
]

/**
 * POST /api/health/auto-sync — upsert cardio trend data.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  if (!validateApiKey(request, 'X-Health-Sync-Key', 'HEALTH_AUTO_SYNC_API_KEY')) {
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
  let batch
  try {
    batch = CardioSyncBatchSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }

  // Upsert each present metric into its table. A null/undefined field means
  // the day had no reading for that metric and is skipped.
  const supabase = createAdminSupabaseClient()
  const results: Record<CardioMetric, number> = {
    hrv: 0,
    walking_hr: 0,
    steps: 0,
    sleep: 0,
    active_energy: 0,
    body_mass: 0,
  }
  const errors: string[] = []

  for (const entry of batch.data) {
    for (const { field, metric } of SYNC_FIELDS) {
      const value = entry[field]
      if (value === null || value === undefined) continue
      // Stamp `updated_at`: the trend tables default it on INSERT but have no
      // update trigger, so re-syncing an existing day must set it here or
      // `imported_at` (MAX(updated_at)) never advances. Matches the import script.
      const { error } = await supabase
        .from(CARDIO_METRIC_TABLES[metric])
        .upsert({ date: entry.date, value, updated_at: new Date().toISOString() })
      if (error) errors.push(`${metric} upsert for ${entry.date}: ${error.message}`)
      else results[metric]++
    }
  }

  // Return result
  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Some upserts failed. Results: ${JSON.stringify(results)}`, details: errors },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { message: 'Health data synced successfully.', results },
    { status: 200 }
  )
}
