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
 *
 * KEEP IN SYNC WITH: `types/cardio.ts` (CardioData), `lib/schemas/cardio.ts`
 * (CardioSessionRowSchema, CardioTrendRowSchema), and the Python
 * preprocessor's output shape in `scripts/preprocess-health.py`. A
 * `grep "KEEP IN SYNC WITH"` audit is the working substitute for a
 * cross-language type system here — `.mjs` can't import `.ts` without a
 * build step, so the duplication is intentional.
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
 *
 * Stamps `updated_at = now()` so the data layer's `imported_at`
 * computation (`MAX(updated_at)` across all three tables) advances
 * on every re-import, even when the row already existed.
 */
function sessionToRow(session, importedAt) {
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
    updated_at: importedAt,
  }
}

/**
 * Upsert the entire validated `CardioData` payload into Supabase, then
 * delete any rows whose primary key isn't in the payload — making each
 * import an exact mirror of the source dataset, not a cumulative
 * append.
 *
 * Why prune: the documented workflow is "fix in HealthKit, re-import."
 * Without a prune step, deleting a workout in HealthKit (or having a
 * trend day disappear from the export) would leave stale rows in
 * Supabase that the dashboard would keep rendering. The Apple Health
 * "Export All Health Data" produces the full archive, so the import
 * payload is authoritative — pruning is the right default.
 *
 * Idempotent — re-running on the same payload is a series of
 * no-op upserts (which still bump `updated_at`) and zero deletes.
 * `updated_at = importedAt` is stamped on every upserted row so the
 * data layer's `imported_at` computation (MAX(updated_at) across the
 * three tables) advances on every re-import even when nothing changed.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role
 *   client; must bypass RLS to write.
 * @param {z.infer<typeof CardioDataSchema>} data Validated payload.
 * @returns {Promise<{ sessions: number, restingHr: number, vo2max: number, pruned: number }>}
 *   Per-table upsert counts plus total deletions, surfaced in the
 *   script's success log so a user notices when an import unexpectedly
 *   removes rows.
 * @throws when any Supabase query fails.
 */
export async function upsertCardioData(supabase, data) {
  // Single batch timestamp so all rows land with the exact same
  // `updated_at` and the `imported_at` reader picks one canonical
  // value rather than three near-equal ones.
  const importedAt = new Date().toISOString()

  const sessionRows = data.sessions.map((s) => sessionToRow(s, importedAt))
  const restingRows = data.resting_hr_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: importedAt,
  }))
  const vo2Rows = data.vo2max_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: importedAt,
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

  const sessionsPruned = await pruneOrphans(
    supabase,
    'cardio_sessions',
    'started_at',
    sessionRows.map((r) => r.started_at),
  )
  const restingPruned = await pruneOrphans(
    supabase,
    'cardio_resting_hr',
    'date',
    restingRows.map((r) => r.date),
  )
  const vo2Pruned = await pruneOrphans(
    supabase,
    'cardio_vo2max',
    'date',
    vo2Rows.map((r) => r.date),
  )

  return {
    sessions: sessionRows.length,
    restingHr: restingRows.length,
    vo2max: vo2Rows.length,
    pruned: sessionsPruned + restingPruned + vo2Pruned,
  }
}

/**
 * Delete rows from `table` whose primary-key value isn't in the
 * caller-supplied `keepKeys` set. The "exact mirror" half of
 * {@link upsertCardioData} — without this, a workout deleted from
 * HealthKit and re-imported would leave a stale Supabase row that the
 * dashboard would keep rendering.
 *
 * **Empty-payload guard.** When `keepKeys` is `[]`, this function is a
 * no-op (returns 0 without touching the DB). An import that happens to
 * have zero rows for one table is interpreted as "this import has no
 * opinion on that table," not "delete everything in it" — that
 * protects against parser bugs, partial Apple Health exports, and
 * mis-typed inputs from silently wiping the dataset. If you genuinely
 * want to empty a table, do it with a manual SQL `delete`.
 *
 * Implementation note: PostgREST doesn't expose a clean `NOT IN` for
 * large lists, so we fetch all existing PKs (cheap — these tables top
 * out around 1k rows on Lucas's data) and DELETE the ones missing from
 * the import. With a v2 multi-tenant rewrite this would become a
 * server-side `delete from ... where pk not in (...)` instead.
 *
 * Returns the number of rows deleted so the caller can surface
 * surprising prunes in the success log.
 *
 * Exported so unit tests can pin the empty-payload guard and the
 * orphan-detection logic; production callers should use
 * {@link upsertCardioData}.
 */
export async function pruneOrphans(supabase, table, pkColumn, keepKeys) {
  if (keepKeys.length === 0) return 0
  const { data: existing, error: selectErr } = await supabase
    .from(table)
    .select(pkColumn)
  if (selectErr) {
    throw new Error(`Failed to scan ${table} for orphans: ${selectErr.message}`)
  }
  const keep = new Set(keepKeys)
  const orphans = (existing ?? [])
    .map((row) => row[pkColumn])
    .filter((key) => !keep.has(key))
  if (orphans.length === 0) return 0
  const { error: deleteErr } = await supabase
    .from(table)
    .delete()
    .in(pkColumn, orphans)
  if (deleteErr) {
    throw new Error(`Failed to prune orphans from ${table}: ${deleteErr.message}`)
  }
  return orphans.length
}
