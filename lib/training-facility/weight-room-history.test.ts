import { describe, it, expect, vi, afterEach } from 'vitest'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import {
  buildStrengthHeatmap,
  computeStrengthStats,
  computeStrengthStreaks,
  intensityFromPct,
} from './weight-room-history'

/**
 * Local helper — minimal {@link StrengthSet} for a given local date and
 * exercise. Tests build a synthetic Supabase-shape row without restating
 * the whole contract per case.
 */
function set(dateStr: string, exercise: string, reps: number, hour = 8): StrengthSet {
  return {
    id: `${dateStr}-${exercise}-${reps}-${hour}`,
    logged_at: `${dateStr}T${String(hour).padStart(2, '0')}:00:00`,
    exercise,
    reps,
  }
}

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}

describe('intensityFromPct', () => {
  it('buckets 0% as level 0', () => {
    expect(intensityFromPct(0)).toBe(0)
    expect(intensityFromPct(-0.5)).toBe(0)
  })
  it('buckets 1–49% as level 1', () => {
    expect(intensityFromPct(0.01)).toBe(1)
    expect(intensityFromPct(0.49)).toBe(1)
  })
  it('buckets 50–99% as level 2', () => {
    expect(intensityFromPct(0.5)).toBe(2)
    expect(intensityFromPct(0.99)).toBe(2)
  })
  it('buckets 100%+ as level 3', () => {
    expect(intensityFromPct(1)).toBe(3)
    expect(intensityFromPct(1.5)).toBe(3)
  })
})

describe('buildStrengthHeatmap', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 7 rows starting on a Monday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15)) // Wed Apr 15
    const { grid } = buildStrengthHeatmap([], PUSHUPS)
    expect(grid).toHaveLength(7)
    expect(grid[0][0].date.getDay()).toBe(1)
  })

  it('aggregates reps and set counts per local day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets = [
      set('2026-04-14', 'pushups', 20, 8),
      set('2026-04-14', 'pushups', 25, 18),
      set('2026-04-14', 'pullups', 5),
      set('2026-04-13', 'pushups', 50),
    ]
    const { grid } = buildStrengthHeatmap(sets, PUSHUPS)
    // Match by full year/month/day — the trailing 52-week range covers
    // both Apr 14 2025 and Apr 14 2026, and only the latter has sets.
    const dayMatches = (cell: { date: Date }, year: number, month0: number, day: number) =>
      cell.date.getFullYear() === year &&
      cell.date.getMonth() === month0 &&
      cell.date.getDate() === day
    const apr14 = grid.flat().find((c) => dayMatches(c, 2026, 3, 14))
    expect(apr14?.reps).toBe(45)
    expect(apr14?.setCount).toBe(2)
    expect(apr14?.pct).toBeCloseTo(0.45)
    const apr13 = grid.flat().find((c) => dayMatches(c, 2026, 3, 13))
    expect(apr13?.reps).toBe(50)
    expect(apr13?.pct).toBeCloseTo(0.5)
  })

  it('ignores sets for other exercises', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets = [set('2026-04-14', 'pullups', 30), set('2026-04-14', 'dips', 30)]
    const { grid } = buildStrengthHeatmap(sets, PUSHUPS)
    expect(grid.flat().every((c) => c.reps === 0)).toBe(true)
  })

  it('respects dateFrom / dateTo and clamps insanely wide ranges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { grid: small } = buildStrengthHeatmap(
      [],
      PUSHUPS,
      new Date(2026, 3, 1),
      new Date(2026, 3, 15),
    )
    expect(small[0].length).toBeGreaterThanOrEqual(2)
    expect(small[0].length).toBeLessThanOrEqual(4)

    const { grid: clamped } = buildStrengthHeatmap(
      [],
      PUSHUPS,
      new Date(2018, 0, 1),
      new Date(2026, 3, 15),
    )
    expect(clamped[0].length).toBeLessThanOrEqual(105)
  })

  it('skips sets with unparseable timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets: StrengthSet[] = [
      { id: 'bad', logged_at: 'not-a-date', exercise: 'pushups', reps: 50 },
      set('2026-04-14', 'pushups', 50),
    ]
    const { grid } = buildStrengthHeatmap(sets, PUSHUPS)
    const totalReps = grid.flat().reduce((acc, c) => acc + c.reps, 0)
    expect(totalReps).toBe(50)
  })

  it('emits month labels for every visible month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { monthLabels } = buildStrengthHeatmap([], PUSHUPS)
    expect(monthLabels.length).toBeGreaterThan(0)
    expect(monthLabels.find((l) => l.label === 'Apr')).toBeDefined()
  })
})

describe('computeStrengthStreaks', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0/0 with no sets', () => {
    expect(computeStrengthStreaks([], PUSHUPS)).toEqual({ current: 0, longest: 0 })
  })

  it('counts only days that hit the daily target', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    // Apr 12: 99 (under), Apr 13: 100, Apr 14: 50+50=100, Apr 15: 80 (under), Apr 16: 200
    const sets = [
      set('2026-04-12', 'pushups', 99),
      set('2026-04-13', 'pushups', 100),
      set('2026-04-14', 'pushups', 50, 8),
      set('2026-04-14', 'pushups', 50, 18),
      set('2026-04-15', 'pushups', 80),
      set('2026-04-16', 'pushups', 200),
    ]
    const result = computeStrengthStreaks(sets, PUSHUPS)
    // Hit days: 13, 14, 16. Current = 1 (today = 16, yesterday = 15 missed)
    expect(result.current).toBe(1)
    // Longest run = 2 (Apr 13–14)
    expect(result.longest).toBe(2)
  })

  it('counts yesterday when today is not yet logged', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sets = [
      set('2026-04-13', 'pushups', 100),
      set('2026-04-14', 'pushups', 100),
      set('2026-04-15', 'pushups', 100),
    ]
    const result = computeStrengthStreaks(sets, PUSHUPS)
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3)
  })

  it('current is 0 when last hit-day is older than yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sets = [
      set('2026-04-10', 'pushups', 100),
      set('2026-04-11', 'pushups', 100),
    ]
    const result = computeStrengthStreaks(sets, PUSHUPS)
    expect(result.current).toBe(0)
    expect(result.longest).toBe(2)
  })

  it('ignores sets for other exercises', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sets = [
      set('2026-04-15', 'pullups', 100),
      set('2026-04-16', 'pullups', 100),
    ]
    expect(computeStrengthStreaks(sets, PUSHUPS)).toEqual({ current: 0, longest: 0 })
  })
})

describe('computeStrengthStats', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zeroed entries for goals with no matching sets', () => {
    const now = new Date('2026-04-16T12:00:00')
    const stats = computeStrengthStats([], [PUSHUPS], now)
    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      exercise: 'pushups',
      color: '#EA580C',
      dailyTarget: 100,
      currentStreak: 0,
      longestStreak: 0,
      thisWeekReps: 0,
      lastWeekReps: 0,
      thisMonthReps: 0,
      lastMonthReps: 0,
      avgSetsPerActiveDay: 0,
      allTimeReps: 0,
    })
  })

  it('rolls up reps by ISO week (Mon–Sun) and calendar month', () => {
    const now = new Date('2026-04-16T12:00:00') // Thu Apr 16, 2026
    // This week (Mon Apr 13 – Sun Apr 19): 100 + 50 = 150
    // Last week (Mon Apr 6 – Sun Apr 12): 80
    // This month (Apr): 100 + 50 + 80 = 230
    // Last month (Mar): 200
    const sets = [
      set('2026-03-15', 'pushups', 200),
      set('2026-04-08', 'pushups', 80),
      set('2026-04-13', 'pushups', 100),
      set('2026-04-16', 'pushups', 50),
    ]
    const [stats] = computeStrengthStats(sets, [PUSHUPS], now)
    expect(stats.thisWeekReps).toBe(150)
    expect(stats.lastWeekReps).toBe(80)
    expect(stats.thisMonthReps).toBe(230)
    expect(stats.lastMonthReps).toBe(200)
    expect(stats.allTimeReps).toBe(430)
  })

  it('averages sets across active days only (multi-set days count once)', () => {
    const now = new Date('2026-04-16T12:00:00')
    const sets = [
      set('2026-04-14', 'pushups', 25, 8),
      set('2026-04-14', 'pushups', 25, 12),
      set('2026-04-14', 'pushups', 25, 18),
      set('2026-04-15', 'pushups', 30),
    ]
    const [stats] = computeStrengthStats(sets, [PUSHUPS], now)
    // 4 sets across 2 active days = 2.0 avg
    expect(stats.avgSetsPerActiveDay).toBe(2)
  })

  it('returns one entry per goal in input order', () => {
    const now = new Date('2026-04-16T12:00:00')
    const goals: ExerciseGoal[] = [
      PUSHUPS,
      { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' },
    ]
    const sets = [set('2026-04-16', 'pullups', 30), set('2026-04-16', 'pushups', 50)]
    const stats = computeStrengthStats(sets, goals, now)
    expect(stats.map((s) => s.exercise)).toEqual(['pushups', 'pullups'])
    expect(stats[1].color).toBe('#0EA5A1')
    expect(stats[1].thisWeekReps).toBe(30)
  })

  it('returns an empty array when no goals are configured (sets ignored)', () => {
    const now = new Date('2026-04-16T12:00:00')
    const sets = [set('2026-04-16', 'pushups', 50)]
    expect(computeStrengthStats(sets, [], now)).toEqual([])
  })
})
