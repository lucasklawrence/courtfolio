/**
 * Supabase write helpers for the OTbeat ingestion (#251).
 *
 * Reuses the service-role client + env loader from `cardio-supabase.mjs`
 * (one place for the credential plumbing), and adds the OTbeat-specific
 * bits: turning a parsed {@link import('./otbeat-parser.mjs').OtbeatRecord}
 * into an `otf_sessions` row, an **append-only** upsert, and the data-quality
 * invariant check that guards it ({@link findUntypedOtfSessions}).
 *
 * Why a separate upsert from the cardio one: `upsertCardioData` mirrors the
 * full Apple-Health archive and prunes rows missing from the export. OTbeat
 * is an incremental weekly email pull — re-running over an overlapping
 * lookback window must add only genuinely-new sessions and NEVER delete
 * history. So this path inserts-if-absent (dedupe by `started_at`) with no
 * prune step.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 */

import { classifyOtfAnomaly } from './otbeat-anomaly.mjs'
import { classifyOtfClassType } from './otbeat-class-type.mjs'
import { mmssToSec } from './otbeat-parser.mjs'
import { createServiceRoleClient, loadEnv } from './cardio-supabase.mjs'

export { createServiceRoleClient, loadEnv }

/** Default IANA timezone for the studio (Marina Del Rey → US Pacific). */
export const DEFAULT_STUDIO_TZ = 'America/Los_Angeles'

/**
 * Minutes `timeZone` is ahead of UTC at a given instant. Uses `Intl` so DST
 * is handled without a timezone database dependency.
 *
 * @param {string} timeZone IANA zone, e.g. 'America/Los_Angeles'.
 * @param {Date} instant The moment to evaluate the offset at.
 * @returns {number} Offset in minutes (negative for zones behind UTC).
 */
function zoneOffsetMinutes(timeZone, instant) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(dtf.formatToParts(instant).map(p => [p.type, p.value]))
  const hour = Number(parts.hour) % 24 // some envs render midnight as '24'
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  )
  return (asUTC - instant.getTime()) / 60000
}

/**
 * Convert a wall-clock time *in a given timezone* to a UTC ISO instant.
 * Two-pass so a wall time that lands on a DST boundary resolves correctly.
 *
 * @param {number} year Full year, e.g. 2026.
 * @param {number} month 1-based month (1 = January).
 * @param {number} day Day of month.
 * @param {number} hour 24-hour hour.
 * @param {number} minute Minute.
 * @param {string} timeZone IANA zone the wall time is expressed in.
 * @returns {string} UTC ISO 8601 string (e.g. '2026-06-27T16:30:00.000Z').
 */
export function wallTimeToISO(year, month, day, hour, minute, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute)
  const off = zoneOffsetMinutes(timeZone, new Date(utcGuess))
  let instant = utcGuess - off * 60000
  const off2 = zoneOffsetMinutes(timeZone, new Date(instant))
  if (off2 !== off) instant = utcGuess - off2 * 60000
  return new Date(instant).toISOString()
}

/**
 * Combine an OTbeat record's `date` ("MM/DD/YYYY") and `time` ("9:30AM")
 * into a `started_at` UTC ISO string, interpreting them in `timeZone`.
 *
 * @param {string} date "MM/DD/YYYY".
 * @param {string} time "9:30AM" / "10:45AM" (12-hour, AM/PM, no space).
 * @param {string} timeZone IANA zone the studio is in.
 * @returns {string} UTC ISO 8601 timestamp.
 * @throws {Error} when `date` or `time` can't be parsed.
 */
export function toStartedAt(date, time, timeZone) {
  const d = date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const t = time?.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (!d) throw new Error(`Unparseable OTbeat date: ${JSON.stringify(date)}`)
  if (!t) throw new Error(`Unparseable OTbeat time: ${JSON.stringify(time)}`)
  const [, mm, dd, yyyy] = d
  let hour = Number(t[1]) % 12
  if (t[3].toUpperCase() === 'PM') hour += 12
  return wallTimeToISO(Number(yyyy), Number(mm), Number(dd), hour, Number(t[2]), timeZone)
}

/**
 * Map a parsed {@link import('./otbeat-parser.mjs').OtbeatRecord} to an
 * `otf_sessions` row. Zone minutes become the explicit `zone_*_min` columns;
 * the treadmill and rower blocks pass straight through as JSONB (`null` when
 * the class format omitted them). `updated_at` is left to the column default.
 *
 * `excluded` / `excluded_reason` are set from {@link classifyOtfAnomaly} so a
 * malfunction session (near-zero output, no machine block — #268) is flagged
 * at first insert. `class_type` is the coarse machine-signature label from
 * {@link classifyOtfClassType} (#271); `class_type_override` is left unset so a
 * manual Supabase edit owns it.
 *
 * `excluded` / `excluded_reason` are written only on a row's *first* insert,
 * since {@link upsertOtfSessions} inserts-if-absent. `class_type` is the one
 * exception: that same append-only property left three rows permanently null
 * when an old importer raced the #271 backfill, so the upsert also backfills a
 * *null* `class_type` on an existing row. A non-null label — and
 * `class_type_override` in every case — is never touched by a re-pull.
 *
 * @param {import('./otbeat-parser.mjs').OtbeatRecord} rec Parsed session.
 * @param {string} [timeZone] Studio timezone for `started_at`.
 * @returns {Record<string, unknown>} Row payload for `otf_sessions`.
 */
export function recordToRow(rec, timeZone = DEFAULT_STUDIO_TZ) {
  const z = rec.zones_min ?? null
  const hasTreadmill = rec.treadmill != null
  const hasRower = rec.rower != null
  const anomaly = classifyOtfAnomaly({
    calories: rec.calories,
    splat: rec.splat,
    hasTreadmill,
    hasRower,
  })
  const classType = classifyOtfClassType({
    hasTreadmill,
    hasRower,
    treadSec: mmssToSec(rec.treadmill?.time),
    rowerSec: mmssToSec(rec.rower?.time),
    calories: rec.calories,
  })
  return {
    started_at: toStartedAt(rec.date, rec.time, timeZone),
    coach: rec.coach ?? null,
    studio: rec.studio ?? null,
    calories: rec.calories ?? null,
    splat: rec.splat ?? null,
    steps: rec.steps ?? null,
    avg_hr: rec.avg_hr ?? null,
    peak_hr: rec.peak_hr ?? null,
    zone_gray_min: z?.gray ?? null,
    zone_blue_min: z?.blue ?? null,
    zone_green_min: z?.green ?? null,
    zone_orange_min: z?.orange ?? null,
    zone_red_min: z?.red ?? null,
    treadmill: rec.treadmill ?? null,
    rower: rec.rower ?? null,
    excluded: anomaly.excluded,
    excluded_reason: anomaly.reason,
    class_type: classType,
  }
}

/**
 * Rows per page when reading the existing session keys. Below Supabase's
 * default `max_rows` of 1000 so a page is never server-truncated.
 */
const READ_PAGE_SIZE = 500

/**
 * Read `started_at` + `class_type` for **every** row in `otf_sessions`, paging
 * until a short page ends it.
 *
 * Pagination is not optional: PostgREST caps an unbounded `select` at
 * `max_rows` (1000 on Supabase by default) and returns the first page with no
 * error, so a single unranged read would silently look like the whole table.
 * Past that cap the omitted rows would read as absent — re-offered to the
 * insert (harmless, `ON CONFLICT DO NOTHING` absorbs it) but invisible to the
 * `class_type` backfill and miscounted in `total`, which is exactly the kind of
 * quiet drift this module now exists to prevent.
 *
 * Ordered by `started_at` so pages don't overlap or skip — without an explicit
 * order PostgREST may use an unstable internal sort across requests. The stored
 * `started_at` string is returned verbatim: it's the filter value for the repair
 * update, so it has to match the row exactly.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @returns {Promise<Array<{ started_at: string, class_type: string | null }>>}
 *   Every row, oldest first.
 * @throws {Error} on any Supabase read failure.
 */
async function readAllOtfSessionKeys(supabase) {
  const all = []
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('otf_sessions')
      .select('started_at, class_type')
      .order('started_at', { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1)
    if (error) {
      throw new Error(`Failed to read existing otf_sessions: ${error.message}`)
    }
    const page = data ?? []
    all.push(...page)
    if (page.length < READ_PAGE_SIZE) return all
  }
}

/**
 * Append-only upsert of parsed OTbeat sessions into `otf_sessions`, plus a
 * null-only backfill of `class_type` on rows that are already present.
 *
 * Reads the existing `started_at` keys, inserts only rows whose timestamp
 * isn't already present, and never deletes. Re-running over an overlapping
 * lookback window is therefore idempotent (adds 0 the second time) and can
 * never prune history — the opposite of the cardio mirror-and-prune import.
 *
 * **The backfill pass** exists because append-only insertion alone cannot
 * self-heal. `class_type` was previously written only on a row's first insert,
 * so three classes ingested on 2026-07-04 by a pre-#271 importer — hours after
 * the #271 migration had already backfilled — kept `class_type = null`
 * indefinitely; no number of re-pulls could fix them, and a null class type is
 * invisible to every filter chip. So after inserting, any *existing* row whose
 * stored `class_type` is null gets the freshly-classified value written back.
 *
 * Deliberately narrow, to preserve the guarantee #268/#271 rely on:
 * - Only `class_type`, and only when the stored value is null — a row that
 *   already has a label is never rewritten, so a corrected label survives.
 * - Never `class_type_override`, `excluded`, or `excluded_reason`. A targeted
 *   per-row `update` of the single column, *not* a full-row upsert: supabase-js
 *   `upsert` with `ignoreDuplicates: false` would `DO UPDATE SET` every column
 *   and clobber a manual override.
 * - Only when the classifier yields a non-null label, so the 2026-05-30
 *   belt-malfunction row (no machine block → null, correctly `excluded`) is
 *   left exactly as it is.
 *
 * Only reaches sessions still inside the caller's email lookback window. For an
 * older orphan, {@link findUntypedOtfSessions} is the backstop that surfaces it.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {import('./otbeat-parser.mjs').OtbeatRecord[]} records Parsed sessions.
 * @param {{ timeZone?: string }} [opts] Studio timezone override.
 * @returns {Promise<{ added: number, skipped: number, repaired: number, total: number }>}
 *   `added` = newly inserted, `skipped` = already present, `repaired` = existing
 *   rows whose null `class_type` was backfilled, `total` = rows now in the table.
 * @throws {Error} on any Supabase read/write failure.
 */
export async function upsertOtfSessions(supabase, records, opts = {}) {
  const timeZone = opts.timeZone ?? DEFAULT_STUDIO_TZ
  const rows = records.map(r => recordToRow(r, timeZone))

  // Dedupe within this batch first (a single pull shouldn't carry two copies
  // of the same class), keeping the first occurrence.
  const byKey = new Map()
  for (const row of rows) {
    const key = new Date(row.started_at).getTime()
    if (!byKey.has(key)) byKey.set(key, row)
  }

  const existingRows = await readAllOtfSessionKeys(supabase)
  const existing = new Map(existingRows.map(r => [new Date(r.started_at).getTime(), r]))

  const toInsert = [...byKey.entries()].filter(([key]) => !existing.has(key)).map(([, row]) => row)

  if (toInsert.length > 0) {
    // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING: belt-and-suspenders
    // against a concurrent run, and leaves any existing row's updated_at alone.
    const { error: writeErr } = await supabase
      .from('otf_sessions')
      .upsert(toInsert, { onConflict: 'started_at', ignoreDuplicates: true })
    if (writeErr) {
      throw new Error(`Failed to insert otf_sessions: ${writeErr.message}`)
    }
  }

  // Backfill class_type on already-present rows that lack one (see above).
  let repaired = 0
  for (const [key, row] of byKey) {
    const stored = existing.get(key)
    if (!stored || stored.class_type != null || row.class_type == null) continue
    const { error: repairErr } = await supabase
      .from('otf_sessions')
      .update({ class_type: row.class_type })
      .eq('started_at', stored.started_at)
    if (repairErr) {
      throw new Error(
        `Failed to backfill class_type for otf_session ${stored.started_at}: ${repairErr.message}`
      )
    }
    repaired += 1
  }

  return {
    added: toInsert.length,
    skipped: byKey.size - toInsert.length,
    repaired,
    total: existing.size + toInsert.length,
  }
}

/**
 * Find counted sessions that carry no `class_type` — the data-quality invariant
 * the OTF view depends on.
 *
 * Every non-`excluded` row must have a class type, because a null one matches no
 * filter chip: before the `Unclassified` sentinel existed, selecting any type
 * silently dropped such rows from the session log *and* every aggregate, with
 * nothing in the UI counts to say so. That drift went unnoticed for 20 days.
 * Call this after a pull and fail the run on a non-empty result, so the next gap
 * surfaces the same day instead of being spotted by eye in a chart.
 *
 * Excluded rows are exempt: a belt malfunction legitimately has no machine block
 * and so no inferable type.
 *
 * Unpaginated, unlike {@link readAllOtfSessionKeys}: the filter is narrow enough
 * that a healthy table returns zero rows, and PostgREST's `max_rows` cap can
 * only ever shorten a *non-empty* result — it can't turn offenders into an empty
 * one, so the pass/fail signal is never wrong, only the printed list.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @returns {Promise<Array<{ started_at: string, coach: string | null, calories: number | null }>>}
 *   The offending rows, oldest first; empty when the invariant holds.
 * @throws {Error} on any Supabase read failure.
 */
export async function findUntypedOtfSessions(supabase) {
  const { data, error } = await supabase
    .from('otf_sessions')
    .select('started_at, coach, calories')
    .eq('excluded', false)
    .is('class_type', null)
    .order('started_at', { ascending: true })
  if (error) {
    throw new Error(`Failed to check otf_sessions class_type coverage: ${error.message}`)
  }
  return data ?? []
}
