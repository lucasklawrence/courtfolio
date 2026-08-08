/**
 * The date-range vocabulary shared by the Training Facility's filtered views
 * (#425).
 *
 * These helpers used to live inside `DateFilter.tsx`, next to the component
 * that renders them — convenient at the time, and an inversion: nine modules
 * under `lib/training-facility/` imported *from a `'use client'` component* to
 * get `startOfDay` and a `DateRange` type, which dragged a React component into
 * the domain layer's import graph. The component now re-exports this module for
 * its own consumers, so nothing changed for callers; the arrow between UI and
 * domain simply points the right way again.
 *
 * **These are local-time helpers, deliberately.** They bound a range the way a
 * person picking dates in a browser means them — midnight to midnight *where
 * they are*. That is a different question from "which calendar day does this
 * training session belong to", which is anchored to a single home timezone and
 * lives in `day-keys.ts`. Don't reach for these to bucket a set.
 */

/**
 * Inclusive date range emitted by `DateFilter`. `start` is normalized to
 * local start-of-day (00:00:00.000); `end` to local end-of-day
 * (23:59:59.999). With these bounds, a timestamp comparison
 * `entry >= range.start && entry <= range.end` cleanly includes both the
 * start and end days regardless of the time portion of `entry`. The
 * invariant `start <= end` is always maintained.
 */
export type DateRange = { start: Date; end: Date }

/**
 * The lookback presets, in display order. `months: null` marks the open-ended
 * `ALL` option, whose lower bound comes from the caller instead.
 */
export const PRESETS = [
  { id: '1M', label: '1M', months: 1 },
  { id: '3M', label: '3M', months: 3 },
  { id: '6M', label: '6M', months: 6 },
  { id: '1Y', label: '1Y', months: 12 },
  { id: 'ALL', label: 'All', months: null },
] as const

/** Identifier for one of the {@link PRESETS}. */
export type PresetId = (typeof PRESETS)[number]['id']

/** Lower bound for the `ALL` preset when a caller supplies none. */
export const EARLIEST_DEFAULT = new Date(2000, 0, 1)

/** Local start-of-day (00:00:00.000) for `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** Local end-of-day (23:59:59.999) for `d`. */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/**
 * Subtract `months` from `d`, clamping the day to the last valid day of
 * the target month when the source day doesn't exist there. Avoids JS's
 * silent rollover (e.g., March 31 → setMonth(-1) producing March 3
 * instead of February 28/29).
 *
 * @param d - Source date.
 * @param months - Number of calendar months to subtract. Negative values
 *   are not handled — callers want a backward-looking lookback only.
 */
export function subtractMonths(d: Date, months: number): Date {
  const targetMonthIndex = d.getMonth() - months
  const result = new Date(d.getFullYear(), targetMonthIndex, d.getDate())
  // The Date constructor normalizes negative/overflowing month indices,
  // but if the target month is shorter than the source day it rolls
  // forward (e.g., Feb 31 → Mar 3). Detect that and snap back to the
  // last day of the target month.
  const expectedMonth = ((targetMonthIndex % 12) + 12) % 12
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0)
  }
  return result
}

/**
 * Compute a `DateRange` for one of the preset buttons. Bounds are
 * day-normalized (start: 00:00, end: 23:59:59.999) so the resulting
 * range is independent of the click time.
 *
 * @param preset - Which preset to compute (`1M` / `3M` / `6M` / `1Y` / `ALL`).
 * @param earliest - Lower bound used by the `ALL` preset; ignored otherwise.
 *   Clamped to today if it sits in the future, so the `start <= end`
 *   invariant is preserved against a misconfigured prop.
 */
export function rangeForPreset(preset: PresetId, earliest: Date): DateRange {
  const today = new Date()
  const end = endOfDay(today)
  if (preset === 'ALL') {
    // Clamp `start` to today if `earliest` is in the future, so the
    // documented `start <= end` invariant survives a future-dated
    // `earliestDate` prop (e.g., a placeholder set before any data lands).
    const earliestStart = startOfDay(earliest)
    return { start: earliestStart > end ? startOfDay(today) : earliestStart, end }
  }
  const months = PRESETS.find(p => p.id === preset)!.months!
  return { start: startOfDay(subtractMonths(today, months)), end }
}

/** Format a `Date` as `YYYY-MM-DD` for `<input type="date">`. */
export function toInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse a `YYYY-MM-DD` string from `<input type="date">` as local
 * midnight. Returns `null` for empty input or unparseable values so the
 * caller can no-op rather than storing `Invalid Date`.
 *
 * @param s - Raw `<input type="date">` value, expected as `YYYY-MM-DD`.
 *   Empty or malformed strings return `null`.
 */
export function parseInputValue(s: string): Date | null {
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Convenience predicate for consumers that want a one-liner filter.
 * Inclusive on both ends.
 */
export function isInRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end
}
