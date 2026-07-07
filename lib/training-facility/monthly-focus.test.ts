import { describe, expect, it } from 'vitest'

import type { MonthlyFocus, StrengthSet } from '@/types/weight-room'

import {
  activeFocusesForDay,
  computeFocusAdherence,
  computeFocusLoadStats,
  isFocusActiveOnDay,
  upcomingFocuses,
} from './monthly-focus'

/**
 * Unit tests for the monthly-focus helpers (#255). All dates use local
 * construction (`new Date(y, mIndex, d, …)`) so the local-timezone day
 * bucketing in `toLocalDateKey` matches the `YYYY-MM-DD` window keys.
 */

const JULY_SHRUGS: MonthlyFocus = {
  id: '33333333-3333-4333-8333-333333333333',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

const AUGUST_CALVES: MonthlyFocus = {
  id: '44444444-4444-4444-8444-444444444444',
  exercise: 'calf-raises',
  daily_target: 150,
  target_kind: 'reps',
  color: '#0EA5A1',
  category: 'lower',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
}

/** A lower-lane July focus, concurrent with JULY_SHRUGS (upper), for two-lane cases. */
const JULY_NORDICS: MonthlyFocus = {
  id: '55555555-5555-4555-8555-555555555555',
  exercise: 'nordic-curls',
  daily_target: 40,
  target_kind: 'reps',
  color: '#2563EB',
  category: 'lower',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

/** Build a set on a given local calendar day at noon (stable bucketing). */
function setOn(
  exercise: string,
  year: number,
  monthIndex: number,
  day: number,
  reps: number,
  weight_lbs?: number,
): StrengthSet {
  return {
    id: `${exercise}-${year}-${monthIndex}-${day}-${reps}-${weight_lbs ?? 'bw'}`,
    logged_at: new Date(year, monthIndex, day, 12, 0, 0).toISOString(),
    exercise,
    reps,
    ...(weight_lbs != null ? { weight_lbs } : {}),
  }
}

describe('isFocusActiveOnDay', () => {
  it('is inclusive on both window boundaries', () => {
    expect(isFocusActiveOnDay(JULY_SHRUGS, '2026-07-01')).toBe(true)
    expect(isFocusActiveOnDay(JULY_SHRUGS, '2026-07-31')).toBe(true)
    expect(isFocusActiveOnDay(JULY_SHRUGS, '2026-07-15')).toBe(true)
  })

  it('is false outside the window and for an empty day key', () => {
    expect(isFocusActiveOnDay(JULY_SHRUGS, '2026-06-30')).toBe(false)
    expect(isFocusActiveOnDay(JULY_SHRUGS, '2026-08-01')).toBe(false)
    expect(isFocusActiveOnDay(JULY_SHRUGS, '')).toBe(false)
  })
})

describe('activeFocusesForDay', () => {
  it('returns the single active focus for the day, wrapped in an array', () => {
    expect(activeFocusesForDay([JULY_SHRUGS, AUGUST_CALVES], '2026-07-10')).toEqual([JULY_SHRUGS])
    expect(activeFocusesForDay([JULY_SHRUGS, AUGUST_CALVES], '2026-08-10')).toEqual([AUGUST_CALVES])
  })

  it('returns both lanes when an upper and a lower focus are active at once, upper first', () => {
    // Ordered by category (upper before lower), not by input order.
    expect(activeFocusesForDay([JULY_NORDICS, JULY_SHRUGS], '2026-07-10')).toEqual([
      JULY_SHRUGS,
      JULY_NORDICS,
    ])
  })

  it('returns an empty array when no window covers the day', () => {
    expect(activeFocusesForDay([JULY_SHRUGS, AUGUST_CALVES], '2026-09-01')).toEqual([])
    expect(activeFocusesForDay([], '2026-07-10')).toEqual([])
    expect(activeFocusesForDay([JULY_SHRUGS], '')).toEqual([])
  })

  it('prefers the most recently started focus within a category', () => {
    const replacement: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: 'replacement',
      exercise: 'heavy-shrugs',
      start_date: '2026-07-15',
      end_date: '2026-07-31',
    }
    // Same 'upper' lane → newer start supersedes; only one upper returned.
    expect(activeFocusesForDay([JULY_SHRUGS, replacement], '2026-07-20')).toEqual([replacement])
  })

  it('resolves each category independently — a newer upper does not evict the lower lane', () => {
    const replacement: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: 'replacement',
      exercise: 'heavy-shrugs',
      start_date: '2026-07-15',
      end_date: '2026-07-31',
    }
    expect(activeFocusesForDay([JULY_SHRUGS, replacement, JULY_NORDICS], '2026-07-20')).toEqual([
      replacement,
      JULY_NORDICS,
    ])
  })
})

describe('upcomingFocuses', () => {
  it('returns focuses starting after the day, soonest first', () => {
    const result = upcomingFocuses([AUGUST_CALVES, JULY_SHRUGS], '2026-06-15')
    expect(result.map((f) => f.exercise)).toEqual(['shrugs', 'calf-raises'])
  })

  it('excludes active and past focuses', () => {
    // On a July day, July is active (not upcoming) and only August remains.
    expect(upcomingFocuses([JULY_SHRUGS, AUGUST_CALVES], '2026-07-10').map((f) => f.exercise)).toEqual(
      ['calf-raises'],
    )
  })

  it('returns empty for an empty day key', () => {
    expect(upcomingFocuses([JULY_SHRUGS], '')).toEqual([])
  })
})

describe('computeFocusAdherence', () => {
  it('reports nothing elapsed before the window opens', () => {
    const a = computeFocusAdherence(JULY_SHRUGS, [], new Date(2026, 5, 20, 9, 0, 0))
    expect(a).toEqual({
      daysInWindow: 31,
      daysElapsed: 0,
      daysHit: 0,
      currentStreak: 0,
      percent: 0,
    })
  })

  it('counts hit days and the current streak partway through the window (reps kind)', () => {
    // Window opens 7/1. "Today" = 7/5 → 5 days elapsed. Hit goal (100
    // reps) on 7/1, 7/2, 7/3, missed 7/4 (only 50), hit 7/5.
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 100, 95),
      setOn('shrugs', 2026, 6, 2, 60, 95),
      setOn('shrugs', 2026, 6, 2, 40, 95),
      setOn('shrugs', 2026, 6, 3, 100, 100),
      setOn('shrugs', 2026, 6, 4, 50, 100),
      setOn('shrugs', 2026, 6, 5, 100, 100),
    ]
    const a = computeFocusAdherence(JULY_SHRUGS, sets, new Date(2026, 6, 5, 18, 0, 0))
    expect(a.daysInWindow).toBe(31)
    expect(a.daysElapsed).toBe(5)
    expect(a.daysHit).toBe(4) // 7/1, 7/2 (60+40), 7/3, 7/5
    expect(a.currentStreak).toBe(1) // 7/5 hit, 7/4 missed breaks it
    expect(a.percent).toBeCloseTo(4 / 5)
  })

  it('ignores sets for other exercises and outside the window', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 100),
      setOn('pushups', 2026, 6, 1, 100), // wrong exercise
      setOn('shrugs', 2026, 5, 30, 100), // before window
    ]
    const a = computeFocusAdherence(JULY_SHRUGS, sets, new Date(2026, 6, 1, 18, 0, 0))
    expect(a.daysElapsed).toBe(1)
    expect(a.daysHit).toBe(1)
  })

  it('clamps elapsed to the window length once the month is over', () => {
    const a = computeFocusAdherence(JULY_SHRUGS, [], new Date(2026, 8, 15, 9, 0, 0))
    expect(a.daysElapsed).toBe(31)
    expect(a.daysInWindow).toBe(31)
  })

  it('supports a sets-based target', () => {
    const setsFocus: MonthlyFocus = { ...JULY_SHRUGS, target_kind: 'sets', daily_target: 3 }
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 10),
      setOn('shrugs', 2026, 6, 1, 10),
      setOn('shrugs', 2026, 6, 1, 10), // 3 sets on 7/1 → hit
    ]
    const a = computeFocusAdherence(setsFocus, sets, new Date(2026, 6, 1, 18, 0, 0))
    expect(a.daysHit).toBe(1)
    expect(a.currentStreak).toBe(1)
  })
})

describe('computeFocusLoadStats', () => {
  it('summarizes top set, average load, and tonnage over weighted sets', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 20, 100),
      setOn('shrugs', 2026, 6, 1, 20, 110),
      setOn('shrugs', 2026, 6, 2, 15, 120),
    ]
    const stats = computeFocusLoadStats(JULY_SHRUGS, sets)
    expect(stats.topSetLbs).toBe(120)
    expect(stats.weightedSets).toBe(3)
    expect(stats.avgLoadLbs).toBeCloseTo((100 + 110 + 120) / 3)
    expect(stats.tonnageLbs).toBe(20 * 100 + 20 * 110 + 15 * 120) // 5800
  })

  it('returns null load metrics for a bodyweight focus', () => {
    const sets: StrengthSet[] = [setOn('shrugs', 2026, 6, 1, 20)]
    const stats = computeFocusLoadStats(JULY_SHRUGS, sets)
    expect(stats).toEqual({
      topSetLbs: null,
      avgLoadLbs: null,
      tonnageLbs: 0,
      weightedSets: 0,
    })
  })

  it('excludes sets outside the window and other exercises', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 20, 100),
      setOn('shrugs', 2026, 7, 1, 20, 200), // August, out of window
      setOn('pushups', 2026, 6, 1, 20, 50), // wrong exercise
    ]
    const stats = computeFocusLoadStats(JULY_SHRUGS, sets)
    expect(stats.weightedSets).toBe(1)
    expect(stats.tonnageLbs).toBe(2000)
  })
})
