/**
 * Shared Supabase write helpers for cardio import scripts (#152).
 *
 * Used by both `scripts/import-health.mjs` (the regular Apple Health
 * → Supabase pipeline) and `scripts/backfill-cardio.mjs` (the one-shot
 * legacy `public/data/cardio.json` import). Keeping the upsert logic
 * here means a future schema tweak only changes one place.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const { loadEnvConfig } = nextEnv

/**
 * Load `.env*` files into `process.env` the same way Next.js does
 * (`.env.local` overrides `.env`, etc.). Call once before reading
 * `SUPABASE_SERVICE_ROLE_KEY` so the import script picks up local
 * dev credentials without an extra `dotenv` dependency.
 */
export function loadEnv() {
  loadEnvConfig(process.cwd())
}

/**
 * Build a service-role Supabase client. Service-role bypasses RLS, so
 * this client must NEVER reach the browser — it's only used by the
 * local import / backfill scripts on the dev machine. The script never
 * runs in production; the key lives only in `.env.local`.
 *
 * @throws Error when `NEXT_PUBLIC_SUPABASE_URL` or
 *   `SUPABASE_SERVICE_ROLE_KEY` is missing. Both must be set before
 *   the script runs (see `.env.example`).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local before running.')
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Grab it from Supabase dashboard → Project Settings → API and add to .env.local.',
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Zod schema for the legacy `CardioData` shape (`types/cardio.ts`,
 * also the on-disk `public/data/cardio.json` shape). Mirrors the
 * row-shape schemas in `lib/schemas/cardio.ts` but accepts the
 * legacy nested `hr_seconds_in_zone` map and tolerates `null` on
 * optional fields (the Python preprocessor emits null for "absent").
 *
 * Drift between this and the TypeScript type `CardioData` is the
 * whole reason the import wrapper exists — a missing field here vs.
 * `types/cardio.ts` fails loudly at import time instead of silently
 * breaking the dashboard at runtime.
 */
const HrZoneSecondsSchema = z
  .object({
    1: z.number().nonnegative(),
    2: z.number().nonnegative(),
    3: z.number().nonnegative(),
    4: z.number().nonnegative(),
    5: z.number().nonnegative(),
  })
  .strict()

const CardioSessionSchema = z
  .object({
    date: z.string().min(1),
    activity: z.enum(['stair', 'running', 'walking']),
    duration_seconds: z.number().nonnegative(),
    distance_meters: z.number().nonnegative().nullable().optional(),
    avg_hr: z.number().nonnegative().nullable().optional(),
    max_hr: z.number().nonnegative().nullable().optional(),
    pace_seconds_per_km: z.number().nonnegative().nullable().optional(),
    hr_seconds_in_zone: HrZoneSecondsSchema.nullable().optional(),
    meters_per_heartbeat: z.number().nonnegative().nullable().optional(),
  })
  .strict()

const CardioTimePointSchema = z
  .object({
    date: z.string().min(1),
    value: z.number(),
  })
  .strict()

export const CardioDataSchema = z
  .object({
    imported_at: z.string().min(1),
    sessions: z.array(CardioSessionSchema),
    resting_hr_trend: z.array(CardioTimePointSchema),
    vo2max_trend: z.array(CardioTimePointSchema),
  })
  .strict()

/**
 * Translate a legacy `CardioSession` from the JSON shape into the
 * `cardio_sessions` row payload (snake_case zone columns). Sibling
 * of `cardioSessionToRow()` in `lib/schemas/cardio.ts`; duplicated
 * here only because `.mjs` scripts can't import `.ts` modules
 * directly without a build step.
 */
function sessionToRow(session) {
  const zones = session.hr_seconds_in_zone ?? null
  return {
    started_at: session.date,
    activity: session.activity,
    duration_seconds: session.duration_seconds,
    distance_meters: session.distance_meters ?? null,
    avg_hr: session.avg_hr ?? null,
    max_hr: session.max_hr ?? null,
    pace_seconds_per_km: session.pace_seconds_per_km ?? null,
    zone1_seconds: zones?.[1] ?? null,
    zone2_seconds: zones?.[2] ?? null,
    zone3_seconds: zones?.[3] ?? null,
    zone4_seconds: zones?.[4] ?? null,
    zone5_seconds: zones?.[5] ?? null,
    meters_per_heartbeat: session.meters_per_heartbeat ?? null,
  }
}

/**
 * Upsert the entire validated `CardioData` payload into Supabase.
 * Idempotent — re-running the import after a fresh Apple Health
 * export overwrites the same primary keys (`started_at` for sessions,
 * `date` for trends) instead of duplicating rows.
 *
 * Trend rows also get an explicit `updated_at = now()` so re-importing
 * the same day's resting-HR after a HealthKit correction reflects the
 * change in the audit column.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role
 *   client; must bypass RLS to write.
 * @param {z.infer<typeof CardioDataSchema>} data Validated payload.
 * @returns {Promise<{ sessions: number, restingHr: number, vo2max: number }>}
 *   Per-table row counts, surfaced in the script's success log.
 */
export async function upsertCardioData(supabase, data) {
  const sessionRows = data.sessions.map(sessionToRow)
  const restingRows = data.resting_hr_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: new Date().toISOString(),
  }))
  const vo2Rows = data.vo2max_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: new Date().toISOString(),
  }))

  if (sessionRows.length > 0) {
    const { error } = await supabase
      .from('cardio_sessions')
      .upsert(sessionRows, { onConflict: 'started_at' })
    if (error) {
      throw new Error(`Failed to upsert cardio_sessions: ${error.message}`)
    }
  }
  if (restingRows.length > 0) {
    const { error } = await supabase
      .from('cardio_resting_hr')
      .upsert(restingRows, { onConflict: 'date' })
    if (error) {
      throw new Error(`Failed to upsert cardio_resting_hr: ${error.message}`)
    }
  }
  if (vo2Rows.length > 0) {
    const { error } = await supabase
      .from('cardio_vo2max')
      .upsert(vo2Rows, { onConflict: 'date' })
    if (error) {
      throw new Error(`Failed to upsert cardio_vo2max: ${error.message}`)
    }
  }

  return {
    sessions: sessionRows.length,
    restingHr: restingRows.length,
    vo2max: vo2Rows.length,
  }
}
