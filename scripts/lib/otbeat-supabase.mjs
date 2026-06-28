/**
 * Supabase write helpers for the OTbeat ingestion (#251).
 *
 * Reuses the service-role client + env loader from `cardio-supabase.mjs`
 * (one place for the credential plumbing), and adds the OTbeat-specific
 * bits: turning a parsed {@link import('./otbeat-parser.mjs').OtbeatRecord}
 * into an `otf_sessions` row, and an **append-only** upsert.
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
 * @param {import('./otbeat-parser.mjs').OtbeatRecord} rec Parsed session.
 * @param {string} [timeZone] Studio timezone for `started_at`.
 * @returns {Record<string, unknown>} Row payload for `otf_sessions`.
 */
export function recordToRow(rec, timeZone = DEFAULT_STUDIO_TZ) {
  const z = rec.zones_min ?? null
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
  }
}

/**
 * Append-only upsert of parsed OTbeat sessions into `otf_sessions`.
 *
 * Reads the existing `started_at` keys, inserts only rows whose timestamp
 * isn't already present, and never deletes. Re-running over an overlapping
 * lookback window is therefore idempotent (adds 0 the second time) and can
 * never prune history — the opposite of the cardio mirror-and-prune import.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {import('./otbeat-parser.mjs').OtbeatRecord[]} records Parsed sessions.
 * @param {{ timeZone?: string }} [opts] Studio timezone override.
 * @returns {Promise<{ added: number, skipped: number, total: number }>}
 *   `added` = newly inserted, `skipped` = already present, `total` = rows now
 *   in the table.
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

  const { data: existingRows, error: readErr } = await supabase
    .from('otf_sessions')
    .select('started_at')
  if (readErr) {
    throw new Error(`Failed to read existing otf_sessions: ${readErr.message}`)
  }
  const existing = new Set((existingRows ?? []).map(r => new Date(r.started_at).getTime()))

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

  return {
    added: toInsert.length,
    skipped: byKey.size - toInsert.length,
    total: existing.size + toInsert.length,
  }
}
