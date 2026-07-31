/**
 * The one place the Training Facility turns a timestamp into a calendar day
 * (#319).
 *
 * **Everything buckets in Pacific.** Before this module there were three
 * parallel conventions: `pacificDayKey` (load-management), a server-local
 * `toDateKey` (weight-room-history), and a browser-local `toLocalDateKey`
 * (strength-today). The server-local one was a live bug — the History page is
 * a Server Component, so on Vercel "local" is UTC, and an evening Pacific
 * session straddles UTC midnight. Split across two UTC days, neither half
 * reaches the daily target, so the heatmap and streaks under-counted goal-hit
 * days while the Pacific-bucketed Load Management panel and Trophy Room on the
 * same page counted them correctly.
 *
 * A single home timezone is the right model here: the log is anchored to where
 * the training happens, not to where the reader happens to be. Logging while
 * travelling still lands on the Pacific day, which is what keeps a streak from
 * breaking because of a flight.
 *
 * **Keys are bare `YYYY-MM-DD` strings, and that's load-bearing.** PostgREST
 * renders a Postgres `date` in exactly that canonical zero-padded form, so
 * lexicographic string comparison *is* chronological comparison. Every window
 * test, sort, and boundary check in this directory relies on it — which is why
 * the arithmetic below stays on the calendar numbers rather than round-tripping
 * through a zoned `Date`.
 */

/** IANA zone every Training Facility day bucket is anchored to. */
export const PACIFIC_TZ = 'America/Los_Angeles'

/** Reused formatter — constructing an `Intl.DateTimeFormat` per call is expensive. */
const PACIFIC_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PACIFIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Matches a bare `YYYY-MM-DD` key. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * The `YYYY-MM-DD` **Pacific** calendar day a timestamp falls on. A set logged
 * at `2026-07-12T05:00:00Z` (10pm PT on the 11th) buckets to `2026-07-11`.
 *
 * Assembled from `formatToParts` rather than string-parsing the formatter's
 * output, so a locale or ICU quirk can't reorder the fields.
 *
 * @param d Any `Date`; callers usually pass `new Date(set.logged_at)`.
 */
export function pacificDayKey(d: Date): string {
  const parts = PACIFIC_DATE_FORMAT.formatToParts(d)
  let year = ''
  let month = ''
  let day = ''
  for (const part of parts) {
    if (part.type === 'year') year = part.value
    else if (part.type === 'month') month = part.value
    else if (part.type === 'day') day = part.value
  }
  return `${year}-${month}-${day}`
}

/**
 * {@link pacificDayKey} that tolerates bad input, returning `''` instead of
 * throwing or emitting `NaN-NaN-NaN`.
 *
 * Callers treat `''` as "skip this row" — it sorts before every real key and
 * matches no window, so a corrupt timestamp drops out of a rollup rather than
 * poisoning it.
 *
 * @param input ISO 8601 timestamp string, or a `Date` the caller already built.
 */
export function safePacificDayKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return Number.isFinite(d.getTime()) ? pacificDayKey(d) : ''
}

/** Whether `value` has the exact `YYYY-MM-DD` shape this module works in. */
export function isDayKey(value: string): boolean {
  return DAY_KEY_PATTERN.test(value)
}

/**
 * Shift a `YYYY-MM-DD` key by `delta` days.
 *
 * Arithmetic runs in UTC on the bare calendar numbers — no zone, no DST — so
 * the result is always a clean calendar date. Doing this with millisecond math
 * on a zoned `Date` lands on the wrong day twice a year, when a "day" is 23 or
 * 25 hours long.
 *
 * @param key `YYYY-MM-DD` to shift.
 * @param delta Days to add; negative goes back.
 */
export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * ISO weekday for a day key: 1 = Monday … 7 = Sunday.
 *
 * @param key `YYYY-MM-DD`.
 */
export function isoWeekdayOfDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

/**
 * The Monday of the ISO week containing `key`. Weeks run Mon–Sun to match the
 * heatmap's row layout and the stats panel's week rollups.
 *
 * @param key `YYYY-MM-DD` anywhere in the week.
 */
export function mondayOfDayKey(key: string): string {
  return shiftDayKey(key, -(isoWeekdayOfDayKey(key) - 1))
}

/**
 * Inclusive count of calendar days from `startKey` through `endKey`. `1` when
 * they're the same day; `0` when `endKey` precedes `startKey`.
 *
 * @param startKey `YYYY-MM-DD` first day.
 * @param endKey `YYYY-MM-DD` last day.
 */
export function inclusiveDaySpan(startKey: string, endKey: string): number {
  if (endKey < startKey) return 0
  const toUtcMs = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtcMs(endKey) - toUtcMs(startKey)) / 86_400_000) + 1
}

/** First day of the calendar month containing `key`. */
export function firstDayOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`
}

/** Last day of the calendar month containing `key`. */
export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  // Day 0 of the following month is the last day of this one.
  const dt = new Date(Date.UTC(y, m, 0))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Zero-based month index (0 = January) for a day key. */
export function monthIndexOfDayKey(key: string): number {
  return Number(key.slice(5, 7)) - 1
}

/**
 * A `Date` positioned at **noon Pacific** on `key`.
 *
 * Noon, not midnight, is the point: midnight in one zone is the previous or
 * next day in another, so a midnight-anchored `Date` renders as the wrong day
 * for any viewer east or west of the anchor. Noon has ~12 hours of slack in
 * both directions, which no real offset crosses.
 *
 * Used where an API wants a `Date` rather than a key — chart axis labels,
 * `toLocaleDateString`, and the `logged_at` stamp for a backdated set.
 *
 * @param key `YYYY-MM-DD`.
 * @returns The `Date`, or `null` when `key` isn't a valid calendar day.
 */
export function dayKeyToPacificNoon(key: string): Date | null {
  if (!isDayKey(key)) return null
  // Pacific is UTC-8 (PST) or UTC-7 (PDT); 19:00Z is noon in the first and
  // 12:00 PDT in the second. Either way it's the middle of the target day, so
  // one fixed offset works year-round without a DST lookup.
  const d = new Date(`${key}T19:00:00Z`)
  if (!Number.isFinite(d.getTime())) return null
  // Guard against calendar-invalid input the shape check can't catch, e.g.
  // `2026-02-31`, which `Date` would silently roll into March.
  return pacificDayKey(d) === key ? d : null
}

/**
 * ISO timestamp at noon Pacific on `key` — what a backdated set is stamped
 * with so it buckets onto the day the user picked.
 *
 * @param key `YYYY-MM-DD`.
 * @returns The ISO string, or `''` when `key` isn't a valid calendar day.
 */
export function dayKeyToPacificNoonIso(key: string): string {
  return dayKeyToPacificNoon(key)?.toISOString() ?? ''
}

/** Today's Pacific day key. @param now Clock override; defaults to `new Date()`. */
export function todayDayKey(now: Date = new Date()): string {
  return pacificDayKey(now)
}
