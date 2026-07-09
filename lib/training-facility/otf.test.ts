import { describe, expect, it } from 'vitest'

import type { OtfSession } from '@/types/otf'

import {
  OTF_CLASS_TYPE_BOTH,
  OTF_CLASS_TYPE_ROW,
  OTF_CLASS_TYPE_STRENGTH,
  OTF_CLASS_TYPE_TREAD,
} from '../../scripts/lib/otbeat-class-type.mjs'
import {
  OTF_CLASS_TYPE_ORDER,
  aggregateOtfZoneMinutes,
  earliestOtfDate,
  effectiveOtfClassType,
  excludeInvalidOtfSessions,
  filterOtfSessionsByClassType,
  filterOtfSessionsInRange,
  formatMmss,
  formatOtfDate,
  mmssToSeconds,
  otfBlockTrend,
  otfClassTypes,
  otfHighlights,
  otfLinearRegression,
  otfMetricTrend,
  otfRollingAverage,
  otfTrendEndpoints,
  resolveOtfClassTypeFilter,
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

describe('excludeInvalidOtfSessions', () => {
  it('drops sessions flagged excluded, keeps the rest in order', () => {
    const sessions = [
      mk('a'),
      mk('b', { excluded: true, excluded_reason: 'auto: malfunction' }),
      mk('c', { excluded: false }),
    ]
    expect(excludeInvalidOtfSessions(sessions).map(s => s.started_at)).toEqual(['a', 'c'])
  })

  it('is a no-op when nothing is excluded', () => {
    const sessions = [mk('a'), mk('b')]
    expect(excludeInvalidOtfSessions(sessions)).toHaveLength(2)
  })
})

describe('class-type helpers (#271)', () => {
  it('OTF_CLASS_TYPE_ORDER stays in sync with the ingest label constants', () => {
    // Drift guard: the display order and the .mjs classifier must name the same
    // four auto labels (they live in two files — see the KEEP IN SYNC notes).
    expect([...OTF_CLASS_TYPE_ORDER].sort()).toEqual(
      [
        OTF_CLASS_TYPE_BOTH,
        OTF_CLASS_TYPE_TREAD,
        OTF_CLASS_TYPE_ROW,
        OTF_CLASS_TYPE_STRENGTH,
      ].sort()
    )
  })

  describe('effectiveOtfClassType', () => {
    it('prefers a manual override over the inferred class_type', () => {
      expect(effectiveOtfClassType(mk('a', { class_type: 'Tread + Row', class_type_override: '2G' }))).toBe(
        '2G'
      )
    })

    it('falls back to class_type when there is no override', () => {
      expect(effectiveOtfClassType(mk('a', { class_type: 'Tread-focused' }))).toBe('Tread-focused')
    })

    it('treats a blank override as unset', () => {
      expect(
        effectiveOtfClassType(mk('a', { class_type: 'Row-focused', class_type_override: '  ' }))
      ).toBe('Row-focused')
    })

    it('is undefined when the session has neither', () => {
      expect(effectiveOtfClassType(mk('a'))).toBeUndefined()
    })
  })

  describe('otfClassTypes', () => {
    it('lists distinct effective types, known labels first then extras alphabetically', () => {
      const sessions = [
        mk('a', { class_type: 'Row-focused' }),
        mk('b', { class_type: 'Tread + Row' }),
        mk('c', { class_type: 'Tread + Row' }), // duplicate collapses
        mk('d', { class_type: 'Tread-focused' }),
        mk('e', { class_type: 'Tread + Row', class_type_override: 'Strength 50' }), // manual extra
        mk('f'), // no type → omitted
      ]
      expect(otfClassTypes(sessions)).toEqual([
        'Tread + Row',
        'Tread-focused',
        'Row-focused',
        'Strength 50',
      ])
    })

    it('returns an empty list when no session has a type', () => {
      expect(otfClassTypes([mk('a'), mk('b')])).toEqual([])
    })
  })

  describe('resolveOtfClassTypeFilter', () => {
    it('keeps a valid selection and shows the control when there is a real choice', () => {
      expect(resolveOtfClassTypeFilter('Tread + Row', ['Tread + Row', 'Row-focused'])).toEqual({
        effective: 'Tread + Row',
        visible: true,
      })
    })

    it('stays visible when the window narrows to the single active type (clearable)', () => {
      // codex #275: without this the control vanishes with no "All" to clear it,
      // hiding untyped/excluded rows the log should keep showing.
      expect(resolveOtfClassTypeFilter('Tread + Row', ['Tread + Row'])).toEqual({
        effective: 'Tread + Row',
        visible: true,
      })
    })

    it('falls back to null the same render the selection leaves the window', () => {
      // CodeRabbit #275: filtering must not use a stale type for a frame.
      expect(resolveOtfClassTypeFilter('Row-focused', ['Tread + Row', 'Tread-focused'])).toEqual({
        effective: null,
        visible: true,
      })
    })

    it('hides the control with a single option and no active filter', () => {
      expect(resolveOtfClassTypeFilter(null, ['Tread + Row'])).toEqual({
        effective: null,
        visible: false,
      })
    })

    it('hides the control when a dropped selection leaves only one option', () => {
      expect(resolveOtfClassTypeFilter('Row-focused', ['Tread + Row'])).toEqual({
        effective: null,
        visible: false,
      })
      expect(resolveOtfClassTypeFilter('Row-focused', [])).toEqual({
        effective: null,
        visible: false,
      })
    })

    it('shows the control with 2+ options even when nothing is selected', () => {
      expect(resolveOtfClassTypeFilter(null, ['Tread + Row', 'Row-focused'])).toEqual({
        effective: null,
        visible: true,
      })
    })
  })

  describe('filterOtfSessionsByClassType', () => {
    const sessions = [
      mk('a', { class_type: 'Tread + Row' }),
      mk('b', { class_type: 'Row-focused' }),
      mk('c', { class_type: 'Tread + Row', class_type_override: '2G' }), // effective = '2G'
    ]

    it('keeps only sessions whose effective type matches', () => {
      expect(filterOtfSessionsByClassType(sessions, 'Tread + Row').map(s => s.started_at)).toEqual([
        'a',
      ])
    })

    it('matches on the override, not the inferred label', () => {
      expect(filterOtfSessionsByClassType(sessions, '2G').map(s => s.started_at)).toEqual(['c'])
    })

    it('returns every session (a fresh array) for the null "All" sentinel', () => {
      const result = filterOtfSessionsByClassType(sessions, null)
      expect(result).toHaveLength(3)
      expect(result).not.toBe(sessions)
    })
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

describe('otfTrendEndpoints', () => {
  const pt = (day: number, value: number): OtfTrendPoint => ({
    date: new Date(2026, 5, day),
    value,
  })

  it('returns the first and last values of an ascending trend', () => {
    expect(otfTrendEndpoints([pt(1, 100), pt(2, 200), pt(3, 150)])).toEqual({
      first: 100,
      last: 150,
    })
  })

  it('first === last for a single-point trend', () => {
    expect(otfTrendEndpoints([pt(1, 42)])).toEqual({ first: 42, last: 42 })
  })

  it('returns null for an empty trend', () => {
    expect(otfTrendEndpoints([])).toBeNull()
  })
})

describe('otfLinearRegression (#267)', () => {
  // One point per day starting 2026-06-01, so `slopePerDay` is directly the
  // per-step delta in the fitted values.
  const pt = (day: number, value: number): OtfTrendPoint => ({
    date: new Date(2026, 5, day),
    value,
  })

  it('fits a rising line with positive per-day slope', () => {
    const line = otfLinearRegression([pt(1, 10), pt(2, 20), pt(3, 30)])
    expect(line).not.toBeNull()
    expect(line!.slopePerDay).toBeCloseTo(10, 6)
  })

  it('fits a falling line with negative per-day slope', () => {
    const line = otfLinearRegression([pt(1, 30), pt(2, 20), pt(3, 10)])
    expect(line!.slopePerDay).toBeCloseTo(-10, 6)
  })

  it('spans the trend x-domain: endpoints sit at the min and max dates', () => {
    const line = otfLinearRegression([pt(1, 10), pt(2, 20), pt(3, 30)])!
    expect(line.points).toHaveLength(2)
    expect(line.points[0].date.getTime()).toBe(new Date(2026, 5, 1).getTime())
    expect(line.points[1].date.getTime()).toBe(new Date(2026, 5, 3).getTime())
    // On a perfectly linear trend the fitted endpoints equal the data.
    expect(line.points[0].value).toBeCloseTo(10, 6)
    expect(line.points[1].value).toBeCloseTo(30, 6)
  })

  it('fits the least-squares line through noisy data', () => {
    // y ≈ 5x + noise; the closed-form least-squares slope for
    // (1,4)(2,11)(3,14)(4,21) is 108/20 = 5.4 per day.
    const line = otfLinearRegression([pt(1, 4), pt(2, 11), pt(3, 14), pt(4, 21)])!
    expect(line.slopePerDay).toBeCloseTo(5.4, 4)
  })

  it('returns null for fewer than two points', () => {
    expect(otfLinearRegression([])).toBeNull()
    expect(otfLinearRegression([pt(1, 10)])).toBeNull()
  })

  it('returns null when every point shares one date (zero x-variance)', () => {
    const sameDay = { date: new Date(2026, 5, 1), value: 0 }
    expect(
      otfLinearRegression([
        { ...sameDay, value: 10 },
        { ...sameDay, value: 20 },
      ])
    ).toBeNull()
  })
})

describe('otfRollingAverage (#267)', () => {
  const pt = (day: number, value: number): OtfTrendPoint => ({
    date: new Date(2026, 5, day),
    value,
  })

  it('averages up to `window` trailing points, keeping original dates', () => {
    const avg = otfRollingAverage([pt(1, 10), pt(2, 20), pt(3, 30), pt(4, 40)], 2)
    expect(avg.map(p => p.value)).toEqual([10, 15, 25, 35])
    expect(avg.map(p => p.date.getTime())).toEqual([
      new Date(2026, 5, 1).getTime(),
      new Date(2026, 5, 2).getTime(),
      new Date(2026, 5, 3).getTime(),
      new Date(2026, 5, 4).getTime(),
    ])
  })

  it('uses min-periods 1 so output length matches input', () => {
    const avg = otfRollingAverage([pt(1, 10), pt(2, 20), pt(3, 30)], 3)
    expect(avg.map(p => p.value)).toEqual([10, 15, 20])
  })

  it('a window of 1 (or below) returns the original values', () => {
    const trend = [pt(1, 10), pt(2, 20)]
    expect(otfRollingAverage(trend, 1).map(p => p.value)).toEqual([10, 20])
    expect(otfRollingAverage(trend, 0).map(p => p.value)).toEqual([10, 20])
  })

  it('returns an empty array for an empty trend', () => {
    expect(otfRollingAverage([], 3)).toEqual([])
  })
})
