/**
 * The one place the Training Facility turns a timestamp into a calendar day
 * (#319) — now a Pacific-bound view of the zone-agnostic {@link DayClock}
 * (#429).
 *
 * **Everything here buckets in Pacific.** Before #319 there were three parallel
 * conventions: `pacificDayKey` (load-management), a server-local `toDateKey`
 * (weight-room-history), and a browser-local `toLocalDateKey` (strength-today).
 * The server-local one was a live bug — the History page is a Server Component,
 * so on Vercel "local" is UTC, and an evening Pacific session straddles UTC
 * midnight. Split across two UTC days, neither half reaches the daily target, so
 * the heatmap and streaks under-counted goal-hit days while the Pacific-bucketed
 * Load Management panel and Trophy Room on the same page counted them correctly.
 *
 * A single home timezone is the right model *for this log*: it's anchored to
 * where the training happens, not to where the reader happens to be, so logging
 * while travelling still lands on the Pacific day and a flight can't break a
 * streak.
 *
 * It is the wrong model for anyone else, which is why the mechanism moved to
 * `clock.ts` and only the *binding* lives here. Every export below is
 * `PACIFIC_CLOCK` applied — kept so the ~30 call sites across the data layer,
 * the admin routes, and the components read exactly as they always have.
 *
 * **New code inside the domain layer should take a `DayClock` instead.** These
 * wrappers exist for the surfaces that are legitimately Pacific-only.
 */

import { PACIFIC_CLOCK } from './clock'

export {
  PACIFIC_TZ,
  isDayKey,
  shiftDayKey,
  isoWeekdayOfDayKey,
  mondayOfDayKey,
  inclusiveDaySpan,
  firstDayOfMonth,
  lastDayOfMonth,
  monthIndexOfDayKey,
  wallClockMs,
  fromWallClockMs,
  type DayClock,
} from './clock'

/**
 * The `YYYY-MM-DD` **Pacific** calendar day a timestamp falls on. A set logged
 * at `2026-07-12T05:00:00Z` (10pm PT on the 11th) buckets to `2026-07-11`.
 *
 * @param d Any `Date`; callers usually pass `new Date(set.logged_at)`.
 */
export function pacificDayKey(d: Date): string {
  return PACIFIC_CLOCK.dayKey(d)
}

/**
 * A `Date` whose local getters read the Pacific wall clock at `instant`, whatever
 * zone this code runs in. See {@link DayClock.wallClock} for what the result can
 * and can't be used for.
 *
 * For code built on those getters that renders on both a UTC server and a
 * viewer's browser: without this, the two can disagree about which day a session
 * fell on, or which day today is.
 *
 * @param instant Any `Date`. An invalid one is returned as an invalid `Date`.
 */
export function pacificWallClock(instant: Date): Date {
  return PACIFIC_CLOCK.wallClock(instant)
}

/** Matches a timestamp ending in `Z` or an offset like `-07:00`. */
const HAS_UTC_OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i

/**
 * Parse a session-date string into a wall-clock `Date` whose local getters read its
 * calendar day, the same on a UTC server and in any viewer's browser.
 *
 * Bare `YYYY-MM-DD` strings (the dominant format in `cardio.json` for non-walking
 * sessions) are treated as local midnight so range comparisons match the
 * `DateFilter`'s local-day bounds. A timestamp with no offset already states its
 * wall clock, so local parsing keeps it. One with an offset goes through
 * {@link pacificWallClock}, so a session keeps the Pacific day it happened on.
 *
 * Every layer (filters, chart projections, table row formatters) reads session dates
 * through this. To measure elapsed time against real timestamps such as heart-rate
 * samples, use `new Date(raw)` instead.
 *
 * @param raw Original `date` field from a `CardioSession` or a trend point.
 */
export function parseSessionDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`)
  if (!HAS_UTC_OFFSET.test(raw)) return new Date(raw)
  return pacificWallClock(new Date(raw))
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
  return PACIFIC_CLOCK.safeDayKey(input)
}

/**
 * A `Date` positioned at **noon Pacific** on `key`.
 *
 * Used where an API wants a `Date` rather than a key — chart axis labels,
 * `toLocaleDateString`, and the `logged_at` stamp for a backdated set.
 *
 * @param key `YYYY-MM-DD`.
 * @returns The `Date`, or `null` when `key` isn't a valid calendar day.
 */
export function dayKeyToPacificNoon(key: string): Date | null {
  return PACIFIC_CLOCK.toNoon(key)
}

/**
 * ISO timestamp at noon Pacific on `key` — what a backdated set is stamped
 * with so it buckets onto the day the user picked.
 *
 * @param key `YYYY-MM-DD`.
 * @returns The ISO string, or `''` when `key` isn't a valid calendar day.
 */
export function dayKeyToPacificNoonIso(key: string): string {
  return PACIFIC_CLOCK.toNoonIso(key)
}

/** Today's Pacific day key. @param now Clock override; defaults to `new Date()`. */
export function todayDayKey(now: Date = new Date()): string {
  return PACIFIC_CLOCK.today(now)
}

/**
 * Human-format a day key, rendering the **Pacific** calendar day.
 *
 * @param key `YYYY-MM-DD`.
 * @param options `Intl.DateTimeFormat` options — e.g.
 *   `{ weekday: 'short', month: 'short', day: 'numeric' }`. A caller-supplied
 *   `timeZone` is ignored; that's the whole point.
 * @param locale BCP-47 tag, or `undefined` for the viewer's.
 * @returns The formatted label, or `''` when `key` isn't a valid calendar day.
 */
export function formatDayKey(
  key: string,
  options: Intl.DateTimeFormatOptions,
  locale?: string
): string {
  return PACIFIC_CLOCK.format(key, options, locale)
}
