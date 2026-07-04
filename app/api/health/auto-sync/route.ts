/**
 * Auto-sync endpoint for Apple Health data from the iPhone Shortcut (#272).
 *
 * Receives daily-aggregated cardio metrics (HRV, walking HR, steps, sleep,
 * active energy) and upserts them into the corresponding Supabase trend tables.
 * Authenticated via API key header (HEALTH_AUTO_SYNC_API_KEY env var).
 *
 * This is not an admin route because it's triggered by device automation
 * (Apple Shortcut), not a user action. Auth is via a secret key, not user
 * session.
 *
 * Request body: `{ data: [{ date, hrv_ms?, walking_hr_bpm?, steps?, sleep_hours?, active_energy_kcal? }, ...] }`
 * Response: 200 on success, 400 on validation error, 401 on bad key, 500 on DB error.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { CardioSyncBatchSchema } from '@/lib/schemas/cardio-sync'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * Validate the API key from the Authorization header.
 */
function validateApiKey(request: NextRequest): boolean {
  const key = request.headers.get('X-Health-Sync-Key')
  const expectedKey = process.env.HEALTH_AUTO_SYNC_API_KEY
  if (!expectedKey) {
    console.error(
      'HEALTH_AUTO_SYNC_API_KEY env var not set — health auto-sync endpoint is disabled'
    )
    return false
  }
  return key === expectedKey
}

/**
 * POST /api/health/auto-sync — upsert cardio trend data.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  if (!validateApiKey(request)) {
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

  // Upsert each metric into its table
  const supabase = createServiceRoleClient()
  const results = { hrv: 0, walking_hr: 0, steps: 0, sleep: 0, active_energy: 0 }
  const errors: string[] = []

  for (const entry of batch.data) {
    // HRV
    if (entry.hrv_ms !== null && entry.hrv_ms !== undefined) {
      const { error } = await supabase
        .from('cardio_hrv_trend')
        .upsert({ date: entry.date, value: entry.hrv_ms })
      if (error) errors.push(`HRV upsert for ${entry.date}: ${error.message}`)
      else results.hrv++
    }

    // Walking HR
    if (entry.walking_hr_bpm !== null && entry.walking_hr_bpm !== undefined) {
      const { error } = await supabase
        .from('cardio_walking_hr_trend')
        .upsert({ date: entry.date, value: entry.walking_hr_bpm })
      if (error) errors.push(`Walking HR upsert for ${entry.date}: ${error.message}`)
      else results.walking_hr++
    }

    // Steps
    if (entry.steps !== null && entry.steps !== undefined) {
      const { error } = await supabase
        .from('cardio_step_count_trend')
        .upsert({ date: entry.date, value: entry.steps })
      if (error) errors.push(`Steps upsert for ${entry.date}: ${error.message}`)
      else results.steps++
    }

    // Sleep
    if (entry.sleep_hours !== null && entry.sleep_hours !== undefined) {
      const { error } = await supabase
        .from('cardio_sleep_trend')
        .upsert({ date: entry.date, value: entry.sleep_hours })
      if (error) errors.push(`Sleep upsert for ${entry.date}: ${error.message}`)
      else results.sleep++
    }

    // Active energy
    if (entry.active_energy_kcal !== null && entry.active_energy_kcal !== undefined) {
      const { error } = await supabase
        .from('cardio_active_energy_trend')
        .upsert({ date: entry.date, value: entry.active_energy_kcal })
      if (error) errors.push(`Active energy upsert for ${entry.date}: ${error.message}`)
      else results.active_energy++
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
