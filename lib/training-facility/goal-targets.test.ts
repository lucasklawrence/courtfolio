import { describe, expect, it } from 'vitest'

import type { ExerciseGoal } from '@/types/weight-room'

import {
  describeGoalTargetChange,
  formatGoalTargetChange,
  formatGoalTargetDate,
  currentTarget,
  goalTargetChanges,
  scheduledGoalTargetChanges,
  targetForDay,
  targetResolverFor,
} from './goal-targets'

/**
 * Unit tests for effective-dated goal targets (#362). The scenario driving
 * most cases is the one from the issue: pullups at 30, raised to 50 effective
 * Aug 1. July days must keep scoring against 30 and August days against 50.
 */

/** Pullups with no recorded history — the pre-#362 shape. */
const NO_HISTORY: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
}

/** Pullups seeded at 30, raised to 50 on Aug 1. */
const RAISED: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 50,
  color: '#0EA5A1',
  target_history: [
    { daily_target: 30, effective_from: '2026-05-01' },
    { daily_target: 50, effective_from: '2026-08-01' },
  ],
}

/** Pullups lowered 50 -> 30 on Aug 1 — the symmetric case. */
const LOWERED: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
  target_history: [
    { daily_target: 50, effective_from: '2026-05-01' },
    { daily_target: 30, effective_from: '2026-08-01' },
  ],
}

/** Three changes, supplied out of order to exercise the internal sort. */
const MULTI_CHANGE: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 200,
  color: '#EA580C',
  target_history: [
    { daily_target: 150, effective_from: '2026-06-01' },
    { daily_target: 200, effective_from: '2026-09-01' },
    { daily_target: 100, effective_from: '2026-03-01' },
  ],
}

describe('targetForDay', () => {
  it('falls back to daily_target for every day when there is no history', () => {
    expect(targetForDay(NO_HISTORY, '2020-01-01')).toBe(30)
    expect(targetForDay(NO_HISTORY, '2026-07-15')).toBe(30)
    expect(targetForDay(NO_HISTORY, '2099-12-31')).toBe(30)
  })

  it('treats an empty history array the same as no history', () => {
    const goal: ExerciseGoal = { ...NO_HISTORY, target_history: [] }
    expect(targetForDay(goal, '2026-07-15')).toBe(30)
  })

  it('scores a day before the change against the old target', () => {
    expect(targetForDay(RAISED, '2026-07-15')).toBe(30)
    expect(targetForDay(RAISED, '2026-07-31')).toBe(30)
  })

  it('scores the boundary day itself against the new target (effective_from is inclusive)', () => {
    expect(targetForDay(RAISED, '2026-08-01')).toBe(50)
  })

  it('scores days after the change against the new target', () => {
    expect(targetForDay(RAISED, '2026-08-02')).toBe(50)
    expect(targetForDay(RAISED, '2027-01-01')).toBe(50)
  })

  it('returns the earliest known target for a day before the first entry', () => {
    // Backdated set / manually inserted future goal. Scoring against the
    // oldest known bar beats dividing by zero.
    expect(targetForDay(RAISED, '2026-04-30')).toBe(30)
    expect(targetForDay(RAISED, '1999-01-01')).toBe(30)
  })

  it('returns the current target for an empty day key rather than the ancient one', () => {
    // '' sorts before every real date, so a naive scan would take the
    // before-earliest branch and score "today" against the oldest target.
    expect(targetForDay(RAISED, '')).toBe(50)
  })

  it('is symmetric when a target is lowered — past days are not retroactively credited', () => {
    expect(targetForDay(LOWERED, '2026-07-15')).toBe(50)
    expect(targetForDay(LOWERED, '2026-08-01')).toBe(30)
  })

  it('resolves across multiple changes regardless of input order', () => {
    expect(targetForDay(MULTI_CHANGE, '2026-02-01')).toBe(100) // before first
    expect(targetForDay(MULTI_CHANGE, '2026-03-01')).toBe(100) // on first
    expect(targetForDay(MULTI_CHANGE, '2026-05-31')).toBe(100)
    expect(targetForDay(MULTI_CHANGE, '2026-06-01')).toBe(150)
    expect(targetForDay(MULTI_CHANGE, '2026-08-31')).toBe(150)
    expect(targetForDay(MULTI_CHANGE, '2026-09-01')).toBe(200)
    expect(targetForDay(MULTI_CHANGE, '2027-06-01')).toBe(200)
  })

  it('clamps a non-positive stored target to 1 so callers never divide by zero', () => {
    const broken: ExerciseGoal = {
      exercise: 'pullups',
      daily_target: 0,
      color: '#0EA5A1',
      target_history: [{ daily_target: 0, effective_from: '2026-05-01' }],
    }
    expect(targetForDay(broken, '2026-07-15')).toBe(1)
    expect(targetForDay(broken, '')).toBe(1)
  })

  it('does not mutate the caller-supplied history array', () => {
    const history = [...MULTI_CHANGE.target_history!]
    targetForDay(MULTI_CHANGE, '2026-07-15')
    expect(MULTI_CHANGE.target_history).toEqual(history)
  })
})

describe('targetResolverFor', () => {
  it('resolves identically to targetForDay across a change', () => {
    const resolve = targetResolverFor(RAISED)
    for (const day of ['2026-04-30', '2026-07-31', '2026-08-01', '2026-08-02', '']) {
      expect(resolve(day)).toBe(targetForDay(RAISED, day))
    }
  })

  it('returns the current target for every day when there is no history', () => {
    const resolve = targetResolverFor(NO_HISTORY)
    expect(resolve('2020-01-01')).toBe(30)
    expect(resolve('2026-08-01')).toBe(30)
  })

  it('clamps a non-positive current target when there is no history', () => {
    const resolve = targetResolverFor({ ...NO_HISTORY, daily_target: 0 })
    expect(resolve('2026-07-15')).toBe(1)
  })
})

describe('goalTargetChanges', () => {
  it('returns nothing for a goal with no history', () => {
    expect(goalTargetChanges(NO_HISTORY)).toEqual([])
  })

  it('returns nothing for a goal that has only its seed entry', () => {
    const seeded: ExerciseGoal = {
      ...NO_HISTORY,
      target_history: [{ daily_target: 30, effective_from: '2026-05-01' }],
    }
    expect(goalTargetChanges(seeded)).toEqual([])
  })

  it('emits one change per move, with the old and new targets', () => {
    expect(goalTargetChanges(RAISED)).toEqual([{ from: 30, to: 50, effective_from: '2026-08-01' }])
  })

  it('emits changes oldest-first regardless of input order', () => {
    expect(goalTargetChanges(MULTI_CHANGE)).toEqual([
      { from: 100, to: 150, effective_from: '2026-06-01' },
      { from: 150, to: 200, effective_from: '2026-09-01' },
    ])
  })

  it('skips a same-value re-save so no "30 -> 30" marker is drawn', () => {
    const noop: ExerciseGoal = {
      ...NO_HISTORY,
      target_history: [
        { daily_target: 30, effective_from: '2026-05-01' },
        { daily_target: 30, effective_from: '2026-06-01' },
        { daily_target: 50, effective_from: '2026-07-01' },
      ],
    }
    expect(goalTargetChanges(noop)).toEqual([{ from: 30, to: 50, effective_from: '2026-07-01' }])
  })
})

describe('formatGoalTargetChange', () => {
  it('renders a compact arrow label without the date', () => {
    expect(formatGoalTargetChange({ from: 30, to: 50, effective_from: '2026-08-01' })).toBe(
      '30 → 50'
    )
  })
})

describe('formatGoalTargetDate', () => {
  it('renders a short month/day label', () => {
    expect(formatGoalTargetDate({ from: 30, to: 50, effective_from: '2026-08-01' })).toBe('Aug 1')
  })

  it('does not shift the day for viewers behind UTC', () => {
    // Parsed at local noon, so a negative UTC offset can't roll the label
    // back to Jul 31.
    expect(formatGoalTargetDate({ from: 30, to: 50, effective_from: '2026-01-01' })).toBe('Jan 1')
  })

  it('falls back to the raw key when the date will not parse', () => {
    expect(formatGoalTargetDate({ from: 30, to: 50, effective_from: 'not-a-date' })).toBe(
      'not-a-date'
    )
  })
})

describe('describeGoalTargetChange', () => {
  it('combines the arrow label and the effective date', () => {
    expect(describeGoalTargetChange({ from: 30, to: 50, effective_from: '2026-08-01' })).toBe(
      '30 → 50 on Aug 1'
    )
  })
})

describe('scheduled goal target changes (#371)', () => {
  const goal = (history: { daily_target: number; effective_from: string }[]): ExerciseGoal => ({
    exercise: 'pullups',
    daily_target: 30,
    color: '#0EA5A1',
    target_history: history,
  })

  describe('goalTargetChanges with todayKey', () => {
    it('excludes a change that has not taken effect yet', () => {
      // Rendering it would draw a heatmap marker on a week that hasn't
      // happened, implying data that doesn't exist.
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
      ])
      expect(goalTargetChanges(g, '2026-08-15')).toEqual([])
    })

    it('includes it once the date arrives', () => {
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
      ])
      expect(goalTargetChanges(g, '2026-09-01')).toEqual([
        { from: 30, to: 50, effective_from: '2026-09-01' },
      ])
    })

    it('returns every change when no todayKey is given', () => {
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
      ])
      expect(goalTargetChanges(g)).toHaveLength(1)
    })
  })

  describe('scheduledGoalTargetChanges', () => {
    it('reports a queued change against the target it replaces', () => {
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
      ])
      expect(scheduledGoalTargetChanges(g, '2026-08-15')).toEqual([
        { from: 30, to: 50, effective_from: '2026-09-01' },
      ])
    })

    it('is empty once the change is in effect', () => {
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
      ])
      expect(scheduledGoalTargetChanges(g, '2026-09-01')).toEqual([])
    })

    it('is the exact complement of goalTargetChanges', () => {
      // Past and scheduled partition the changes — nothing is in both, and
      // nothing is lost. This is the three-way discipline #368's review
      // asked for, expressed as a property.
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 40, effective_from: '2026-06-01' },
        { daily_target: 50, effective_from: '2026-09-01' },
        { daily_target: 60, effective_from: '2026-12-01' },
      ])
      const today = '2026-08-15'
      const past = goalTargetChanges(g, today).map(c => c.effective_from)
      const future = scheduledGoalTargetChanges(g, today).map(c => c.effective_from)
      expect(past).toEqual(['2026-06-01'])
      expect(future).toEqual(['2026-09-01', '2026-12-01'])
      expect(past.filter(d => future.includes(d))).toEqual([])
      expect(goalTargetChanges(g)).toHaveLength(past.length + future.length)
    })

    it('skips a scheduled entry that does not actually move the target', () => {
      const g = goal([
        { daily_target: 30, effective_from: '2026-01-01' },
        { daily_target: 30, effective_from: '2026-09-01' },
      ])
      expect(scheduledGoalTargetChanges(g, '2026-08-15')).toEqual([])
    })

    it('is empty with no history', () => {
      expect(
        scheduledGoalTargetChanges(
          { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
          '2026-08-15'
        )
      ).toEqual([])
    })
  })
})

describe('currentTarget (#371)', () => {
  const g = (history?: { daily_target: number; effective_from: string }[]): ExerciseGoal => ({
    exercise: 'pullups',
    daily_target: 30,
    color: '#0EA5A1',
    ...(history === undefined ? {} : { target_history: history }),
  })

  it('resolves through history when an entry is in effect', () => {
    expect(
      currentTarget(
        g([
          { daily_target: 30, effective_from: '2026-01-01' },
          { daily_target: 40, effective_from: '2026-06-01' },
        ]),
        '2026-08-15'
      )
    ).toBe(40)
  })

  it('ignores an entry scheduled for the future', () => {
    expect(
      currentTarget(
        g([
          { daily_target: 30, effective_from: '2026-01-01' },
          { daily_target: 50, effective_from: '2026-09-01' },
        ]),
        '2026-08-15'
      )
    ).toBe(30)
  })

  it('keeps the mirror when the whole history is future-dated', () => {
    // The production shape that caught this: a goal created late on Jul 31
    // Pacific whose only history row is stamped Aug 1. `targetForDay` alone
    // would return 150 today via its before-earliest fallback, activating a
    // scheduled target a day early.
    const goal: ExerciseGoal = {
      exercise: 'dumbbell-lateral-raise',
      daily_target: 150,
      color: '#EA580C',
      target_history: [{ daily_target: 999, effective_from: '2026-08-01' }],
    }
    expect(currentTarget(goal, '2026-07-31')).toBe(150)
    // ...and it takes effect on its own day, with nothing having run.
    expect(currentTarget(goal, '2026-08-01')).toBe(999)
  })

  it('falls back to the mirror with no history at all', () => {
    expect(currentTarget(g(), '2026-08-15')).toBe(30)
    expect(currentTarget(g([]), '2026-08-15')).toBe(30)
  })

  it('falls back to the mirror for an unparseable day key', () => {
    expect(currentTarget(g([{ daily_target: 40, effective_from: '2026-06-01' }]), '')).toBe(30)
  })
})
