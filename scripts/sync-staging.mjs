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
 *   propagate — a corrected weight, a hand-entered `class_format`, an
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
 * `--keepalive` skips the sync and makes one read against staging, so the
 * Free-plan project never looks idle (see `keepalive()` below).
 *
 * Requires (see scripts/README.md):
 *   PROD_SUPABASE_URL, PROD_SUPABASE_ANON_KEY   — read; anon suffices, every
 *                                                 synced table is anon-readable
 *   STAGING_SUPABASE_URL, STAGING_SUPABASE_SECRET_KEY — write; RLS grants anon
 *                                                 SELECT only, and the OpenAPI
 *                                                 schema endpoint requires a
 *                                                 secret key
 */

import { pathToFileURL } from 'node:url'

const PROD_URL = process.env.PROD_SUPABASE_URL?.replace(/\/$/, '')
const PROD_KEY = process.env.PROD_SUPABASE_ANON_KEY
const STAGING_URL = process.env.STAGING_SUPABASE_URL?.replace(/\/$/, '')
const STAGING_KEY = process.env.STAGING_SUPABASE_SECRET_KEY

/** PostgREST caps an unbounded select at `max_rows`; always page explicitly. */
const READ_PAGE = 1000

/** Rows per write request — keeps bodies comfortably under the size limit. */
const WRITE_BATCH = 500

/**
 * Network error codes that mean "the host is not there", as opposed to a slow or
 * flaky one. A paused Supabase project has its DNS record removed, so every
 * request to it dies in the resolver with `ENOTFOUND` — which undici reports as
 * a bare `TypeError: fetch failed`, the only line eleven weeks of failed runs
 * ever printed (#478).
 */
const UNREACHABLE_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])

/**
 * Turn a failed request into a message that names the side, the step and the
 * host, plus the underlying network cause when there is one.
 *
 * `fetch` rejects with `TypeError('fetch failed')` for every transport-level
 * failure and hides the real reason (`ENOTFOUND`, `ECONNRESET`, a TLS error) in
 * `err.cause`. Printing only `err.message` is how a paused staging project read
 * as "fetch failed" for eleven weeks with nothing pointing at the cause.
 *
 * @param {'production' | 'staging'} side Which project the request went to.
 * @param {string} step What the sync was doing, e.g. `read cardio_sessions @0`.
 * @param {string} url The request URL. Only its host is printed: the path can
 *   carry a table name, never a key, but the host is all a reader needs.
 * @param {unknown} err What `fetch` threw.
 * @returns {string} A one-line description, with a hint when the host doesn't
 *   resolve.
 */
export function describeRequestFailure(side, step, url, err) {
  let host = url
  try {
    host = new URL(url).host
  } catch {
    // Not a URL we can parse; print it as given rather than hide it.
  }
  const cause = err && typeof err === 'object' && 'cause' in err ? err.cause : undefined
  const code =
    cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string'
      ? cause.code
      : undefined
  const detail =
    cause instanceof Error ? cause.message : err instanceof Error ? err.message : String(err)
  let message = `${side} ${step}: could not reach ${host} (${code ? `${code}: ` : ''}${detail})`
  if (code && UNREACHABLE_CODES.has(code)) {
    message +=
      side === 'staging'
        ? ' — the staging host does not answer. A paused Supabase project loses its DNS record:' +
          ' check the project status in the Supabase dashboard before debugging anything else.'
        : ' — the production host does not answer. Check the PROD_SUPABASE_URL secret and the' +
          ' project status in the Supabase dashboard.'
  }
  return message
}

/**
 * `fetch`, but a transport failure throws an error naming the side, step and
 * host instead of a bare `fetch failed`. HTTP error statuses are still the
 * caller's to handle — those arrive as a response, not a rejection.
 *
 * @param {'production' | 'staging'} side
 * @param {string} step
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 * @throws {Error} when the request never produced a response.
 */
async function request(side, step, url, init) {
  try {
    return await fetch(url, init)
  } catch (err) {
    throw new Error(describeRequestFailure(side, step, url, err), { cause: err })
  }
}

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
export const TABLES = [
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
  // Must precede otf_sessions: `otf_sessions.booking_id` is a foreign key into
  // this table, so copying sessions first would fail on a booking staging
  // doesn't have yet (#453).
  { name: 'otf_bookings', conflict: 'external_event_id' },
  { name: 'otf_sessions', conflict: 'started_at' },
  { name: 'otf_mileage_awards', conflict: 'label' },
  // Weight Room, in foreign-key order. Everything below references
  // `weight_room_exercises`, so the roster has to land first; slots reference
  // templates, workouts reference templates, and sets reference all of them.
  //
  // The order is load-bearing, not cosmetic. Before #400 nearly every set was
  // loose — `workout_id` null — so sets could be written with no session in
  // staging and nothing complained. The import attached sets to sessions, and
  // the next sync failed outright on the foreign key. Adding a table here
  // means placing it after everything it points at.
  // `slug` is the primary key — a natural one that means the same thing in
  // both projects, so an upsert matches.
  { name: 'weight_room_exercises', conflict: 'slug' },
  // The template graph is `replace` for the reason the doc above describes and
  // this table demonstrates: both projects ran
  // `20260803120200_seed_workout_templates.sql` independently, so the same six
  // templates carry different `gen_random_uuid()` ids in each. Upserting on
  // `id` matched nothing and — because template names carry no unique
  // constraint — quietly *inserted a second copy of every one*, which is
  // exactly what the first run of this fix did to staging: 12 templates under 6
  // distinct names, and 80 slots against production's 40.
  //
  // Replace also carries production's ids across, which the children need:
  // `weight_room_sets.template_slot_id` and `.template_slot_step_id` reference
  // them. Deleting a template cascades to its slots, steps and alternates, so
  // the four have to stay in this order.
  { name: 'weight_room_workout_templates', mode: 'replace', key: 'id' },
  { name: 'weight_room_template_slots', mode: 'replace', key: 'id' },
  { name: 'weight_room_template_slot_steps', mode: 'replace', key: 'id' },
  { name: 'weight_room_template_alternates', mode: 'replace', key: 'id' },
  // After the templates, not before: `weight_room_workouts.template_id` is
  // `on delete set null`, so replacing templates while workouts already exist
  // would blank every session's template.
  //
  // `replace`, not an id upsert. Staging already held sessions with different
  // uuids than production's, so conflicting on `id` never matched and the
  // insert tripped the natural key instead — 23505 on `(source, started_at)`.
  // Conflicting on that natural key would resolve the collision but keep
  // *staging's* ids, and `weight_room_sets.workout_id` carries production's, so
  // every set would then fail its foreign key. Replace is the only mode that
  // gets production's ids across, which is what the child table needs.
  { name: 'weight_room_workouts', mode: 'replace', key: 'id' },
  { name: 'weight_room_goals', conflict: 'exercise' },
  // Same collision, on `(exercise, effective_from)`. Nothing references this
  // table, so replace costs nothing.
  { name: 'weight_room_goal_targets', mode: 'replace', key: 'id' },
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
  const res = await request('staging', 'read schema', `${STAGING_URL}/rest/v1/`, {
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
  const res = await request(
    'production',
    `read ${table} @${offset}`,
    `${PROD_URL}/rest/v1/${table}?select=*&limit=${READ_PAGE}&offset=${offset}`,
    { headers: { apikey: PROD_KEY, authorization: `Bearer ${PROD_KEY}` } }
  )
  if (!res.ok) throw new Error(`read ${table} @${offset}: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Upsert a batch into staging, overwriting rows that share the conflict key. */
async function writeBatch(table, conflict, rows) {
  const res = await request(
    'staging',
    `write ${table}`,
    `${STAGING_URL}/rest/v1/${table}?on_conflict=${conflict}`,
    {
      method: 'POST',
      headers: {
        apikey: STAGING_KEY,
        authorization: `Bearer ${STAGING_KEY}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    }
  )
  if (!res.ok) throw new Error(`write ${table}: ${res.status} ${await res.text()}`)
}

/** Plain insert, no conflict resolution — for `replace` tables, post-clear. */
async function insertBatch(table, rows) {
  const res = await request('staging', `insert ${table}`, `${STAGING_URL}/rest/v1/${table}`, {
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
  const res = await request(
    'staging',
    `clear ${table}`,
    `${STAGING_URL}/rest/v1/${table}?${key}=not.is.null`,
    {
      method: 'DELETE',
      headers: {
        apikey: STAGING_KEY,
        authorization: `Bearer ${STAGING_KEY}`,
        prefer: 'return=minimal',
      },
    }
  )
  if (!res.ok) throw new Error(`clear ${table}: ${res.status} ${await res.text()}`)
}

/** Drop keys staging doesn't have, so production running ahead can't 400 a table. */
function project(row, allowed) {
  const out = {}
  for (const k of allowed) if (k in row) out[k] = row[k]
  return out
}

async function copyTable({ name, conflict, mode, key }, allowed) {
  const dropped = new Set()
  const noteDropped = page => {
    for (const row of page) {
      for (const k of Object.keys(row)) if (!allowed.includes(k)) dropped.add(k)
    }
  }

  if (mode === 'replace') {
    // Read the whole replacement set BEFORE deleting anything (codex/CodeRabbit
    // #344). Clearing first meant a transient read failure left staging's
    // reference table empty until the next successful sync — and since these
    // tables drive the Trophy Room, empty renders as "no badges" in a preview
    // rather than as an error. Buffering is fine here and nowhere else: replace
    // is reserved for small reference tables (~93 rows), while the streaming
    // path below has to cope with 37k HR samples.
    const rows = []
    for (let offset = 0; ; offset += READ_PAGE) {
      const page = await readPage(name, offset)
      if (page.length === 0) break
      noteDropped(page)
      rows.push(...page.map(r => project(r, allowed)))
      if (page.length < READ_PAGE) break
    }
    await clearTable(name, key)
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      await insertBatch(name, rows.slice(i, i + WRITE_BATCH))
    }
    // Residual exposure is now one clear + one insert request for a table this
    // size. Closing it fully would need a transactional delete-and-insert RPC on
    // staging — deliberately not built: that's a migration on both projects to
    // protect a rebuildable staging table, and re-running the sync fixes it.
    return { copied: rows.length, dropped: [...dropped], mode }
  }

  let copied = 0
  for (let offset = 0; ; offset += READ_PAGE) {
    const page = await readPage(name, offset)
    if (page.length === 0) break
    noteDropped(page)
    const rows = page.map(r => project(r, allowed))
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      await writeBatch(name, conflict, rows.slice(i, i + WRITE_BATCH))
    }
    copied += page.length
    if (page.length < READ_PAGE) break
  }
  return { copied, dropped: [...dropped], mode: 'upsert' }
}

/**
 * Print a failure so it can't be missed: to stderr always, and as a GitHub
 * Actions error annotation when running in a workflow, so the reason shows on
 * the run's summary page instead of only deep in the step log.
 *
 * @param {string} message
 */
function reportFatal(message) {
  console.error(`✗ staging sync: ${message}`)
  if (process.env.GITHUB_ACTIONS === 'true') {
    // Workflow commands end at a newline, so flatten the message onto one line.
    console.log(`::error title=Staging sync failed::${message.replace(/[\r\n]+/g, ' ')}`)
  }
}

/**
 * Confirm production answers before streaming anything. Without it, an
 * unreachable production fails every table one by one with the same error.
 *
 * @throws {Error} when production cannot be read.
 */
async function checkProduction() {
  const url = `${PROD_URL}/rest/v1/${TABLES[0].name}?select=*&limit=1`
  const res = await request('production', 'preflight read', url, {
    headers: { apikey: PROD_KEY, authorization: `Bearer ${PROD_KEY}` },
  })
  if (!res.ok) {
    throw new Error(`production preflight read: ${res.status} ${await res.text()}`)
  }
}

/**
 * One cheap read against staging, nothing else.
 *
 * Supabase pauses a Free-plan project after seven days without enough database
 * activity, and a weekly sync is one day of activity a week — staging was paused
 * on 2026-08-23, exactly seven days after the last successful sync (#478). The
 * `staging-keepalive` workflow runs this daily so the project never looks idle.
 * It reads through PostgREST, so it counts as real database activity.
 *
 * @throws {Error} when staging cannot be read.
 */
async function keepalive() {
  const url = `${STAGING_URL}/rest/v1/${TABLES[0].name}?select=*&limit=1`
  const res = await request('staging', 'keepalive read', url, {
    headers: { apikey: STAGING_KEY, authorization: `Bearer ${STAGING_KEY}` },
  })
  if (!res.ok) {
    throw new Error(`staging keepalive read: ${res.status} ${await res.text()}`)
  }
  console.log(`✓ staging keepalive: ${new URL(STAGING_URL).host} answered`)
}

async function main() {
  if (process.argv.includes('--keepalive')) {
    if (!STAGING_URL || !STAGING_KEY) {
      reportFatal('missing STAGING_SUPABASE_URL or STAGING_SUPABASE_SECRET_KEY')
      process.exitCode = 2
      return
    }
    await keepalive()
    return
  }

  const missing = [
    ['PROD_SUPABASE_URL', PROD_URL],
    ['PROD_SUPABASE_ANON_KEY', PROD_KEY],
    ['STAGING_SUPABASE_URL', STAGING_URL],
    ['STAGING_SUPABASE_SECRET_KEY', STAGING_KEY],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    reportFatal(`missing ${missing.join(', ')}`)
    process.exitCode = 2
    return
  }

  // Refuse to run backwards. Overwriting production from staging would be
  // unrecoverable, and the two URLs are one copy-paste apart.
  if (PROD_URL === STAGING_URL) {
    reportFatal('PROD and STAGING point at the same project — refusing.')
    process.exitCode = 2
    return
  }

  // Both ends answer before any table is touched, so a dead host is one clear
  // line rather than a wall of per-table failures.
  await checkProduction()
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
      const note =
        dropped.length > 0 ? `  (dropped ahead-of-staging columns: ${dropped.join(', ')})` : ''
      const how = mode === 'replace' ? ' [replaced]' : ''
      console.log(`${copied === 0 ? '·' : '✓'} ${table.name}: ${copied}${how}${note}`)
    } catch (err) {
      console.error(`✗ ${table.name}: ${err.message}`)
      failed += 1
    }
  }

  console.log(
    `\n${failed === 0 ? '✓' : '!'} staging sync: ${total} rows across ${TABLES.length - failed}/${TABLES.length} tables.`
  )
  if (failed > 0) {
    reportFatal(`${failed} of ${TABLES.length} tables failed — see the ✗ lines above.`)
    process.exitCode = 1
  }
}

// Only when run as a script. Guarded so the table manifest can be imported and
// asserted on without kicking off a sync as a side effect of `import`.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    reportFatal(err instanceof Error ? err.message : String(err))
    process.exitCode = 2
  })
}
