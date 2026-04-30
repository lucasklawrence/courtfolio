/**
 * Period-comparison helpers for date-range-driven Training Facility surfaces (issue #77).
 *
 * Lets a Gym detail view (Stair, Treadmill, Track) compute a "previous
 * period of equal length, ending where the current range starts" and
 * project a delta between scalar metric values across the two periods.
 *
 * Range derivation lives here (date math); metric computation lives at
 * each call site (the metrics differ per detail view). The component
 * `<CardioStatsCards>` consumes the output to render side-by-side stat
 * cards with delta arrows.
 */

import {
  endOfDay,
  startOfDay,
  type DateRange,
} from '@/components/training-facility/shared/DateFilter'

/**
 * Minimum sessions in the previous period required before a delta is
 * shown. Below this, the card renders the current value but suppresses
 * the delta line — small samples produce misleading swings.
 *
 * Set to `4` to match the issue spec ("only show deltas when the
 * previous period has >3 sessions").
 */
export const MIN_PREVIOUS_SESSIONS_FOR_DELTA = 4

/**
 * Direction of change between current and previous scalar values.
 *
 * - `up` — current is strictly greater than previous
 * - `down` — current is strictly less than previous
 * - `same` — current equals previous (or both are zero)
 */
export type DeltaDirection = 'up' | 'down' | 'same'

/** Result of comparing current and previous scalar values for one metric. */
export interface PeriodDelta {
  /** Signed absolute change (`current - previous`). */
  absolute: number
  /**
   * Percentage change relative to the previous value, e.g. `+25` for a
   * 25 % increase. `null` when the previous value is `0` (the percentage
   * is undefined — division by zero is a meaningless infinity). Callers
   * should fall back to {@link PeriodDelta.absolute} for display in
   * that case.
   */
  percent: number | null
  /** Direction of change. See {@link DeltaDirection}. */
  direction: DeltaDirection
}

/**
 * Number of milliseconds in a day. Used only inside
 * {@link calendarDayCount}, where the operands have already been
 * snapped to UTC midnight so the divisor is exact.
 */
const MS_PER_DAY = 86_400_000

/**
 * Calendar-day count of `range` (inclusive on both ends).
 *
 * Counts via UTC midnights of each bound's local date so DST
 * transitions don't drift the result by ±1. A direct subtraction of
 * the local timestamps would yield 30 days, 22 h 59 m 59.999 s for a
 * spring-forward window (off by an hour) and 30 days, 0 h 59 m 59.999 s
 * for a fall-back window — both round to the wrong day count.
 *
 * @internal Intentionally private — call sites that need calendar-day
 *   arithmetic should call {@link computePreviousRange}, which embeds
 *   this helper.
 */
function calendarDayCount(range: DateRange): number {
  const startUtcMid = Date.UTC(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate(),
  )
  const endUtcMid = Date.UTC(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate(),
  )
  return Math.round((endUtcMid - startUtcMid) / MS_PER_DAY) + 1
}

/**
 * Compute a previous period of equal calendar-day count to `range`,
 * ending the day before `range.start`. The returned range's bounds are
 * day-normalized (start- and end-of-day) so downstream session filters
 * that compare against day-aligned bounds behave the same way as for
 * the current range.
 *
 * Equal length means **same number of calendar days**, not equal
 * milliseconds — DST fall-back/spring-forward transitions add or
 * remove an hour from the ms duration, but the user-facing intent is
 * "comparable windows". For a current `Mar 1 → Mar 31` (31 days) the
 * previous range is `Jan 29 → Feb 28` (also 31 days), not Feb 1 → Feb
 * 28 (28 days). Likewise for `Nov 1 → Nov 30` (30 days, fall-back
 * window) the previous range is `Oct 2 → Oct 31` (also 30 days), not
 * Oct 1 → Oct 31 (31 days).
 *
 * @param range - The current `DateRange`. The previous range spans
 *   the same number of calendar days, ending the day before
 *   `range.start`.
 */
export function computePreviousRange(range: DateRange): DateRange {
  // Use local-date setDate arithmetic so day subtraction is immune to
  // DST drift (ms-subtraction would over- or under-count by 1 day
  // when the current range straddles a transition).
  const previousEndAnchor = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate() - 1,
  )
  const dayCount = calendarDayCount(range)
  const previousStartAnchor = new Date(
    previousEndAnchor.getFullYear(),
    previousEndAnchor.getMonth(),
    previousEndAnchor.getDate() - (dayCount - 1),
  )
  return {
    start: startOfDay(previousStartAnchor),
    end: endOfDay(previousEndAnchor),
  }
}

/**
 * Compute a {@link PeriodDelta} between two scalar values.
 *
 * Both inputs may be `null` when the underlying metric is not
 * computable for the period (e.g. an avg-HR metric when the period has
 * no sessions with `avg_hr`). When either side is `null` this function
 * returns `null` — the caller should hide the delta line entirely.
 * When `previous` is `0`, `percent` is `null` (undefined ratio) but the
 * absolute delta and direction are still reported.
 *
 * @param current - Metric value for the current period.
 * @param previous - Metric value for the previous period.
 */
export function computeDelta(
  current: number | null,
  previous: number | null,
): PeriodDelta | null {
  if (current === null || previous === null) return null
  const absolute = current - previous
  const direction: DeltaDirection = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'same'
  const percent = previous === 0 ? null : (absolute / previous) * 100
  return { absolute, percent, direction }
}
