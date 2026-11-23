import { describe, expect, it } from 'vitest'

import type { ExerciseGoal, MonthlyFocus, StrengthSet, WeightRoomData } from '@/types/weight-room'

import { goalsVisibleOnDay } from './monthly-focus'
import { buildTodayBoard } from './today-board'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  display_name: 'Pushups',
  daily_target: 100,
  color: '#EA580C',
  kind: 'permanent',
}

const SHRUGS: ExerciseGoal = {
  exercise: 'shrugs',
  display_name: 'Shrugs',
  daily_target: 100,
  color: '#C9A268',
  kind: 'focus',
}

const OCTOBER_SHRUGS: MonthlyFocus = {
  id: 'focus-1',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-10-01',
  end_date: '2026-10-31',
}

/** Noon Pacific on the given day, safely inside that day's bucket. */
function noonOn(dayKey: string): Date {
  return new Date(`${dayKey}T19:00:00.000Z`)
}

function makeSet(exercise: string, reps: number, dayKey: string): StrengthSet {
  return {
    id: `${exercise}-${dayKey}-${reps}`,
    exercise,
    reps,
    logged_at: noonOn(dayKey).toISOString(),
  }
}

function makeData(overrides: Partial<WeightRoomData> = {}): WeightRoomData {
  return {
    imported_at: '',
    sets: [],
    goals: [PUSHUPS, SHRUGS],
    monthly_focus: [OCTOBER_SHRUGS],
    ...overrides,
  }
}

describe('goalsVisibleOnDay', () => {
  const goals = [PUSHUPS, SHRUGS]
  const focuses = [OCTOBER_SHRUGS]
  const visible = (dayKey: string) =>
    goalsVisibleOnDay(goals, focuses, dayKey).map(goal => goal.exercise)

  it('includes a focus goal on the first and last day of its window', () => {
    expect(visible('2026-10-01')).toEqual(['pushups', 'shrugs'])
    expect(visible('2026-10-31')).toEqual(['pushups', 'shrugs'])
  })

  it('drops a focus goal the day after its window ends', () => {
    expect(visible('2026-11-01')).toEqual(['pushups'])
  })

  it('drops a focus goal before its window starts', () => {
    expect(visible('2026-09-30')).toEqual(['pushups'])
  })

  it('shows permanent goals only when the day is unknown', () => {
    expect(visible('')).toEqual(['pushups'])
  })

  it('treats a goal with no kind as permanent', () => {
    const untyped: ExerciseGoal = { exercise: 'dips', daily_target: 20, color: '#000000' }
    expect(goalsVisibleOnDay([untyped], [], '2026-11-01')).toEqual([untyped])
  })
})

describe('buildTodayBoard', () => {
  it('restores the outer rotation target for streak days after a nested window ends', () => {
    const nested: MonthlyFocus = {
      ...OCTOBER_SHRUGS,
      id: 'nested',
      start_date: '2026-10-10',
      end_date: '2026-10-15',
      daily_target: 150,
    }
    const data = makeData({
      monthly_focus: [OCTOBER_SHRUGS, nested],
      sets: [makeSet('shrugs', 100, '2026-10-16'), makeSet('shrugs', 100, '2026-10-17')],
    })
    const row = buildTodayBoard(data, noonOn('2026-10-17')).find(r => r.goal.exercise === 'shrugs')!
    expect(row.goal.daily_target).toBe(100)
    expect(row.streak).toBe(2)
  })

  it('scores a sets-based rotation against the same rep bar displayed on the board', () => {
    const data = makeData({
      monthly_focus: [{ ...OCTOBER_SHRUGS, target_kind: 'sets', daily_target: 3 }],
      sets: [makeSet('shrugs', 25, '2026-10-15')],
    })
    const row = buildTodayBoard(data, noonOn('2026-10-15')).find(r => r.goal.exercise === 'shrugs')!
    expect(row.goal.daily_target).toBe(100)
    expect(row.streak).toBe(0)
  })

  it('uses upper-lane precedence when both active lanes reference the same exercise', () => {
    const data = makeData({
      monthly_focus: [
        OCTOBER_SHRUGS,
        { ...OCTOBER_SHRUGS, id: 'lower', category: 'lower', daily_target: 150 },
      ],
      sets: [makeSet('shrugs', 100, '2026-10-15')],
    })
    const row = buildTodayBoard(data, noonOn('2026-10-15')).find(r => r.goal.exercise === 'shrugs')!
    expect(row.goal.daily_target).toBe(100)
    expect(row.streak).toBe(1)
  })

  it('does not count days outside a focus window toward its streak', () => {
    const data = makeData({
      sets: [makeSet('shrugs', 100, '2026-09-30'), makeSet('shrugs', 100, '2026-10-01')],
    })
    expect(
      buildTodayBoard(data, noonOn('2026-10-01')).find(r => r.goal.exercise === 'shrugs')?.streak
    ).toBe(1)
  })

  it('keeps earned streak days when a scheduled target takes effect', () => {
    const data = makeData({
      goals: [
        {
          ...PUSHUPS,
          daily_target: 150,
          target_history: [
            { effective_from: '2026-01-01', daily_target: 100 },
            { effective_from: '2026-11-02', daily_target: 150 },
          ],
        },
      ],
      sets: [
        makeSet('pushups', 100, '2026-10-31'),
        makeSet('pushups', 100, '2026-11-01'),
        makeSet('pushups', 150, '2026-11-02'),
      ],
    })
    const [row] = buildTodayBoard(data, noonOn('2026-11-02'))
    expect(row.goal.daily_target).toBe(150)
    expect(row.streak).toBe(3)
  })

  it('returns no rows when nothing has loaded', () => {
    expect(buildTodayBoard(null, noonOn('2026-11-01'))).toEqual([])
  })

  it('removes an expired focus goal the day after its window ends', () => {
    const board = buildTodayBoard(makeData(), noonOn('2026-11-01'))
    expect(board.map(row => row.goal.exercise)).toEqual(['pushups'])
  })

  it('keeps an active focus goal and counts only today', () => {
    const data = makeData({
      sets: [makeSet('shrugs', 20, '2026-10-15'), makeSet('shrugs', 15, '2026-10-14')],
    })
    const row = buildTodayBoard(data, noonOn('2026-10-15')).find(r => r.goal.exercise === 'shrugs')
    expect(row?.total).toBe(20)
    expect(row?.label).toBe('Shrugs')
  })

  it('resolves the target in effect today, not the latest configured one', () => {
    const scheduled: ExerciseGoal = {
      ...PUSHUPS,
      daily_target: 150,
      target_history: [
        { effective_from: '2026-01-01', daily_target: 100 },
        { effective_from: '2026-12-01', daily_target: 150 },
      ],
    }
    const board = buildTodayBoard(makeData({ goals: [scheduled] }), noonOn('2026-11-01'))
    expect(board[0].goal.daily_target).toBe(100)
  })

  it('reports a streak running through yesterday', () => {
    const data = makeData({
      sets: [makeSet('pushups', 100, '2026-10-30'), makeSet('pushups', 100, '2026-10-31')],
    })
    expect(buildTodayBoard(data, noonOn('2026-11-01'))[0].streak).toBe(2)
  })

  it('keeps the current target when the whole history is still in the future', () => {
    const scheduled: ExerciseGoal = {
      ...PUSHUPS,
      daily_target: 100,
      target_history: [{ effective_from: '2026-11-02', daily_target: 150 }],
    }
    const data = makeData({
      goals: [scheduled],
      sets: [makeSet('pushups', 100, '2026-10-30'), makeSet('pushups', 100, '2026-10-31')],
    })
    const [row] = buildTodayBoard(data, noonOn('2026-11-01'))
    expect(row.goal.daily_target).toBe(100)
    // The same bar scores the streak, so the unreached 150 can't break it.
    expect(row.streak).toBe(2)
  })

  it('leaves a permanent goal on its own target after it has run as a rotation', () => {
    const september: MonthlyFocus = {
      ...OCTOBER_SHRUGS,
      exercise: 'pushups',
      daily_target: 50,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
    }
    const data = makeData({
      monthly_focus: [september],
      sets: [makeSet('pushups', 60, '2026-10-31')],
    })
    const [row] = buildTodayBoard(data, noonOn('2026-11-01'))
    expect(row.goal.daily_target).toBe(100)
    expect(row.streak).toBe(0)
  })

  it('takes the target from the active rotation, not the newest one started', () => {
    const nested: MonthlyFocus = {
      ...OCTOBER_SHRUGS,
      id: 'focus-2',
      daily_target: 150,
      category: 'lower',
      start_date: '2026-10-10',
      end_date: '2026-10-15',
    }
    const data = makeData({ monthly_focus: [OCTOBER_SHRUGS, nested] })
    const row = buildTodayBoard(data, noonOn('2026-10-20')).find(r => r.goal.exercise === 'shrugs')
    expect(row?.goal.daily_target).toBe(100)
  })

  it("falls back to the anchor's target when the active rotation counts sets", () => {
    const setsFocus: MonthlyFocus = { ...OCTOBER_SHRUGS, target_kind: 'sets', daily_target: 3 }
    const board = buildTodayBoard(makeData({ monthly_focus: [setsFocus] }), noonOn('2026-10-15'))
    expect(board.find(r => r.goal.exercise === 'shrugs')?.goal.daily_target).toBe(100)
  })

  it("scores a focus goal against its rotation's target, not the anchor's", () => {
    const heavier: MonthlyFocus = { ...OCTOBER_SHRUGS, daily_target: 150 }
    const data = makeData({
      monthly_focus: [heavier],
      sets: [makeSet('shrugs', 100, '2026-10-14'), makeSet('shrugs', 100, '2026-10-15')],
    })
    const row = buildTodayBoard(data, noonOn('2026-10-15')).find(r => r.goal.exercise === 'shrugs')
    expect(row?.goal.daily_target).toBe(150)
    // 100 reps cleared the anchor's bar but not the rotation's, so no streak.
    expect(row?.streak).toBe(0)
  })
})
