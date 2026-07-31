import { describe, expect, it } from 'vitest'

import type { MonthlyFocus, StrengthSet } from '@/types/weight-room'

import {
  activeFocusesForDay,
  buildFocusLaneCells,
  computeFocusAdherence,
  computeFocusLoadStats,
  focusTargetHistory,
  formatFocusWindow,
  isFocusActiveOnDay,
  summarizeFocusCampaigns,
  upcomingFocuses,
} from './monthly-focus'

/**
 * Unit tests for the monthly-focus helpers (#255). Set timestamps use
 * ISO strings with a UTC noon offset so `pacificDayKey` maps them to the
 * expected Pacific calendar day (noon UTC = 5 am PDT, well within the
 * same calendar day in both zones).
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

/**
 * Build a set at UTC noon on the given calendar date. UTC noon = 5 am PDT,
 * which `pacificDayKey` resolves to the same `YYYY-MM-DD` as the arguments,
 * so tests are stable on any CI timezone.
 */
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
    logged_at: new Date(Date.UTC(year, monthIndex, day, 12, 0, 0)).toISOString(),
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

describe('formatFocusWindow', () => {
  it('formats a same-month window as a short day range without a year', () => {
    expect(formatFocusWindow(JULY_SHRUGS)).toBe('Jul 1 – Jul 31')
  })

  it('spans a month/year boundary', () => {
    const winter: MonthlyFocus = {
      ...JULY_SHRUGS,
      start_date: '2026-12-15',
      end_date: '2027-01-12',
    }
    expect(formatFocusWindow(winter)).toBe('Dec 15 – Jan 12')
  })

  it('falls back to the raw ISO keys when a date is unparseable', () => {
    const broken: MonthlyFocus = { ...JULY_SHRUGS, end_date: 'not-a-date' }
    expect(formatFocusWindow(broken)).toBe('2026-07-01 – not-a-date')
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
      loadMultiplier: 1,
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

  it('scales tonnage by the load multiplier but leaves load per-implement', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 20, 100),
      setOn('shrugs', 2026, 6, 2, 15, 120),
    ]
    const stats = computeFocusLoadStats(JULY_SHRUGS, sets, 2)
    // Both dumbbells move, so tonnage doubles...
    expect(stats.tonnageLbs).toBe((20 * 100 + 15 * 120) * 2)
    // ...but "how heavy did you go" stays the number on one dumbbell.
    expect(stats.topSetLbs).toBe(120)
    expect(stats.avgLoadLbs).toBeCloseTo(110)
  })

  it('defaults to a single implement when no multiplier is supplied', () => {
    const sets: StrengthSet[] = [setOn('shrugs', 2026, 6, 1, 10, 50)]
    expect(computeFocusLoadStats(JULY_SHRUGS, sets).tonnageLbs).toBe(500)
    expect(computeFocusLoadStats(JULY_SHRUGS, sets, 1).tonnageLbs).toBe(500)
  })

  it("clamps a non-positive multiplier so tonnage can't be erased", () => {
    const sets: StrengthSet[] = [setOn('shrugs', 2026, 6, 1, 10, 50)]
    expect(computeFocusLoadStats(JULY_SHRUGS, sets, 0).tonnageLbs).toBe(500)
  })
})

describe('buildFocusLaneCells', () => {
  it('returns empty when focuses list is empty', () => {
    expect(buildFocusLaneCells([], [], 'upper', '2026-07-10')).toEqual([])
  })

  it('returns empty when no focuses exist for the requested category', () => {
    // AUGUST_CALVES is lower; asking for upper should produce nothing.
    expect(buildFocusLaneCells([AUGUST_CALVES], [], 'upper', '2026-08-10')).toEqual([])
  })

  it('returns empty when today is before the earliest focus start_date', () => {
    expect(buildFocusLaneCells([JULY_SHRUGS], [], 'upper', '2026-06-30')).toEqual([])
  })

  it('returns empty when today is an empty string', () => {
    expect(buildFocusLaneCells([JULY_SHRUGS], [], 'upper', '')).toEqual([])
  })

  it('builds one cell per day from start_date through today', () => {
    const cells = buildFocusLaneCells([JULY_SHRUGS], [], 'upper', '2026-07-03')
    expect(cells).toHaveLength(3)
    expect(cells[0].dayKey).toBe('2026-07-01')
    expect(cells[1].dayKey).toBe('2026-07-02')
    expect(cells[2].dayKey).toBe('2026-07-03')
  })

  it('assigns the correct focus and computes pct from focus.daily_target', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 100), // 100 reps — hits the 100-rep target exactly
      setOn('shrugs', 2026, 6, 2, 50), //  50 reps — 50 % of target
    ]
    const cells = buildFocusLaneCells([JULY_SHRUGS], sets, 'upper', '2026-07-03')

    expect(cells[0]).toMatchObject({ dayKey: '2026-07-01', focus: JULY_SHRUGS, volume: 100, pct: 1 })
    expect(cells[1]).toMatchObject({ dayKey: '2026-07-02', focus: JULY_SHRUGS, volume: 50, pct: 0.5 })
    // Jul 3: no sets logged — volume 0, pct 0
    expect(cells[2]).toMatchObject({ dayKey: '2026-07-03', focus: JULY_SHRUGS, volume: 0, pct: 0 })
  })

  it('counts set count (not reps) for target_kind = sets', () => {
    const setsFocus: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: 'sets-focus',
      target_kind: 'sets',
      daily_target: 3,
    }
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 30), // set 1: 30 reps
      setOn('shrugs', 2026, 6, 1, 25), // set 2: 25 reps
    ]
    const cells = buildFocusLaneCells([setsFocus], sets, 'upper', '2026-07-01')
    expect(cells[0].volume).toBe(2) // 2 sets, not 55 reps
    expect(cells[0].pct).toBeCloseTo(2 / 3)
  })

  it('emits explicit gap cells for days between focus windows', () => {
    // earlyFocus: upper, ends Jun 28 → gap Jun 29 & 30 → JULY_SHRUGS starts Jul 1
    const earlyFocus: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: 'early-upper',
      exercise: 'rows',
      start_date: '2026-06-01',
      end_date: '2026-06-28',
    }
    const cells = buildFocusLaneCells([earlyFocus, JULY_SHRUGS], [], 'upper', '2026-07-02')
    const gapCells = cells.filter((c) => c.focus === null)
    expect(gapCells).toHaveLength(2)
    expect(gapCells[0].dayKey).toBe('2026-06-29')
    expect(gapCells[1].dayKey).toBe('2026-06-30')
    // Cells outside the gap should have their focus
    const julyCells = cells.filter((c) => c.focus?.id === JULY_SHRUGS.id)
    expect(julyCells.map((c) => c.dayKey)).toEqual(['2026-07-01', '2026-07-02'])
  })

  it('ignores sets for other exercises and other lanes', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 80),        // correct
      setOn('pushups', 2026, 6, 1, 50),        // wrong exercise
      setOn('nordic-curls', 2026, 6, 1, 40),   // lower-lane exercise, not this lane
    ]
    // Both focuses present; asking for upper isolates shrugs
    const cells = buildFocusLaneCells([JULY_SHRUGS, JULY_NORDICS], sets, 'upper', '2026-07-01')
    expect(cells).toHaveLength(1)
    expect(cells[0].volume).toBe(80)
    expect(cells[0].pct).toBeCloseTo(0.8)
  })

  it('lower lane returns only lower-category focus data', () => {
    const sets: StrengthSet[] = [
      setOn('shrugs', 2026, 6, 1, 100),      // upper — ignored
      setOn('nordic-curls', 2026, 6, 1, 20), // lower — counted
    ]
    const cells = buildFocusLaneCells([JULY_SHRUGS, JULY_NORDICS], sets, 'lower', '2026-07-01')
    expect(cells[0].focus?.exercise).toBe('nordic-curls')
    expect(cells[0].volume).toBe(20)
    expect(cells[0].pct).toBeCloseTo(20 / 40)
  })

  it('does not exceed today even when end_date is later', () => {
    // JULY_SHRUGS ends Jul 31 but today is Jul 5
    const cells = buildFocusLaneCells([JULY_SHRUGS], [], 'upper', '2026-07-05')
    expect(cells[cells.length - 1].dayKey).toBe('2026-07-05')
    expect(cells).toHaveLength(5)
  })

  it('pct over 1 is allowed (over-day)', () => {
    const sets: StrengthSet[] = [setOn('shrugs', 2026, 6, 1, 200)] // 200 reps vs 100 target
    const cells = buildFocusLaneCells([JULY_SHRUGS], sets, 'upper', '2026-07-01')
    expect(cells[0].pct).toBe(2)
  })
})

describe('focusTargetHistory', () => {
  it('returns nothing for an exercise with no rotations', () => {
    expect(focusTargetHistory([JULY_SHRUGS], 'pushups')).toEqual([])
  })

  it('emits one point per window start, oldest first', () => {
    const octoberShrugs: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: '55555555-5555-4555-8555-555555555555',
      daily_target: 150,
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    }
    // Supplied newest-first to prove the sort.
    expect(focusTargetHistory([octoberShrugs, JULY_SHRUGS], 'shrugs')).toEqual([
      { daily_target: 100, effective_from: '2026-07-01' },
      { daily_target: 150, effective_from: '2026-10-01' },
    ])
  })

  it('skips a window with a non-positive target', () => {
    const broken: MonthlyFocus = { ...JULY_SHRUGS, daily_target: 0 }
    expect(focusTargetHistory([broken], 'shrugs')).toEqual([])
  })
})

describe('summarizeFocusCampaigns', () => {
  /** Two shrug days inside the July window: one hit (100), one miss (40). */
  const JULY_SETS: StrengthSet[] = [
    { id: 'a', logged_at: '2026-07-02T19:00:00Z', exercise: 'shrugs', reps: 100 },
    { id: 'b', logged_at: '2026-07-03T19:00:00Z', exercise: 'shrugs', reps: 40 },
  ]

  it('returns null for an exercise with no rotations', () => {
    expect(summarizeFocusCampaigns([JULY_SHRUGS], 'pushups', [], new Date('2026-08-15T19:00:00Z')))
      .toBeNull()
  })

  it('reports a closed rotation as inactive with its window fully elapsed', () => {
    const summary = summarizeFocusCampaigns(
      [JULY_SHRUGS],
      'shrugs',
      JULY_SETS,
      new Date('2026-08-15T19:00:00Z'),
    )
    expect(summary?.isActive).toBe(false)
    expect(summary?.rotations).toBe(1)
    expect(summary?.daysElapsed).toBe(31)
    expect(summary?.daysHit).toBe(1)
    expect(summary?.campaignReps).toBe(140)
  })

  it('reports an in-window rotation as active', () => {
    const summary = summarizeFocusCampaigns(
      [JULY_SHRUGS],
      'shrugs',
      JULY_SETS,
      new Date('2026-07-10T19:00:00Z'),
    )
    expect(summary?.isActive).toBe(true)
    expect(summary?.daysElapsed).toBe(10)
  })

  it('aggregates days and reps across multiple rotations', () => {
    const octoberShrugs: MonthlyFocus = {
      ...JULY_SHRUGS,
      id: '55555555-5555-4555-8555-555555555555',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    }
    const sets: StrengthSet[] = [
      ...JULY_SETS,
      { id: 'c', logged_at: '2026-10-02T19:00:00Z', exercise: 'shrugs', reps: 100 },
    ]
    const summary = summarizeFocusCampaigns(
      [JULY_SHRUGS, octoberShrugs],
      'shrugs',
      sets,
      new Date('2026-11-15T19:00:00Z'),
    )
    expect(summary?.rotations).toBe(2)
    expect(summary?.daysElapsed).toBe(62)
    expect(summary?.daysHit).toBe(2)
    expect(summary?.campaignReps).toBe(240)
    expect(summary?.latestWindowLabel).toContain('Oct')
  })

  it('excludes off-campaign sets from campaignReps', () => {
    const sets: StrengthSet[] = [
      ...JULY_SETS,
      // August shrugs, after the window closed — not part of the campaign.
      { id: 'd', logged_at: '2026-08-02T19:00:00Z', exercise: 'shrugs', reps: 500 },
    ]
    const summary = summarizeFocusCampaigns(
      [JULY_SHRUGS],
      'shrugs',
      sets,
      new Date('2026-09-01T19:00:00Z'),
    )
    expect(summary?.campaignReps).toBe(140)
  })
})
