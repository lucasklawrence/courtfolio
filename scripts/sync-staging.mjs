/**
 * Refresh the staging Supabase project from production.
 *
 * Staging (`court-vision-preview`) exists so preview deploys can render real
 * data without holding a credential that can write production. Its contents are
 * a **point-in-time copy**, not a live mirror — nothing dual-writes to it. The
 * nightly OTbeat ingest, the log-workout/log-weight skills, and the Apple Health
 * import all target production only, so staging goes stale between runs of this
 * script. Treat it as a rehearsal dataset, never as a source of truth: if you
 * want to know how many classes you did in July, ask production.
 *
 * Rows stream directly between the two PostgREST endpoints, so a full refresh
 * (~45k rows, dominated by cardio_session_hr_samples) never passes through a
 * caller's memory or a CI log.
 *
 * Semantics, and their limits:
 * - **Upsert**, resolving on each table's key, so edits made in production
 *   propagate — a corrected weight, a manual `class_type_override`, an
 *   `excluded` flag flipped by hand.
 * - Rows that exist **only** in staging are left alone, so hand-made test data
 *   survives a refresh.
 * - **Deletions do not propagate.** A row deleted in production lingers in
 *   staging until the project is rebuilt. Accepted deliberately: a delete-aware
 *   sync means either a prune pass or a truncate-and-reload, and truncating
 *   would destroy the staging-only test rows the previous point protects.
 *
 * Column drift is handled: production frequently runs *ahead* of `main`, because
 * a feature branch's migration is applied to production before its PR merges.
 * Each row is projected onto the columns staging actually has, so an unknown
 * column is dropped rather than 400-ing the whole table.
 *
 * Requires (see scripts/README.md):
 *   PROD_SUPABASE_URL, PROD_SUPABASE_ANON_KEY   — read; anon suffices, every
 *                                                 synced table is anon-readable
 *   STAGING_SUPABASE_URL, STAGING_SUPABASE_SECRET_KEY — write; RLS grants anon
 *                                                 SELECT only, and the OpenAPI
 *                                                 schema endpoint requires a
 *                                                 secret key
 */

const PROD_URL = process.env.PROD_SUPABASE_URL?.replace(/\/$/, '')
const PROD_KEY = process.env.PROD_SUPABASE_ANON_KEY
const STAGING_URL = process.env.STAGING_SUPABASE_URL?.replace(/\/$/, '')
const STAGING_KEY = process.env.STAGING_SUPABASE_SECRET_KEY

/** PostgREST caps an unbounded select at `max_rows`; always page explicitly. */
const READ_PAGE = 1000

/** Rows per write request — keeps bodies comfortably under the size limit. */
const WRITE_BATCH = 500

/**
 * Tables to copy, **parents before children** so foreign keys resolve
 * (cardio_sessions → cardio_session_hr_samples, weight_room_goals →
 * weight_room_sets).
 *
 * `mode` picks how a table reconciles, and the choice follows from its key:
 *
 * - `upsert` (default) — resolve on `conflict`, a **natural** key that means the
 *   same thing in both projects (`date`, `started_at`, `exercise`, `label`).
 *   Safe because the same logical row carries the same key everywhere.
 *
 * - `replace` — delete staging's rows, then insert production's verbatim. For
 *   tables whose primary key is a **`gen_random_uuid()` surrogate** *and* whose
 *   rows are seeded by a migration: both projects run that migration
 *   independently, so the same logical row gets a different id in each. Upserting
 *   on `id` then never matches, and the insert either trips a unique business-key
 *   index (weight_room_achievements: 409 on
 *   `(exercise, scope, measure, threshold)`) or, worse, silently duplicates the
 *   row where no such index exists — which is how staging ended up with two July
 *   shrugs focuses against production's one.
 *
 *   PostgREST can't fix this by conflicting on the natural key instead:
 *   weight_room_achievements' uniqueness lives in two *partial* indexes
 *   (`where exercise is not null` / `where exercise is null`), and `on_conflict`
 *   has no way to supply an index predicate. Replace sidesteps inference
 *   entirely and has the side benefit of carrying production's ids across, so a
 *   row's identity is stable between the two projects.
 *
 *   Only safe because these are reference tables nobody hand-edits in staging.
 *   Never mark a table `replace` if you'd mind losing staging-only rows in it.
 *
 * `panel_runs` is deliberately absent: it's service-role-only in production so
 * the anon read would return nothing, and live-panel run history has no bearing
 * on what a preview deploy renders.
 */
const TABLES = [
  { name: 'movement_benchmarks', conflict: 'date' },
  { name: 'cardio_sessions', conflict: 'started_at' },
  { name: 'cardio_session_hr_samples', conflict: 'session_started_at,sample_at' },
  { name: 'cardio_resting_hr', conflict: 'date' },
  { name: 'cardio_vo2max', conflict: 'date' },
  { name: 'cardio_hrv_trend', conflict: 'date' },
  { name: 'cardio_walking_hr_trend', conflict: 'date' },
  { name: 'cardio_body_mass_trend', conflict: 'date' },
  { name: 'cardio_step_count_trend', conflict: 'date' },
  { name: 'cardio_sleep_trend', conflict: 'date' },
  { name: 'cardio_active_energy_trend', conflict: 'date' },
  { name: 'otf_sessions', conflict: 'started_at' },
  { name: 'otf_mileage_awards', conflict: 'label' },
  { name: 'weight_room_goals', conflict: 'exercise' },
  { name: 'weight_room_achievements', mode: 'replace', key: 'id' },
  { name: 'weight_room_monthly_focus', mode: 'replace', key: 'id' },
  // Real logged data, not migration-seeded: its uuids originate in production
  // and nothing regenerates them in staging, so upserting on id is correct.
  { name: 'weight_room_sets', conflict: 'id' },
]

/**
 * Column names per table as they exist in **staging**, read from PostgREST's
 * OpenAPI document. That endpoint requires a secret key, which is why the
 * staging side can't run on the publishable key.
 *
 * @returns {Promise<Record<string, string[]>>} table name → column names.
 * @throws {Error} when the schema can't be read.
 */
async function stagingColumns() {
  const res = await fetch(`${STAGING_URL}/rest/v1/`, {
    headers: { apikey: STAGING_KEY, authorization: `Bearer ${STAGING_KEY}` },
  })
  if (!res.ok) {
    throw new Error(`Could not read the staging schema: ${res.status} ${await res.text()}`)
  }
  const spec = await res.json()
  const out = {}
  for (const [table, def] of Object.entries(spec.definitions ?? {})) {
    out[table] = Object.keys(def.properties ?? {})
  }
  return out
}

/** One page of rows from production. */
async function readPage(table, offset) {
  const res = await fetch(
    `${PROD_URL}/rest/v1/${table}?select=*&limit=${READ_PAGE}&offset=${offset}`,
    { headers: { apikey: PROD_KEY, authorization: `Bearer ${PROD_KEY}` } }
  )
  if (!res.ok) throw new Error(`read ${table} @${offset}: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Upsert a batch into staging, overwriting rows that share the conflict key. */
async function writeBatch(table, conflict, rows) {
  const res = await fetch(`${STAGING_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: {
      apikey: STAGING_KEY,
      authorization: `Bearer ${STAGING_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`write ${table}: ${res.status} ${await res.text()}`)
}

/** Plain insert, no conflict resolution — for `replace` tables, post-clear. */
async function insertBatch(table, rows) {
  const res = await fetch(`${STAGING_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: STAGING_KEY,
      authorization: `Bearer ${STAGING_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${await res.text()}`)
}

/**
 * Empty a staging table ahead of a `replace` copy.
 *
 * PostgREST refuses an unfiltered DELETE, so filter on the key being non-null —
 * true for every row, since it's the primary key.
 */
async function clearTable(table, key) {
  const res = await fetch(`${STAGING_URL}/rest/v1/${table}?${key}=not.is.null`, {
    method: 'DELETE',
    headers: {
      apikey: STAGING_KEY,
      authorization: `Bearer ${STAGING_KEY}`,
      prefer: 'return=minimal',
    },
  })
  if (!res.ok) throw new Error(`clear ${table}: ${res.status} ${await res.text()}`)
}

/** Drop keys staging doesn't have, so production running ahead can't 400 a table. */
function project(row, allowed) {
  const out = {}
  for (const k of allowed) if (k in row) out[k] = row[k]
  return out
}

async function copyTable({ name, conflict, mode, key }, allowed) {
  let copied = 0
  const dropped = new Set()
  // Clear before the first insert, not after reading — a `replace` table is
  // small reference data, so the window where staging is empty is negligible.
  if (mode === 'replace') await clearTable(name, key)
  for (let offset = 0; ; offset += READ_PAGE) {
    const page = await readPage(name, offset)
    if (page.length === 0) break
    for (const row of page) {
      for (const k of Object.keys(row)) if (!allowed.includes(k)) dropped.add(k)
    }
    const rows = page.map((r) => project(r, allowed))
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      const batch = rows.slice(i, i + WRITE_BATCH)
      if (mode === 'replace') await insertBatch(name, batch)
      else await writeBatch(name, conflict, batch)
    }
    copied += page.length
    if (page.length < READ_PAGE) break
  }
  return { copied, dropped: [...dropped], mode: mode ?? 'upsert' }
}

async function main() {
  const missing = [
    ['PROD_SUPABASE_URL', PROD_URL],
    ['PROD_SUPABASE_ANON_KEY', PROD_KEY],
    ['STAGING_SUPABASE_URL', STAGING_URL],
    ['STAGING_SUPABASE_SECRET_KEY', STAGING_KEY],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.error(`✗ staging sync: missing ${missing.join(', ')}`)
    process.exitCode = 2
    return
  }

  // Refuse to run backwards. Overwriting production from staging would be
  // unrecoverable, and the two URLs are one copy-paste apart.
  if (PROD_URL === STAGING_URL) {
    console.error('✗ staging sync: PROD and STAGING point at the same project — refusing.')
    process.exitCode = 2
    return
  }

  const schema = await stagingColumns()
  let failed = 0
  let total = 0

  for (const table of TABLES) {
    const allowed = schema[table.name]
    if (!allowed) {
      console.error(`✗ ${table.name}: not present in staging — apply the migration first`)
      failed += 1
      continue
    }
    try {
      const { copied, dropped, mode } = await copyTable(table, allowed)
      total += copied
      const note = dropped.length > 0 ? `  (dropped ahead-of-staging columns: ${dropped.join(', ')})` : ''
      const how = mode === 'replace' ? ' [replaced]' : ''
      console.log(`${copied === 0 ? '·' : '✓'} ${table.name}: ${copied}${how}${note}`)
    } catch (err) {
      console.error(`✗ ${table.name}: ${err.message}`)
      failed += 1
    }
  }

  console.log(`\n${failed === 0 ? '✓' : '!'} staging sync: ${total} rows across ${TABLES.length - failed}/${TABLES.length} tables.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exitCode = 2
})
