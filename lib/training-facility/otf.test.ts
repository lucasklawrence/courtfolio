import { describe, expect, it } from 'vitest'

import type { OtfSession } from '@/types/otf'

import {
  aggregateOtfZoneMinutes,
  earliestOtfDate,
  filterOtfSessionsInRange,
  formatMmss,
  formatOtfDate,
  mmssToSeconds,
  normalizeOtfTrend,
  otfBlockTrend,
  otfHighlights,
  otfMetricTrend,
  type OtfTrendPoint,
} from './otf'

/** Tiny session factory for the helper tests. */
function mk(started_at: string, extra: Partial<OtfSession> = {}): OtfSession {
  return { started_at, ...extra }
}

describe('filterOtfSessionsInRange', () => {
  it('keeps only sessions whose start falls inside the inclusive range', () => {
    const sessions = [
      mk('2026-04-15T12:00:00Z'), // before
      mk('2026-06-15T12:00:00Z'), // inside
      mk('2026-08-15T12:00:00Z'), // after
    ]
    // Wide local bounds (weeks of margin) so the assertion is timezone-robust.
    const range = { start: new Date(2026, 4, 1), end: new Date(2026, 6, 1) }
    expect(filterOtfSessionsInRange(sessions, range).map(s => s.started_at)).toEqual([
      '2026-06-15T12:00:00Z',
    ])
  })
})

describe('aggregateOtfZoneMinutes', () => {
  it('sums each zone across sessions in canonical order; missing blocks contribute zero', () => {
    const sessions = [
      mk('a', { zones_min: { gray: 1, blue: 2, green: 3, orange: 4, red: 5 } }),
      mk('b', { zones_min: { gray: 1, blue: 1, green: 1, orange: 1, red: 1 } }),
      mk('c'), // no zone block
    ]
    expect(aggregateOtfZoneMinutes(sessions).map(b => [b.key, b.minutes])).toEqual([
      ['gray', 2],
      ['blue', 3],
      ['green', 4],
      ['orange', 5],
      ['red', 6],
    ])
  })
})

describe('otfHighlights', () => {
  it('computes totals, average, and bests, treating absent metrics as zero', () => {
    const sessions = [
      mk('a', { splat: 10, calories: 500 }),
      mk('b', { splat: 20, calories: 800 }),
      mk('c'),
    ]
    expect(otfHighlights(sessions)).toEqual({
      classes: 3,
      totalSplat: 30,
      totalCalories: 1300,
      avgSplat: 10,
      bestSplat: 20,
      bestCalories: 800,
    })
  })

  it('avgSplat is 0 with no sessions', () => {
    expect(otfHighlights([]).avgSplat).toBe(0)
  })
})

describe('otfMetricTrend', () => {
  it('emits one dated point per session that has the metric, dropping the rest', () => {
    const points = otfMetricTrend(
      [mk('2026-06-01T12:00:00Z', { splat: 10 }), mk('2026-06-02T12:00:00Z')],
      'splat'
    )
    expect(points).toHaveLength(1)
    expect(points[0].value).toBe(10)
    expect(points[0].date).toBeInstanceOf(Date)
  })
})

describe('earliestOtfDate / formatOtfDate', () => {
  it('earliestOtfDate returns the minimum start, or null when empty', () => {
    expect(earliestOtfDate([])).toBeNull()
    const earliest = earliestOtfDate([mk('2026-06-15T12:00:00Z'), mk('2026-04-01T12:00:00Z')])
    expect(earliest?.getTime()).toBe(new Date('2026-04-01T12:00:00Z').getTime())
  })

  it('formatOtfDate renders YYYY-MM-DD', () => {
    // Noon UTC avoids a day flip under negative-offset test runners.
    expect(formatOtfDate(mk('2026-06-27T12:00:00Z'))).toMatch(/^2026-06-27$/)
  })
})

describe('mmssToSeconds / formatMmss', () => {
  it('parses MM:SS to whole seconds', () => {
    expect(mmssToSeconds('16:44')).toBe(1004)
    expect(mmssToSeconds('01:56')).toBe(116)
  })

  it('returns null on empty or malformed input', () => {
    expect(mmssToSeconds('')).toBeNull()
    expect(mmssToSeconds(null)).toBeNull()
    expect(mmssToSeconds('nope')).toBeNull()
  })

  it('formats seconds back to M:SS (round-trip)', () => {
    expect(formatMmss(1004)).toBe('16:44')
    expect(formatMmss(116)).toBe('1:56')
    expect(formatMmss(0)).toBe('0:00')
  })
})

describe('otfBlockTrend', () => {
  it('reads a numeric field from the treadmill block, dropping sessions without it', () => {
    const sessions = [
      mk('2026-06-01T12:00:00Z', { treadmill: { distance_mi: 1.1, time: '16:00' } }),
      mk('2026-06-02T12:00:00Z', { rower: { distance_m: 2000, time: '13:00' } }), // no treadmill
      mk('2026-06-03T12:00:00Z', { treadmill: { distance_mi: 1.4, time: '17:00' } }),
    ]
    expect(otfBlockTrend(sessions, 'treadmill', t => t.distance_mi).map(p => p.value)).toEqual([
      1.1, 1.4,
    ])
  })

  it('supports MM:SS metrics via mmssToSeconds and drops null picks', () => {
    const sessions = [
      mk('2026-06-01T12:00:00Z', {
        rower: { distance_m: 2000, time: '13:00', split_500m: '01:56' },
      }),
      mk('2026-06-02T12:00:00Z', { rower: { distance_m: 1900, time: '12:00' } }), // no split
    ]
    const points = otfBlockTrend(sessions, 'rower', r => mmssToSeconds(r.split_500m))
    expect(points).toHaveLength(1)
    expect(points[0].value).toBe(116)
  })
})

describe('normalizeOtfTrend', () => {
  const pt = (day: number, value: number): OtfTrendPoint => ({
    date: new Date(2026, 5, day),
    value,
  })

  it('rescales values to [0,1] against their own min/max, preserving dates', () => {
    const input = [pt(1, 100), pt(2, 200), pt(3, 150)]
    const { points, min, max } = normalizeOtfTrend(input)
    expect(min).toBe(100)
    expect(max).toBe(200)
    expect(points.map(p => p.value)).toEqual([0, 1, 0.5])
    expect(points.map(p => p.date)).toEqual(input.map(p => p.date))
  })

  it('maps a flat trend (equal values) to a constant 0.5 rather than dividing by zero', () => {
    const { points, min, max } = normalizeOtfTrend([pt(1, 5), pt(2, 5)])
    expect(min).toBe(5)
    expect(max).toBe(5)
    expect(points.map(p => p.value)).toEqual([0.5, 0.5])
  })

  it('maps a single point to 0.5 with min === max', () => {
    const { points, min, max } = normalizeOtfTrend([pt(1, 42)])
    expect([min, max]).toEqual([42, 42])
    expect(points[0].value).toBe(0.5)
  })

  it('yields no points and a [0,0] range for an empty trend', () => {
    expect(normalizeOtfTrend([])).toEqual({ points: [], min: 0, max: 0 })
  })
})
