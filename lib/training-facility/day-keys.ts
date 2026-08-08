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
