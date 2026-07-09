import { describe, expect, it } from 'vitest'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import {
  computeRingPercent,
  filterSetsForDay,
  formatDayLabel,
  localNoonIsoForDay,
  sumReps,
  toLocalDateKey,
  totalsByExercise,
  variantBreakdown,
} from './strength-today'

/** Helper — assemble a {@link StrengthSet} with sensible defaults. */
function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    logged_at: '2026-05-07T13:00:00',
    exercise: 'pushups',
    reps: 10,
    ...overrides,
  }
}

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}

describe('toLocalDateKey', () => {
  it('returns YYYY-MM-DD in local time for a parseable timestamp', () => {
    expect(toLocalDateKey('2026-05-07T13:00:00')).toBe('2026-05-07')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toLocalDateKey('2026-01-04T08:00:00')).toBe('2026-01-04')
  })

  it('returns "" for an unparseable string', () => {
    expect(toLocalDateKey('not-a-date')).toBe('')
  })

  it('accepts a Date input directly', () => {
    const d = new Date('2026-05-07T13:00:00')
    expect(toLocalDateKey(d)).toBe('2026-05-07')
  })
})

describe('filterSetsForDay', () => {
  it('keeps only sets whose logged_at falls on the day', () => {
    const sets = [
      set({ logged_at: '2026-05-07T08:00:00' }),
      set({ logged_at: '2026-05-07T22:30:00' }),
      set({ logged_at: '2026-05-06T13:00:00' }),
    ]
    expect(filterSetsForDay(sets, '2026-05-07')).toHaveLength(2)
  })

  it('returns an empty array when dayKey is empty', () => {
    expect(filterSetsForDay([set()], '')).toEqual([])
  })

  it('skips sets with unparseable timestamps without throwing', () => {
    const sets = [
      set({ logged_at: '2026-05-07T08:00:00' }),
      set({ logged_at: 'not-a-date' }),
    ]
    expect(filterSetsForDay(sets, '2026-05-07')).toHaveLength(1)
  })
})

describe('sumReps', () => {
  it('returns 0 for an empty array', () => {
    expect(sumReps([])).toBe(0)
  })

  it('sums reps across all sets', () => {
    expect(sumReps([set({ reps: 5 }), set({ reps: 12 }), set({ reps: 8 })])).toBe(25)
  })
})

describe('totalsByExercise', () => {
  it('groups reps by exercise key', () => {
    const totals = totalsByExercise([
      set({ exercise: 'pushups', reps: 10 }),
      set({ exercise: 'pushups', reps: 15 }),
      set({ exercise: 'pullups', reps: 5 }),
    ])
    expect(totals.get('pushups')).toBe(25)
    expect(totals.get('pullups')).toBe(5)
  })

  it('returns an empty map for no sets', () => {
    expect(totalsByExercise([]).size).toBe(0)
  })

  it('rolls every variant of an exercise into one total (#254)', () => {
    // The whole point of #254: a variant is a slice label, never a
    // rollup key. Two different-grip pullup sets must sum into the
    // single `pullups` ring, not split into `pullups/wide` +
    // `pullups/close`.
    const totals = totalsByExercise([
      set({ exercise: 'pullups', reps: 10, variant: 'wide' }),
      set({ exercise: 'pullups', reps: 5, variant: 'close' }),
      set({ exercise: 'pullups', reps: 3 }),
    ])
    expect(totals.get('pullups')).toBe(18)
    expect(totals.size).toBe(1)
  })
})

describe('variantBreakdown', () => {
  it('buckets reps and sets by variant with shares of the total', () => {
    const slices = variantBreakdown([
      set({ reps: 10, variant: 'wide' }),
      set({ reps: 20, variant: 'wide' }),
      set({ reps: 20, variant: 'close' }),
    ])
    const wide = slices.find((s) => s.variant === 'wide')
    const close = slices.find((s) => s.variant === 'close')
    expect(wide).toEqual({ variant: 'wide', reps: 30, sets: 2, share: 0.6 })
    expect(close).toEqual({ variant: 'close', reps: 20, sets: 1, share: 0.4 })
  })

  it('collapses untagged sets into a single null "unspecified" slice', () => {
    const slices = variantBreakdown([set({ reps: 10 }), set({ reps: 5 })])
    expect(slices).toEqual([{ variant: null, reps: 15, sets: 2, share: 1 }])
  })

  it('sorts by reps desc, unspecified last on a tie', () => {
    const slices = variantBreakdown([
      set({ reps: 5, variant: 'close' }),
      set({ reps: 10, variant: 'wide' }),
      set({ reps: 10 }),
    ])
    // wide (10) and unspecified (10) tie on reps; unspecified sorts last.
    expect(slices.map((s) => s.variant)).toEqual(['wide', null, 'close'])
  })

  it('shares across the slices sum to 1', () => {
    const slices = variantBreakdown([
      set({ reps: 7, variant: 'wide' }),
      set({ reps: 11, variant: 'close' }),
      set({ reps: 13 }),
    ])
    const totalShare = slices.reduce((sum, s) => sum + s.share, 0)
    expect(totalShare).toBeCloseTo(1, 10)
  })

  it('returns an empty array for no sets', () => {
    expect(variantBreakdown([])).toEqual([])
  })
})

describe('computeRingPercent', () => {
  it('returns the unclamped fraction of the daily target', () => {
    expect(computeRingPercent(50, PUSHUPS)).toBe(0.5)
    expect(computeRingPercent(100, PUSHUPS)).toBe(1)
    expect(computeRingPercent(125, PUSHUPS)).toBe(1.25)
  })

  it('returns 0 when the daily target is non-positive', () => {
    expect(
      computeRingPercent(50, { exercise: 'pushups', daily_target: 0, color: '#000' }),
    ).toBe(0)
  })

  it('returns 0 when no reps logged', () => {
    expect(computeRingPercent(0, PUSHUPS)).toBe(0)
  })
})

describe('localNoonIsoForDay', () => {
  it('round-trips back to the same local day key', () => {
    // The exact UTC string depends on the test runner's timezone; the
    // contract is "this instant buckets onto the requested day."
    expect(toLocalDateKey(localNoonIsoForDay('2026-05-25'))).toBe('2026-05-25')
  })

  it('stamps local noon, not midnight', () => {
    const d = new Date(localNoonIsoForDay('2026-05-25'))
    expect(d.getHours()).toBe(12)
    expect(d.getMinutes()).toBe(0)
  })

  it('returns "" for a non-day-key string', () => {
    expect(localNoonIsoForDay('not-a-date')).toBe('')
    expect(localNoonIsoForDay('2026-05-25T08:00:00')).toBe('')
    expect(localNoonIsoForDay('')).toBe('')
  })

  it('returns "" for component overflow instead of rolling the date', () => {
    // new Date(2026, 1, 31) would silently roll to March 3.
    expect(localNoonIsoForDay('2026-02-31')).toBe('')
  })
})

describe('formatDayLabel', () => {
  it('formats weekday, month, and day', () => {
    // 2026-05-25 is a Monday. Exact strings are locale-dependent; assert
    // on the en-US pieces the CI/dev environments produce.
    const label = formatDayLabel('2026-05-25')
    expect(label).toContain('Mon')
    expect(label).toContain('May')
    expect(label).toContain('25')
  })

  it('returns "" for an unparseable key', () => {
    expect(formatDayLabel('not-a-date')).toBe('')
    expect(formatDayLabel('2026-02-31')).toBe('')
  })
})
