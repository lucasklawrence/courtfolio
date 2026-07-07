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

/**
 * One HR sample inside a session window (#165). The Python preprocessor
 * emits these alongside the aggregate zone columns so the per-session
 * detail page can render an HR curve. `nullable()` carries through the
 * "no samples for this session" case (Apple Watch off) without
 * normalization.
 */
const HrSampleSchema = z
  .object({
    ts: z.string().min(1),
    bpm: z.number().nonnegative(),
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
    hr_samples: z.array(HrSampleSchema).nullable().optional(),
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
    // #75 slice C-data — six lifestyle-metric trends ported from
    // cardio-dashboard. Optional at the schema level so old preprocessor
    // outputs without these keys still validate; new outputs include
    // them as (possibly empty) arrays.
    hrv_trend: z.array(CardioTimePointSchema).optional(),
    walking_hr_trend: z.array(CardioTimePointSchema).optional(),
    body_mass_trend: z.array(CardioTimePointSchema).optional(),
    step_count_trend: z.array(CardioTimePointSchema).optional(),
    sleep_trend: z.array(CardioTimePointSchema).optional(),
    active_energy_trend: z.array(CardioTimePointSchema).optional(),
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
 * delete any row whose `updated_at` is older than this batch — for any
 * table that received at least one upsert. Each import is an exact
 * mirror of the source dataset *for the tables it touches*, not a
 * cumulative append; tables for which the batch had zero rows are left
 * alone (see {@link pruneStaleRows}'s empty-payload guard).
 *
 * Why prune: the documented workflow is "fix in HealthKit, re-import."
 * Without a prune step, deleting a workout in HealthKit (or having a
 * trend day disappear from the export) would leave stale rows in
 * Supabase that the dashboard would keep rendering. The Apple Health
 * "Export All Health Data" produces the full archive, so a non-empty
 * payload is authoritative for that table — pruning is the right default.
 *
 * Caveat for partial payloads: a batch that includes *some* rows for
 * a table makes the batch authoritative for that table — rows that
 * exist in Supabase but aren't in the batch will be deleted. Don't
 * pass a deliberately-truncated payload (e.g. "just the last 30 days")
 * unless you want everything older removed.
 *
 * Body-mass exception: `cardio_body_mass_trend` is multi-source. Manual
 * weigh-ins logged by the log-weight skill carry `source='manual'`; this
 * import writes `source='apple_health'`. To keep manual entries authoritative,
 * the import drops any payload day that already has a manual row and scopes its
 * prune to `source='apple_health'` — so a full import never overwrites or
 * deletes a manually-logged day, even one absent from the Apple Health export.
 *
 * Idempotent — re-running on the same payload is a series of no-op
 * upserts (which still bump `updated_at` to the new batch timestamp)
 * and zero deletes (every row's `updated_at` matches the batch, so
 * `lt('updated_at', importedAt)` returns nothing). `updated_at =
 * importedAt` is stamped on every upserted row so the data layer's
 * `imported_at` computation (MAX(updated_at) across the three tables)
 * advances on every re-import even when nothing changed.
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
/**
 * Lifestyle-trend tables to upsert in the same batch as resting HR /
 * VO2max (#75 slice C-data). Each maps a `CardioData` field name to its
 * Supabase table; the upsert / prune loop below treats them uniformly.
 */
const LIFESTYLE_TREND_TABLES = [
  ['hrv_trend', 'cardio_hrv_trend'],
  ['walking_hr_trend', 'cardio_walking_hr_trend'],
  // body_mass_trend is handled separately (source-aware) in
  // {@link upsertCardioData}: it is multi-source (manual weigh-ins from the
  // log-weight skill + Apple Health scale readings), so its upsert and prune
  // must be scoped to `source='apple_health'` and never touch manual rows.
  ['step_count_trend', 'cardio_step_count_trend'],
  ['sleep_trend', 'cardio_sleep_trend'],
  ['active_energy_trend', 'cardio_active_energy_trend'],
]

export async function upsertCardioData(supabase, data) {
  // Defense-in-depth schema check at the write boundary. Both production
  // callers (import-health.mjs, backfill-cardio.mjs) already validate via
  // `CardioDataSchema.safeParse` before calling, but a future caller
  // wouldn't have to — this guarantees the DB never sees a malformed
  // payload no matter who invokes us. `.parse` throws on invalid input;
  // we want that loud failure before touching Supabase.
  const parsed = CardioDataSchema.parse(data)

  // Single batch timestamp so all rows land with the exact same
  // `updated_at` and the `imported_at` reader picks one canonical
  // value rather than three near-equal ones.
  const importedAt = new Date().toISOString()

  const sessionRows = parsed.sessions.map((s) => sessionToRow(s, importedAt))
  const restingRows = parsed.resting_hr_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: importedAt,
  }))
  const vo2Rows = parsed.vo2max_trend.map((point) => ({
    date: point.date,
    value: point.value,
    updated_at: importedAt,
  }))
  // Lifestyle trends share the `(date, value, updated_at)` row shape with
  // resting HR / VO2max — same row-builder, different field/table names.
  const lifestyleRows = LIFESTYLE_TREND_TABLES.map(([field, table]) => ({
    field,
    table,
    rows: (parsed[field] ?? []).map((point) => ({
      date: point.date,
      value: point.value,
      updated_at: importedAt,
    })),
  }))

  // Body mass is multi-source. The log-weight skill writes daily manual
  // weigh-ins (`source='manual'`); this import writes Apple Health scale
  // readings (`source='apple_health'`). Manual always wins, so a full import
  // must never overwrite or prune a day that already has a manual row. Fetch
  // the manual dates up front (only when the payload actually carries body
  // mass) and drop those days from the batch; the prune below is likewise
  // scoped to `source='apple_health'`.
  const bodyMassPayload = parsed.body_mass_trend ?? []
  let manualBodyMassDates = new Set()
  if (bodyMassPayload.length > 0) {
    const { data: manualRows, error: manualErr } = await supabase
      .from('cardio_body_mass_trend')
      .select('date')
      .eq('source', 'manual')
    if (manualErr) {
      throw new Error(`Failed to read manual body-mass dates: ${manualErr.message}`)
    }
    manualBodyMassDates = new Set(
      (manualRows ?? []).map((r) => String(r.date).slice(0, 10)),
    )
  }
  const bodyMassRows = bodyMassPayload
    .filter((point) => !manualBodyMassDates.has(point.date))
    .map((point) => ({
      date: point.date,
      value: point.value,
      source: 'apple_health',
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
  // Per-session replace for HR samples (#165). Runs after the
  // cardio_sessions upsert so the FK from cardio_session_hr_samples
  // resolves; sessions pruned later by `pruneStaleRows` cascade their
  // samples via the `on delete cascade` FK.
  const hrSamplesInserted = await upsertHrSamples(supabase, parsed.sessions)
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
  for (const { table, rows } of lifestyleRows) {
    if (rows.length === 0) continue
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'date' })
    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`)
    }
  }
  if (bodyMassRows.length > 0) {
    const { error } = await supabase
      .from('cardio_body_mass_trend')
      .upsert(bodyMassRows, { onConflict: 'date' })
    if (error) {
      throw new Error(`Failed to upsert cardio_body_mass_trend: ${error.message}`)
    }
  }

  const sessionsPruned = await pruneStaleRows(
    supabase,
    'cardio_sessions',
    importedAt,
    sessionRows.length > 0,
  )
  const restingPruned = await pruneStaleRows(
    supabase,
    'cardio_resting_hr',
    importedAt,
    restingRows.length > 0,
  )
  const vo2Pruned = await pruneStaleRows(
    supabase,
    'cardio_vo2max',
    importedAt,
    vo2Rows.length > 0,
  )
  let lifestylePruned = 0
  const lifestyleCounts = {}
  for (const { field, table, rows } of lifestyleRows) {
    lifestyleCounts[field] = rows.length
    lifestylePruned += await pruneStaleRows(supabase, table, importedAt, rows.length > 0)
  }
  // Scope the body-mass prune to apple_health so manual weigh-ins survive a
  // full import that doesn't include them (see bodyMassRows above).
  const bodyMassPruned = await pruneStaleRows(
    supabase,
    'cardio_body_mass_trend',
    importedAt,
    bodyMassRows.length > 0,
    'apple_health',
  )

  return {
    sessions: sessionRows.length,
    restingHr: restingRows.length,
    vo2max: vo2Rows.length,
    hrSamples: hrSamplesInserted,
    ...lifestyleCounts,
    // Count of Apple Health body-mass rows written (manual days are excluded
    // from the batch, so this can be < the payload's body_mass_trend length).
    body_mass_trend: bodyMassRows.length,
    pruned:
      sessionsPruned + restingPruned + vo2Pruned + lifestylePruned + bodyMassPruned,
  }
}

/** Per-batch insert size for HR samples — stays well under PostgREST's payload limits. */
const HR_SAMPLES_INSERT_BATCH = 500

/**
 * Replace the HR sample stream for every session in the import payload (#165).
 *
 * For each session: delete all existing rows in `cardio_session_hr_samples`
 * keyed by `session_started_at`, then insert the new samples in
 * {@link HR_SAMPLES_INSERT_BATCH}-sized chunks. Per-session replace is the
 * simplest idempotent contract — re-importing the same session is a no-op
 * delta-wise, and a session whose sample stream has since vanished
 * (Apple Watch off mid-workout, fixed in HealthKit) gets a clean reset
 * instead of stale samples lingering.
 *
 * The cascade FK on `cardio_session_hr_samples → cardio_sessions` handles
 * the "session was pruned entirely" case for free — `pruneStaleRows`
 * deletes the parent and Postgres cleans the children. So this function
 * doesn't need its own prune step.
 *
 * Sessions with no `hr_samples` (preprocessor returns `null` for "Apple
 * Watch off") still run the delete so an authoritative-absent import
 * clears any stored samples for that session.
 *
 * @param supabase Service-role Supabase client (bypasses RLS); passed
 *   through to the chained `from(...).delete()/insert()` calls.
 * @param sessions Validated sessions from `CardioDataSchema`'s
 *   `sessions` array; only `date` and `hr_samples` are read here.
 * @returns Promise<number> — total inserted-sample count across all
 *   sessions, surfaced in the import script's success log.
 * @throws when any DELETE or INSERT fails.
 */
export async function upsertHrSamples(supabase, sessions) {
  let totalInserted = 0
  for (const session of sessions) {
    const { error: deleteErr } = await supabase
      .from('cardio_session_hr_samples')
      .delete()
      .eq('session_started_at', session.date)
    if (deleteErr) {
      throw new Error(
        `Failed to clear cardio_session_hr_samples for session ${session.date}: ${deleteErr.message}`,
      )
    }

    const samples = session.hr_samples ?? []
    if (samples.length === 0) continue

    const rows = samples.map((s) => ({
      session_started_at: session.date,
      sample_at: s.ts,
      bpm: s.bpm,
    }))
    for (let i = 0; i < rows.length; i += HR_SAMPLES_INSERT_BATCH) {
      const batch = rows.slice(i, i + HR_SAMPLES_INSERT_BATCH)
      const { error: insertErr } = await supabase
        .from('cardio_session_hr_samples')
        .insert(batch)
      if (insertErr) {
        throw new Error(
          `Failed to insert cardio_session_hr_samples for session ${session.date}: ${insertErr.message}`,
        )
      }
      totalInserted += batch.length
    }
  }
  return totalInserted
}

/**
 * Delete rows from `table` whose `updated_at` is older than this batch's
 * `importedAt`. The "exact mirror" half of {@link upsertCardioData} —
 * without this, a workout deleted from HealthKit and re-imported would
 * leave a stale Supabase row that the dashboard would keep rendering.
 *
 * Why timestamp-based instead of PK-set diff (the original #152
 * implementation): the PK-set approach compared source PK strings
 * against PostgREST's normalized output, which fails when the source
 * emits a date-only string for a `timestamptz` PK. Postgres normalizes
 * `"2026-02-08"` to `"2026-02-08T00:00:00+00:00"`, so the keep set
 * `{"2026-02-08"}` and the existing set `{"2026-02-08T00:00:00+00:00"}`
 * never overlap, every row is misclassified as an orphan, and the
 * table is wiped on the first import. See #158 for the full repro.
 *
 * Since `upsertCardioData` stamps `updated_at = importedAt` on every
 * upserted row in this batch, anything left with `updated_at <
 * importedAt` is by definition not in the source. One DELETE,
 * server-side `timestamptz < timestamptz` comparison — no SELECT, no
 * pagination, no PK-format gotchas, no 1000-row cap.
 *
 * **Empty-payload guard.** When `hadAnyUpserts` is `false`, this is a
 * no-op (returns 0 without touching the DB). An import with no rows
 * for a table is interpreted as "this import has no opinion on that
 * table," not "delete everything in it" — protects parser bugs,
 * empty-table payloads, and mis-typed inputs from silently wiping
 * the dataset. Note this does *not* protect partial-but-non-empty
 * payloads: if `hadAnyUpserts` is true and the batch contains, say,
 * 5 of the 100 sessions actually in HealthKit, the other 95 will be
 * pruned. Pass full-archive payloads only. To genuinely empty a
 * table, use manual SQL.
 *
 * Returns the number of rows deleted so the caller can surface
 * surprising prunes in the success log.
 *
 * Exported so unit tests can pin the empty-payload guard, the
 * timestamp comparison, and the failure paths; production callers
 * should use {@link upsertCardioData}.
 *
 * @param {string} importedAt ISO 8601 batch timestamp; every row
 *   upserted in this batch has `updated_at = importedAt`, so the strict
 *   `<` keeps them and removes only earlier-batch rows.
 * @param {boolean} hadAnyUpserts True iff at least one row was
 *   upserted into `table` in this batch. When false the prune is
 *   skipped entirely (see Empty-payload guard above).
 * @param {string|null} source When non-null, restrict the prune to rows
 *   with this `source` value. Used for multi-source tables like
 *   `cardio_body_mass_trend`, where a full Apple Health import
 *   (`source='apple_health'`) must not delete manually-logged weigh-ins
 *   (`source='manual'`) that simply aren't in the export. `null` (the
 *   default) prunes regardless of source, preserving the original
 *   single-source behavior for every other table.
 */
export async function pruneStaleRows(supabase, table, importedAt, hadAnyUpserts, source = null) {
  if (!hadAnyUpserts) return 0
  let query = supabase.from(table).delete({ count: 'exact' }).lt('updated_at', importedAt)
  if (source !== null) query = query.eq('source', source)
  const { error, count } = await query
  if (error) {
    throw new Error(`Failed to prune stale rows from ${table}: ${error.message}`)
  }
  return count ?? 0
}
