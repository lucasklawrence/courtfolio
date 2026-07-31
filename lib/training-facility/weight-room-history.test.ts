import { describe, it, expect, vi, afterEach } from 'vitest'

import type { ExerciseGoal, MonthlyFocus, StrengthSet } from '@/types/weight-room'

import {
  buildStrengthHeatmap,
  buildWeeklyVolume,
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
    const apr14 = grid.flat().find(c => dayMatches(c, 2026, 3, 14))
    expect(apr14?.reps).toBe(45)
    expect(apr14?.setCount).toBe(2)
    expect(apr14?.pct).toBeCloseTo(0.45)
    const apr13 = grid.flat().find(c => dayMatches(c, 2026, 3, 13))
    expect(apr13?.reps).toBe(50)
    expect(apr13?.pct).toBeCloseTo(0.5)
  })

  it('ignores sets for other exercises', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets = [set('2026-04-14', 'pullups', 30), set('2026-04-14', 'dips', 30)]
    const { grid } = buildStrengthHeatmap(sets, PUSHUPS)
    expect(grid.flat().every(c => c.reps === 0)).toBe(true)
  })

  it('respects dateFrom / dateTo and clamps insanely wide ranges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { grid: small } = buildStrengthHeatmap(
      [],
      PUSHUPS,
      new Date(2026, 3, 1),
      new Date(2026, 3, 15)
    )
    expect(small[0].length).toBeGreaterThanOrEqual(2)
    expect(small[0].length).toBeLessThanOrEqual(4)

    const { grid: clamped } = buildStrengthHeatmap(
      [],
      PUSHUPS,
      new Date(2018, 0, 1),
      new Date(2026, 3, 15)
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
    expect(monthLabels.find(l => l.label === 'Apr')).toBeDefined()
  })
})

describe('buildWeeklyVolume', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits exactly `weeks` columns ending with the current week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15)) // Wed Apr 15
    const points = buildWeeklyVolume([], PUSHUPS, 8)
    expect(points).toHaveLength(8)
    // Every column opens on a Monday, oldest → newest.
    expect(points.every(p => p.weekStart.getDay() === 1)).toBe(true)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].weekStart.getTime()).toBeGreaterThan(points[i - 1].weekStart.getTime())
    }
    // Last column is the week containing "now" (Mon Apr 13 2026).
    const last = points[points.length - 1]
    expect(last.weekStart.getMonth()).toBe(3)
    expect(last.weekStart.getDate()).toBe(13)
    expect(last.label).toBe('4/13')
  })

  it('sums reps and counts sets per ISO week, bucketing by Monday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets = [
      set('2026-04-13', 'pushups', 40), // Mon — same week as...
      set('2026-04-15', 'pushups', 30), // ...Wed
      set('2026-04-06', 'pushups', 50), // prior week (Mon Apr 6)
    ]
    const points = buildWeeklyVolume(sets, PUSHUPS, 4)
    const current = points.find(p => p.weekKey === '2026-04-13')
    expect(current?.reps).toBe(70)
    expect(current?.setCount).toBe(2)
    const prior = points.find(p => p.weekKey === '2026-04-06')
    expect(prior?.reps).toBe(50)
    expect(prior?.setCount).toBe(1)
  })

  it('back-fills weeks with no sets as zero', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const points = buildWeeklyVolume([set('2026-04-13', 'pushups', 40)], PUSHUPS, 4)
    const empties = points.filter(p => p.reps === 0)
    expect(empties).toHaveLength(3)
    expect(points.reduce((acc, p) => acc + p.reps, 0)).toBe(40)
  })

  it('ignores other exercises and unparseable timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sets: StrengthSet[] = [
      set('2026-04-13', 'pullups', 30),
      { id: 'bad', logged_at: 'not-a-date', exercise: 'pushups', reps: 99 },
      set('2026-04-13', 'pushups', 25),
    ]
    const points = buildWeeklyVolume(sets, PUSHUPS, 4)
    expect(points.reduce((acc, p) => acc + p.reps, 0)).toBe(25)
  })

  it('clamps a sub-1 week count to a single column', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    expect(buildWeeklyVolume([], PUSHUPS, 0)).toHaveLength(1)
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
    const sets = [set('2026-04-10', 'pushups', 100), set('2026-04-11', 'pushups', 100)]
    const result = computeStrengthStreaks(sets, PUSHUPS)
    expect(result.current).toBe(0)
    expect(result.longest).toBe(2)
  })

  it('ignores sets for other exercises', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sets = [set('2026-04-15', 'pullups', 100), set('2026-04-16', 'pullups', 100)]
    expect(computeStrengthStreaks(sets, PUSHUPS)).toEqual({ current: 0, longest: 0 })
  })

  it('honors the optional `now` arg for the today / yesterday anchor', () => {
    // Real clock is May 7 2026, but we anchor "today" to Apr 16 — the
    // current streak should treat Apr 14–16 as fresh, not stale.
    const now = new Date('2026-04-16T12:00:00')
    const sets = [
      set('2026-04-14', 'pushups', 100),
      set('2026-04-15', 'pushups', 100),
      set('2026-04-16', 'pushups', 100),
    ]
    expect(computeStrengthStreaks(sets, PUSHUPS, now)).toEqual({ current: 3, longest: 3 })
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
    expect(stats.map(s => s.exercise)).toEqual(['pushups', 'pullups'])
    expect(stats[1].color).toBe('#0EA5A1')
    expect(stats[1].thisWeekReps).toBe(30)
  })

  it('returns an empty array when no goals are configured (sets ignored)', () => {
    const now = new Date('2026-04-16T12:00:00')
    const sets = [set('2026-04-16', 'pushups', 50)]
    expect(computeStrengthStats(sets, [], now)).toEqual([])
  })

  it('threads `now` into streak math (not just week/month math)', () => {
    // Real clock is May 7 2026 by the time this PR ran — without
    // threading `now` into `computeStrengthStreaks`, `current` would
    // come back 0 because Apr 16 is older than yesterday.
    const now = new Date('2026-04-16T12:00:00')
    const sets = [set('2026-04-15', 'pushups', 100), set('2026-04-16', 'pushups', 100)]
    const [stats] = computeStrengthStats(sets, [PUSHUPS], now)
    expect(stats.currentStreak).toBe(2)
    expect(stats.longestStreak).toBe(2)
  })
})

/**
 * Effective-dated target coverage (#362). The scenario throughout is the
 * issue's: pullups at 30, raised to 50 effective Aug 1. Everything before
 * that boundary must stay scored against 30.
 */
describe('effective-dated targets (#362)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Pullups seeded at 30, raised to 50 on Aug 1. */
  const PULLUPS_RAISED: ExerciseGoal = {
    exercise: 'pullups',
    daily_target: 50,
    color: '#0EA5A1',
    target_history: [
      { daily_target: 30, effective_from: '2026-05-01' },
      { daily_target: 50, effective_from: '2026-08-01' },
    ],
  }

  /** Pullups lowered 50 -> 30 on Aug 1 — the symmetric case. */
  const PULLUPS_LOWERED: ExerciseGoal = {
    exercise: 'pullups',
    daily_target: 30,
    color: '#0EA5A1',
    target_history: [
      { daily_target: 50, effective_from: '2026-05-01' },
      { daily_target: 30, effective_from: '2026-08-01' },
    ],
  }

  /** Find the heatmap cell for a given local date key. */
  function cellFor(
    grid: ReturnType<typeof buildStrengthHeatmap>,
    dateKey: string,
  ): { reps: number; pct: number; dailyTarget: number } | undefined {
    for (const row of grid.grid) {
      for (const cell of row) {
        const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`
        if (key === dateKey) return cell
      }
    }
    return undefined
  }

  it('scores a pre-change heatmap cell against the old target', () => {
    // 30 reps on Jul 15 was a full day against a 30 goal. After raising the
    // goal to 50 it must still read as 100%, not 60%.
    const sets = [set('2026-07-15', 'pullups', 30)]
    const grid = buildStrengthHeatmap(
      sets,
      PULLUPS_RAISED,
      new Date('2026-07-01T12:00:00'),
      new Date('2026-08-31T12:00:00'),
    )
    const cell = cellFor(grid, '2026-07-15')
    expect(cell?.reps).toBe(30)
    expect(cell?.dailyTarget).toBe(30)
    expect(cell?.pct).toBe(1)
    expect(intensityFromPct(cell!.pct)).toBe(3)
  })

  it('scores a post-change heatmap cell against the new target', () => {
    const sets = [set('2026-08-15', 'pullups', 40)]
    const grid = buildStrengthHeatmap(
      sets,
      PULLUPS_RAISED,
      new Date('2026-07-01T12:00:00'),
      new Date('2026-08-31T12:00:00'),
    )
    const cell = cellFor(grid, '2026-08-15')
    expect(cell?.dailyTarget).toBe(50)
    expect(cell?.pct).toBe(0.8)
    expect(intensityFromPct(cell!.pct)).toBe(2)
  })

  it('computes a streak across the boundary with no false break', () => {
    // 30 reps/day Jul 30-31 (hits the 30 goal), 50 reps/day Aug 1-2 (hits
    // the raised 50 goal). All four days are hits, so the streak is 4.
    const sets = [
      set('2026-07-30', 'pullups', 30),
      set('2026-07-31', 'pullups', 30),
      set('2026-08-01', 'pullups', 50),
      set('2026-08-02', 'pullups', 50),
    ]
    const streak = computeStrengthStreaks(sets, PULLUPS_RAISED, new Date('2026-08-02T12:00:00'))
    expect(streak.current).toBe(4)
    expect(streak.longest).toBe(4)
  })

  it('breaks the streak on a post-change day that misses the raised target', () => {
    // Aug 1 has 30 reps — enough for the old goal, short of the new one, so
    // it must not count as a hit. Anchoring "now" at Aug 2 puts the last hit
    // (Jul 31) outside the today/yesterday grace window, so the break shows
    // up in `current` rather than being masked by it.
    const sets = [
      set('2026-07-30', 'pullups', 30),
      set('2026-07-31', 'pullups', 30),
      set('2026-08-01', 'pullups', 30),
    ]
    const streak = computeStrengthStreaks(sets, PULLUPS_RAISED, new Date('2026-08-02T12:00:00'))
    expect(streak.current).toBe(0)
    expect(streak.longest).toBe(2)
  })

  it('keeps the streak alive under the grace period when today has not yet cleared the new bar', () => {
    // Same data, anchored at Aug 1: Jul 31 is "yesterday" and still a hit, so
    // the streak is legitimately alive at 2 even though today falls short.
    const sets = [
      set('2026-07-30', 'pullups', 30),
      set('2026-07-31', 'pullups', 30),
      set('2026-08-01', 'pullups', 30),
    ]
    const streak = computeStrengthStreaks(sets, PULLUPS_RAISED, new Date('2026-08-01T12:00:00'))
    expect(streak.current).toBe(2)
    expect(streak.longest).toBe(2)
  })

  it('does not retroactively credit past days when a target is lowered', () => {
    // 40 reps on Jul 15 missed the 50 goal in force at the time. Lowering
    // the goal to 30 in August must not turn it into a hit.
    const sets = [set('2026-07-15', 'pullups', 40), set('2026-08-15', 'pullups', 40)]
    const streak = computeStrengthStreaks(sets, PULLUPS_LOWERED, new Date('2026-08-15T12:00:00'))
    expect(streak.current).toBe(1)
    expect(streak.longest).toBe(1)
  })

  it('surfaces the change on the stats payload and keeps dailyTarget current', () => {
    const sets = [set('2026-07-15', 'pullups', 30)]
    const [stats] = computeStrengthStats(sets, [PULLUPS_RAISED], new Date('2026-08-15T12:00:00'))
    expect(stats.dailyTarget).toBe(50)
    expect(stats.targetChanges).toEqual([
      { from: 30, to: 50, effective_from: '2026-08-01' },
    ])
  })

  it('leaves a goal with no history scored exactly as before', () => {
    const sets = [set('2026-04-15', 'pushups', 100), set('2026-04-16', 'pushups', 100)]
    const streak = computeStrengthStreaks(sets, PUSHUPS, new Date('2026-04-16T12:00:00'))
    expect(streak).toEqual({ current: 2, longest: 2 })
    const [stats] = computeStrengthStats(sets, [PUSHUPS], new Date('2026-04-16T12:00:00'))
    expect(stats.targetChanges).toEqual([])
  })
})

/**
 * Focus-anchored exercises in the stats panel (#367). A focus's real bar is
 * its rotation's `daily_target`, scoped to the window — not the anchor goal's
 * scalar — so scoring has to run through the synthesized window history.
 */
describe('computeStrengthStats with focus rotations (#367)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Anchor goal for a focus exercise; its scalar deliberately differs from the window target. */
  const SHRUGS_ANCHOR: ExerciseGoal = {
    exercise: 'shrugs',
    daily_target: 500,
    color: '#C9A268',
    kind: 'focus',
  }

  /** July shrugs at 100/day. */
  const JULY_SHRUGS: MonthlyFocus = {
    id: 'f1',
    exercise: 'shrugs',
    daily_target: 100,
    target_kind: 'reps',
    color: '#C9A268',
    category: 'upper',
    start_date: '2026-07-01',
    end_date: '2026-07-31',
  }

  it('scores focus days against the window target, not the anchor scalar', () => {
    // 100 reps clears the window's 100 target but not the anchor's 500. With
    // the anchor scalar it would read as a miss.
    const sets = [set('2026-07-15', 'shrugs', 100)]
    const [stats] = computeStrengthStats(
      sets,
      [SHRUGS_ANCHOR],
      new Date('2026-07-16T12:00:00'),
      [JULY_SHRUGS],
    )
    expect(stats.longestStreak).toBe(1)
  })

  it('falls back to the anchor scalar when no focuses are supplied', () => {
    const sets = [set('2026-07-15', 'shrugs', 100)]
    const [stats] = computeStrengthStats(sets, [SHRUGS_ANCHOR], new Date('2026-07-16T12:00:00'))
    // 100 < the anchor's 500, so no hit day — the pre-#367 reading.
    expect(stats.longestStreak).toBe(0)
    expect(stats.focus).toBeUndefined()
  })

  it('attaches a campaign summary marked inactive once the window closes', () => {
    const sets = [set('2026-07-15', 'shrugs', 100)]
    const [stats] = computeStrengthStats(
      sets,
      [SHRUGS_ANCHOR],
      new Date('2026-08-15T12:00:00'),
      [JULY_SHRUGS],
    )
    expect(stats.focus?.isActive).toBe(false)
    expect(stats.focus?.rotations).toBe(1)
    expect(stats.focus?.campaignReps).toBe(100)
  })

  it('marks the campaign active while the window covers today', () => {
    const [stats] = computeStrengthStats(
      [set('2026-07-15', 'shrugs', 100)],
      [SHRUGS_ANCHOR],
      new Date('2026-07-20T12:00:00'),
      [JULY_SHRUGS],
    )
    expect(stats.focus?.isActive).toBe(true)
  })

  it('leaves permanent goals untouched when focuses are supplied', () => {
    const sets = [set('2026-04-15', 'pushups', 100), set('2026-04-16', 'pushups', 100)]
    const [stats] = computeStrengthStats(
      sets,
      [PUSHUPS],
      new Date('2026-04-16T12:00:00'),
      [JULY_SHRUGS],
    )
    expect(stats.focus).toBeUndefined()
    expect(stats.currentStreak).toBe(2)
  })
})
