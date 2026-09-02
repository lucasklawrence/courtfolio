import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { computeStrengthStreaks } from './strength-streaks'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}
const PULLUPS: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
}

/** Compact set factory — `{ exercise, dayKey, reps }`. */
function s(exercise: string, dayKey: string, reps: number): StrengthSet {
  return {
    id: `${exercise}-${dayKey}-${reps}`,
    logged_at: `${dayKey}T13:00:00`,
    exercise,
    reps,
  }
}

describe('computeStrengthStreaks', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0/0 for every goal when no sets exist', () => {
    expect(computeStrengthStreaks([], [PUSHUPS, PULLUPS])).toEqual({
      pushups: { current: 0, longest: 0 },
      pullups: { current: 0, longest: 0 },
    })
  })

  it('counts a 1-day current streak when today hits the goal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const result = computeStrengthStreaks([s('pushups', '2026-05-07', 100)], [PUSHUPS])
    expect(result.pushups).toEqual({ current: 1, longest: 1 })
  })

  it('does not count under-target days toward the streak', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const result = computeStrengthStreaks([s('pushups', '2026-05-07', 99)], [PUSHUPS])
    expect(result.pushups).toEqual({ current: 0, longest: 0 })
  })

  it('counts consecutive goal-hit calendar days as one run', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-04', 100),
      s('pushups', '2026-05-05', 100),
      s('pushups', '2026-05-06', 110),
      s('pushups', '2026-05-07', 100),
    ]
    expect(computeStrengthStreaks(sets, [PUSHUPS]).pushups).toEqual({
      current: 4,
      longest: 4,
    })
  })

  it('sums multiple sets on the same day toward the goal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-07', 40),
      s('pushups', '2026-05-07', 35),
      s('pushups', '2026-05-07', 30),
    ]
    expect(computeStrengthStreaks(sets, [PUSHUPS]).pushups).toEqual({
      current: 1,
      longest: 1,
    })
  })

  it('breaks the streak on a missed day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-01', 100),
      s('pushups', '2026-05-02', 100),
      s('pushups', '2026-05-03', 100),
      // missed 5/4 + 5/5
      s('pushups', '2026-05-06', 100),
      s('pushups', '2026-05-07', 100),
    ]
    const result = computeStrengthStreaks(sets, [PUSHUPS]).pushups
    expect(result.current).toBe(2)
    expect(result.longest).toBe(3)
  })

  it('keeps current at 0 when the latest goal-hit day is older than yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-01', 100),
      s('pushups', '2026-05-02', 100),
      s('pushups', '2026-05-03', 100),
    ]
    const result = computeStrengthStreaks(sets, [PUSHUPS]).pushups
    expect(result.current).toBe(0)
    expect(result.longest).toBe(3)
  })

  it('counts yesterday-as-current when today has no goal-hit yet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-05', 100),
      s('pushups', '2026-05-06', 100),
      s('pushups', '2026-05-07', 50), // not a hit
    ]
    const result = computeStrengthStreaks(sets, [PUSHUPS]).pushups
    expect(result.current).toBe(2)
    expect(result.longest).toBe(2)
  })

  it('computes streaks independently per exercise', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      s('pushups', '2026-05-06', 100),
      s('pushups', '2026-05-07', 100),
      s('pullups', '2026-05-07', 30),
    ]
    const result = computeStrengthStreaks(sets, [PUSHUPS, PULLUPS])
    expect(result.pushups).toEqual({ current: 2, longest: 2 })
    expect(result.pullups).toEqual({ current: 1, longest: 1 })
  })

  it('ignores sets whose timestamps cannot be parsed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const sets = [
      { ...s('pushups', '2026-05-07', 100), logged_at: 'not-a-date' },
      s('pushups', '2026-05-07', 100),
    ]
    const result = computeStrengthStreaks(sets, [PUSHUPS]).pushups
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
  })

  it('returns 0/0 for goals with non-positive daily_target', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T13:00:00'))
    const broken: ExerciseGoal = { exercise: 'pushups', daily_target: 0, color: '#EA580C' }
    const sets = [s('pushups', '2026-05-07', 100)]
    expect(computeStrengthStreaks(sets, [broken]).pushups).toEqual({
      current: 0,
      longest: 0,
    })
  })
})

/**
 * Effective-dated target coverage (#362) for the multi-goal streak path.
 * Mirrors the single-goal cases in `weight-room-history.test.ts` — the two
 * implementations must agree on what counts as a hit day.
 */
describe('computeStrengthStreaks with effective-dated targets (#362)', () => {
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

  it('counts a pre-change day against the old target', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00'))
    const result = computeStrengthStreaks([s('pullups', '2026-07-15', 30)], [PULLUPS_RAISED])
    // 30 reps cleared the 30 goal live that day, so it stays a hit even
    // though the goal is now 50.
    expect(result.pullups).toEqual({ current: 1, longest: 1 })
  })

  it('does not count a post-change day that only clears the old target', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-16T12:00:00'))
    const result = computeStrengthStreaks([s('pullups', '2026-08-15', 30)], [PULLUPS_RAISED])
    expect(result.pullups).toEqual({ current: 0, longest: 0 })
  })

  it('runs a streak across the boundary without a false break', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T12:00:00'))
    const result = computeStrengthStreaks(
      [
        s('pullups', '2026-07-31', 30),
        s('pullups', '2026-08-01', 50),
        s('pullups', '2026-08-02', 50),
      ],
      [PULLUPS_RAISED]
    )
    expect(result.pullups).toEqual({ current: 3, longest: 3 })
  })

  it('leaves a goal with no history scored exactly as before', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00'))
    const result = computeStrengthStreaks(
      [s('pushups', '2026-07-15', 100), s('pushups', '2026-07-16', 100)],
      [PUSHUPS]
    )
    expect(result.pushups).toEqual({ current: 2, longest: 2 })
  })
})
