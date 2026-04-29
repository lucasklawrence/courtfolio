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
 * Compute a previous period of equal length to `range`, ending one
 * millisecond before `range.start`. The returned range's bounds are
 * day-normalized (start- and end-of-day) so downstream session filters
 * that compare against day-aligned bounds behave the same way as for
 * the current range.
 *
 * Equal length, not "the previous calendar month" — for a current
 * `Mar 1 → Mar 31` (31 days) the previous range is `Jan 29 → Feb 28`
 * (also 31 days), not Feb 1 → Feb 28 (28 days). This keeps "total
 * distance" and "total time" comparable rather than penalizing a
 * 31-day current period against a 28-day previous.
 *
 * @param range - The current `DateRange`. Duration is computed in
 *   milliseconds from `range.start` to `range.end`; the previous range
 *   spans the same duration ending the day before `range.start`.
 */
export function computePreviousRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime()
  // End of previous range = the day before `range.start`. Snap to
  // end-of-day so downstream filters that compare against
  // `parseSessionDate(s.date).getTime()` (local midnight) include
  // every session on that day.
  const previousEnd = endOfDay(new Date(range.start.getTime() - 1))
  const previousStart = startOfDay(new Date(previousEnd.getTime() - durationMs))
  return { start: previousStart, end: previousEnd }
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
