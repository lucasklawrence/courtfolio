import { describe, expect, it } from 'vitest'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import {
  MIN_PREVIOUS_SESSIONS_FOR_DELTA,
  computeDelta,
  computePreviousRange,
} from './period-comparison'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Calendar-day count for a `DateRange` whose bounds are start- and
 * end-of-day. `Math.floor` + 1 because the range is inclusive on both
 * ends (Mar 1 00:00 → Mar 31 23:59:59.999 is 31 days, not 32, even
 * though `(end - start) / day ≈ 30.999`).
 */
function calendarDayCount(range: DateRange): number {
  return Math.floor((range.end.getTime() - range.start.getTime()) / MS_PER_DAY) + 1
}

describe('computePreviousRange', () => {
  it('returns a previous range covering the same calendar-day count, ending the day before range.start', () => {
    // Mar 1 → Mar 31 spans 31 calendar days. Previous of equal length
    // therefore ends Feb 28 (day before Mar 1) and starts Jan 29.
    // The ms-duration may differ by an hour across this boundary
    // because DST springs forward in March; calendar-day count is the
    // user-facing invariant.
    const current: DateRange = {
      start: new Date(2026, 2, 1, 0, 0, 0, 0),
      end: new Date(2026, 2, 31, 23, 59, 59, 999),
    }
    const previous = computePreviousRange(current)
    expect(previous.start).toEqual(new Date(2026, 0, 29, 0, 0, 0, 0))
    expect(previous.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999))
    expect(calendarDayCount(previous)).toBe(calendarDayCount(current))
  })

  it('handles a single-day range', () => {
    const current: DateRange = {
      start: new Date(2026, 2, 15, 0, 0, 0, 0),
      end: new Date(2026, 2, 15, 23, 59, 59, 999),
    }
    const previous = computePreviousRange(current)
    expect(previous.start).toEqual(new Date(2026, 2, 14, 0, 0, 0, 0))
    expect(previous.end).toEqual(new Date(2026, 2, 14, 23, 59, 59, 999))
  })

  it('handles a range crossing a year boundary', () => {
    const current: DateRange = {
      start: new Date(2026, 0, 1, 0, 0, 0, 0),
      end: new Date(2026, 0, 31, 23, 59, 59, 999),
    }
    const previous = computePreviousRange(current)
    expect(previous.start.getFullYear()).toBe(2025)
    expect(previous.end).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999))
  })

  it('end-of-previous is strictly before start-of-current', () => {
    const current: DateRange = {
      start: new Date(2026, 5, 1, 0, 0, 0, 0),
      end: new Date(2026, 5, 30, 23, 59, 59, 999),
    }
    const previous = computePreviousRange(current)
    expect(previous.end.getTime()).toBeLessThan(current.start.getTime())
  })
})

describe('computeDelta', () => {
  it('returns up when current > previous', () => {
    expect(computeDelta(120, 100)).toEqual({ absolute: 20, percent: 20, direction: 'up' })
  })

  it('returns down when current < previous', () => {
    expect(computeDelta(80, 100)).toEqual({ absolute: -20, percent: -20, direction: 'down' })
  })

  it('returns same when current === previous', () => {
    expect(computeDelta(100, 100)).toEqual({ absolute: 0, percent: 0, direction: 'same' })
  })

  it('returns null percent when previous is 0 but still reports absolute and direction', () => {
    expect(computeDelta(50, 0)).toEqual({ absolute: 50, percent: null, direction: 'up' })
  })

  it('returns null when current is null', () => {
    expect(computeDelta(null, 100)).toBeNull()
  })

  it('returns null when previous is null', () => {
    expect(computeDelta(100, null)).toBeNull()
  })

  it('returns null when both are null', () => {
    expect(computeDelta(null, null)).toBeNull()
  })
})

describe('MIN_PREVIOUS_SESSIONS_FOR_DELTA', () => {
  it('matches the spec threshold of >3 prior sessions', () => {
    expect(MIN_PREVIOUS_SESSIONS_FOR_DELTA).toBe(4)
  })
})
