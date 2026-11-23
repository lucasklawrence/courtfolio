import { describe, expect, it } from 'vitest'

import type { ExerciseGoal, MonthlyFocus, StrengthSet } from '@/types/weight-room'

import {
  dailyVolumeByExercise,
  goalDayTargetResolver,
  labelTargetForToday,
  volumeIn,
} from './focus-scoring'
import { streakFromDailyVolume } from './hit-day-streaks'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
  kind: 'permanent',
}

const SHRUGS: ExerciseGoal = {
  exercise: 'shrugs',
  daily_target: 500,
  color: '#C9A268',
  kind: 'focus',
}

/** July shrugs at 100 reps a day. */
const JULY: MonthlyFocus = {
  id: 'july',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

/** A heavier week nested inside July. */
const NESTED: MonthlyFocus = {
  ...JULY,
  id: 'nested',
  daily_target: 150,
  start_date: '2026-07-10',
  end_date: '2026-07-16',
}

/** September shrugs counted in sets. */
const SEPTEMBER_SETS: MonthlyFocus = {
  ...JULY,
  id: 'september',
  daily_target: 3,
  target_kind: 'sets',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
}

/** Noon Pacific on a day. */
function set(exercise: string, dayKey: string, reps: number | null, id = dayKey): StrengthSet {
  return { id: `${exercise}-${id}`, exercise, reps, logged_at: `${dayKey}T19:00:00.000Z` }
}

describe('goalDayTargetResolver', () => {
  it('holds a permanent goal to its own target, even while its exercise has a rotation', () => {
    const resolve = goalDayTargetResolver({ ...PUSHUPS }, [{ ...JULY, exercise: 'pushups' }])
    expect(resolve('2026-07-15')).toEqual({ target: 100, unit: 'reps' })
  })

  it("holds a focus goal with no windows to the anchor's target", () => {
    expect(goalDayTargetResolver(SHRUGS, [])('2026-07-15')).toEqual({ target: 500, unit: 'reps' })
  })

  it('restores the outer rotation after a nested window ends', () => {
    const resolve = goalDayTargetResolver(SHRUGS, [JULY, NESTED])
    expect(resolve('2026-07-09')?.target).toBe(100)
    expect(resolve('2026-07-12')?.target).toBe(150)
    expect(resolve('2026-07-17')?.target).toBe(100)
  })

  it('gives a focus goal no bar on a day no window covers', () => {
    const resolve = goalDayTargetResolver(SHRUGS, [JULY, SEPTEMBER_SETS])
    expect(resolve('2026-06-30')).toBeNull()
    expect(resolve('2026-08-15')).toBeNull()
  })

  it("scores a sets-based rotation in that rotation's unit", () => {
    expect(goalDayTargetResolver(SHRUGS, [SEPTEMBER_SETS])('2026-09-10')).toEqual({
      target: 3,
      unit: 'sets',
    })
  })

  it('lets another exercise superseding the lane end this one for those days', () => {
    const lunges: MonthlyFocus = {
      ...JULY,
      id: 'lunges',
      exercise: 'lunges',
      start_date: '2026-07-20',
      end_date: '2026-07-25',
    }
    expect(goalDayTargetResolver(SHRUGS, [JULY, lunges])('2026-07-22')).toBeNull()
  })

  it("falls back to the anchor's target when the active rotation's is not positive", () => {
    const broken: MonthlyFocus = { ...JULY, daily_target: 0 }
    expect(goalDayTargetResolver(SHRUGS, [broken])('2026-07-15')).toEqual({
      target: 500,
      unit: 'reps',
    })
  })

  it('uses the supplied base resolver for the goal’s own target', () => {
    expect(goalDayTargetResolver(PUSHUPS, [], () => 42)('2026-07-15')?.target).toBe(42)
  })
})

describe('labelTargetForToday', () => {
  it("labels with today's rotation while one is active", () => {
    expect(labelTargetForToday(SHRUGS, [JULY, SEPTEMBER_SETS], '2026-09-05')).toEqual({
      target: 3,
      unit: 'sets',
    })
  })

  it('labels with the most recent rotation between windows', () => {
    expect(labelTargetForToday(SHRUGS, [JULY, SEPTEMBER_SETS], '2026-08-15')).toEqual({
      target: 100,
      unit: 'reps',
    })
  })

  it('labels with the rotation that ended last, not one nested inside it', () => {
    expect(labelTargetForToday(SHRUGS, [JULY, NESTED], '2026-08-15')).toEqual({
      target: 100,
      unit: 'reps',
    })
  })

  it('labels with the first rotation when all are ahead', () => {
    expect(labelTargetForToday(SHRUGS, [SEPTEMBER_SETS, JULY], '2026-06-01')).toEqual({
      target: 100,
      unit: 'reps',
    })
  })

  it('labels a permanent goal with its own target', () => {
    expect(labelTargetForToday(PUSHUPS, [JULY], '2026-07-15')).toEqual({
      target: 100,
      unit: 'reps',
    })
  })
})

describe('dailyVolumeByExercise', () => {
  it('counts reps and sets per exercise per day, including sets with no count', () => {
    const volume = dailyVolumeByExercise([
      set('shrugs', '2026-09-10', 10, 'a'),
      set('shrugs', '2026-09-10', null, 'b'),
      set('pushups', '2026-09-10', 20, 'c'),
    ])
    expect(volume.get('shrugs')?.get('2026-09-10')).toEqual({ reps: 10, sets: 2 })
    expect(volume.get('pushups')?.get('2026-09-10')).toEqual({ reps: 20, sets: 1 })
  })

  it('reads a missing day as zero in either unit', () => {
    expect(volumeIn(undefined, 'sets')).toBe(0)
    expect(volumeIn({ reps: 30, sets: 2 }, 'reps')).toBe(30)
  })
})

describe('streakFromDailyVolume', () => {
  it('counts a sets-based day by its set count, not its reps', () => {
    const volume = dailyVolumeByExercise([
      // One big set: plenty of reps, one set — a miss against 3 sets.
      set('shrugs', '2026-09-09', 60, 'a'),
      // Three small sets — a hit.
      set('shrugs', '2026-09-10', 5, 'b'),
      set('shrugs', '2026-09-10', 5, 'c'),
      set('shrugs', '2026-09-10', 5, 'd'),
    ]).get('shrugs')!
    const streak = streakFromDailyVolume(
      volume,
      goalDayTargetResolver(SHRUGS, [SEPTEMBER_SETS]),
      '2026-09-10'
    )
    expect(streak).toEqual({ current: 1, longest: 1 })
  })

  it('treats a day with no bar as a miss however much was logged', () => {
    const volume = dailyVolumeByExercise([
      set('shrugs', '2026-07-31', 100, 'a'),
      set('shrugs', '2026-08-01', 500, 'b'),
    ]).get('shrugs')!
    const streak = streakFromDailyVolume(
      volume,
      goalDayTargetResolver(SHRUGS, [JULY]),
      '2026-08-01'
    )
    // 08-01 has no bar, so the run is July 31 alone, still current by the
    // one-day grace rather than two days long.
    expect(streak).toEqual({ current: 1, longest: 1 })
  })
})
