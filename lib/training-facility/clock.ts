/**
 * Turning a timestamp into a calendar day, anchored to a timezone the caller
 * chooses (#429).
 *
 * This is `day-keys.ts` with its one hardcoded assumption pulled out. That
 * module bucketed everything in `America/Los_Angeles`, which is right for a
 * personal log — the training happens where it happens, so logging on a trip
 * still lands on the home day and a flight can't break a streak — and wrong the
 * moment two people in different zones share the code.
 *
 * The zone lives in a {@link DayClock} value that callers pass explicitly.
 * {@link PACIFIC_CLOCK} is the default everywhere in this repo, so nothing here
 * reads differently than it did; a consumer serving other people's clients
 * builds one clock per client instead.
 *
 * **Why a value and not a module-level setting.** A `configureTimeZone()` setter
 * would be far less code and is disqualified outright: a server rendering one
 * client in Denver and another in Boston within the same tick would race on it,
 * and the symptom would be days silently attributed to the wrong person's
 * calendar. Threading a parameter is tedious exactly once.
 *
 * **Keys stay bare `YYYY-MM-DD` strings, and that's load-bearing.** PostgREST
 * renders a Postgres `date` in exactly that canonical zero-padded form, so
 * lexicographic string comparison *is* chronological comparison. Every window
 * test, sort, and boundary check downstream relies on it — which is why the
 * arithmetic below stays on the calendar numbers rather than round-tripping
 * through a zoned `Date`.
 */

/** IANA zone this repo's own day buckets are anchored to. */
export const PACIFIC_TZ = 'America/Los_Angeles'

/** Matches a bare `YYYY-MM-DD` key. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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
 * 25 hours long. Zone-free, so it needs no clock.
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
 * ISO weekday for a day key: 1 = Monday … 7 = Sunday. Zone-free.
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
 * heatmap's row layout and the stats panel's week rollups. Zone-free.
 *
 * @param key `YYYY-MM-DD` anywhere in the week.
 */
export function mondayOfDayKey(key: string): string {
  return shiftDayKey(key, -(isoWeekdayOfDayKey(key) - 1))
}

/**
 * Inclusive count of calendar days from `startKey` through `endKey`. `1` when
 * they're the same day; `0` when `endKey` precedes `startKey`. Zone-free.
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

/** First day of the calendar month containing `key`. Zone-free. */
export function firstDayOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`
}

/** Last day of the calendar month containing `key`. Zone-free. */
export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  // Day 0 of the following month is the last day of this one.
  const dt = new Date(Date.UTC(y, m, 0))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Zero-based month index (0 = January) for a day key. Zone-free. */
export function monthIndexOfDayKey(key: string): number {
  return Number(key.slice(5, 7)) - 1
}

/**
 * A timezone, bound to the handful of operations that actually need one.
 *
 * Built by {@link createDayClock}, which memoizes the two `Intl.DateTimeFormat`
 * instances involved — constructing those per call is expensive enough to show
 * up when bucketing thousands of sets.
 */
export interface DayClock {
  /** IANA zone this clock is anchored to. */
  readonly timeZone: string
  /**
   * The `YYYY-MM-DD` calendar day an instant falls on, in this clock's zone.
   *
   * @param d Any `Date`; callers usually pass `new Date(set.logged_at)`.
   */
  dayKey(d: Date): string
  /**
   * {@link dayKey} that tolerates bad input, returning `''` rather than
   * throwing or emitting `NaN-NaN-NaN`.
   *
   * Callers treat `''` as "skip this row" — it sorts before every real key and
   * matches no window, so a corrupt timestamp drops out of a rollup instead of
   * poisoning it.
   *
   * @param input ISO 8601 string, or a `Date` the caller already built.
   */
  safeDayKey(input: string | Date): string
  /**
   * Today's key in this clock's zone.
   *
   * @param now Clock override; defaults to `new Date()`.
   */
  today(now?: Date): string
  /**
   * A `Date` positioned at **noon** on `key` in this clock's zone.
   *
   * Noon, not midnight, is the point: midnight in one zone is the previous or
   * next day in another, so a midnight-anchored `Date` renders as the wrong day
   * for any viewer east or west of the anchor. Noon has ~12 hours of slack in
   * both directions, which no real offset crosses.
   *
   * @param key `YYYY-MM-DD`.
   * @returns The `Date`, or `null` when `key` isn't a valid calendar day.
   */
  toNoon(key: string): Date | null
  /**
   * ISO timestamp at noon on `key` — what a backdated set is stamped with so it
   * buckets onto the day the user picked.
   *
   * @param key `YYYY-MM-DD`.
   * @returns The ISO string, or `''` when `key` isn't a valid calendar day.
   */
  toNoonIso(key: string): string
  /**
   * Human-format a day key, rendering the calendar day in this clock's zone.
   *
   * Use this rather than `toNoon(key).toLocaleDateString(...)`. That instant is
   * mid-day *here*, which can already be the next day for a viewer far enough
   * east — so in Tokyo a `2026-07-11` Pacific key would render as "Jul 12",
   * contradicting the key it came from. Pinning `timeZone` makes the label agree
   * with the key everywhere.
   *
   * The locale is left to the viewer unless a caller pins one; only the *zone*
   * has to be fixed, because only the zone can change which day is named.
   *
   * @param key `YYYY-MM-DD`.
   * @param options `Intl.DateTimeFormat` options. A caller-supplied `timeZone`
   *   is ignored; that's the whole point.
   * @param locale BCP-47 tag, or `undefined` for the viewer's.
   * @returns The formatted label, or `''` when `key` isn't a valid calendar day.
   */
  format(key: string, options: Intl.DateTimeFormatOptions, locale?: string): string
}

/**
 * Build a {@link DayClock} for an IANA timezone.
 *
 * @param timeZone e.g. `America/Los_Angeles`, `America/Denver`. Invalid zones
 *   throw from `Intl.DateTimeFormat`, which is the right moment to find out.
 */
export function createDayClock(timeZone: string): DayClock {
  // Two memoized formatters. `en-CA` yields ISO-ordered date parts; the offset
  // formatter needs a full wall clock in `h23` so midnight reads `00`, not `24`.
  const dateFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const wallClockFormat = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  /** Assembled from `formatToParts` so a locale or ICU quirk can't reorder the fields. */
  function dayKey(d: Date): string {
    const parts = dateFormat.formatToParts(d)
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

  /** This zone's offset from UTC at `instant`, in milliseconds (east is positive). */
  function offsetMsAt(instant: Date): number {
    const parts = wallClockFormat.formatToParts(instant)
    const field = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find(p => p.type === type)?.value ?? '0')
    const asIfUtc = Date.UTC(
      field('year'),
      field('month') - 1,
      field('day'),
      field('hour'),
      field('minute'),
      field('second')
    )
    return asIfUtc - instant.getTime()
  }

  function toNoon(key: string): Date | null {
    if (!isDayKey(key)) return null
    // The wall clock we want, read as though it were UTC. Subtracting this
    // zone's offset at that moment converts it to a real instant.
    const wanted = Date.parse(`${key}T12:00:00Z`)
    if (!Number.isFinite(wanted)) return null
    // Two passes: the first uses the offset at the wrong instant, the second
    // corrects it. Converges immediately in practice — noon sits 12 hours from
    // either midnight, and no DST shift is anywhere near that large.
    let instant = new Date(wanted - offsetMsAt(new Date(wanted)))
    instant = new Date(wanted - offsetMsAt(instant))
    if (!Number.isFinite(instant.getTime())) return null
    // Guard against calendar-invalid input the shape check can't catch, e.g.
    // `2026-02-31`, which `Date` would silently roll into March.
    return dayKey(instant) === key ? instant : null
  }

  return {
    timeZone,
    dayKey,
    safeDayKey(input: string | Date): string {
      const d = typeof input === 'string' ? new Date(input) : input
      return Number.isFinite(d.getTime()) ? dayKey(d) : ''
    },
    today(now: Date = new Date()): string {
      return dayKey(now)
    },
    toNoon,
    toNoonIso(key: string): string {
      return toNoon(key)?.toISOString() ?? ''
    },
    format(key: string, options: Intl.DateTimeFormatOptions, locale?: string): string {
      const d = toNoon(key)
      if (d === null) return ''
      return d.toLocaleDateString(locale, { ...options, timeZone })
    },
  }
}

/**
 * The clock every Training Facility surface in this repo uses.
 *
 * The default argument on each zone-consuming function, so courtfolio call
 * sites read exactly as they did before the parameter existed.
 */
export const PACIFIC_CLOCK = createDayClock(PACIFIC_TZ)
