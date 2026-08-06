import { describe, expect, it } from 'vitest'

import type { StrengthSet, WeightRoomExercise, WeightRoomWorkout } from '@/types/weight-room'

import {
  buildExerciseProgression,
  buildSetDetailCoverage,
  trendableExercises,
} from './exercise-progression'
import { E1RM_MAX_RELIABLE_REPS } from './workout-stats'

/**
 * Coverage for the per-exercise trend (#412).
 *
 * The cases that matter are the ones a plausible implementation gets quietly
 * wrong: a late-evening Pacific set bucketed into tomorrow because the server
 * runs UTC, a two-dumbbell movement plotted at half the load actually moved, and
 * an Epley estimate off a set of 25 drawn as though it were a measurement.
 */

const CATALOG: WeightRoomExercise[] = [
  {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  },
  {
    slug: 'shrugs',
    display_name: 'Shrugs',
    equipment: 'dumbbell',
    muscle_group: 'back',
    load_multiplier: 2,
  },
  { slug: 'pullups', display_name: 'Pullups', equipment: 'bodyweight', muscle_group: 'back' },
]

function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: 'set-1',
    logged_at: '2026-08-01T18:00:00Z',
    exercise: 'barbell-bench-press',
    reps: 5,
    ...overrides,
  }
}

function workout(overrides: Partial<WeightRoomWorkout> = {}): WeightRoomWorkout {
  return {
    id: 'workout-1',
    started_at: '2026-01-08T18:00:00Z',
    source: 'apple_health',
    ...overrides,
  }
}

describe('buildExerciseProgression', () => {
  it('returns null for a movement with no logged sets', () => {
    expect(buildExerciseProgression('dips', [set()], CATALOG)).toBeNull()
  })

  it('buckets sets by Pacific training day, not by UTC calendar day', () => {
    // 2026-08-02T04:30:00Z is 9:30pm Pacific on 8/1. Bucketed by the raw
    // timestamp it would open a second, phantom training day.
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'a', exercise: 'pullups', reps: 8, logged_at: '2026-08-01T19:00:00-07:00' }),
        set({ id: 'b', exercise: 'pullups', reps: 6, logged_at: '2026-08-02T04:30:00Z' }),
      ],
      CATALOG
    )

    expect(progression?.points).toHaveLength(1)
    expect(progression?.points[0].dayKey).toBe('2026-08-01')
    expect(progression?.points[0].sets).toBe(2)
    expect(progression?.points[0].reps).toBe(14)
  })

  it('orders days oldest first regardless of input order', () => {
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'c', exercise: 'pullups', logged_at: '2026-08-03T18:00:00Z' }),
        set({ id: 'a', exercise: 'pullups', logged_at: '2026-08-01T18:00:00Z' }),
        set({ id: 'b', exercise: 'pullups', logged_at: '2026-08-02T18:00:00Z' }),
      ],
      CATALOG
    )

    expect(progression?.points.map(p => p.dayKey)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
  })

  it('counts a two-dumbbell movement at the load actually moved', () => {
    const progression = buildExerciseProgression(
      'shrugs',
      [set({ id: 'a', exercise: 'shrugs', reps: 10, weight_lbs: 60 })],
      CATALOG
    )

    // 60 per hand, carried two at a time — 120 moved, 1,200 lb of tonnage.
    expect(progression?.points[0].topSet?.effectiveLoad).toBe(120)
    expect(progression?.points[0].topSet?.weightLbs).toBe(60)
    expect(progression?.points[0].tonnage).toBe(1200)
    expect(progression?.heaviestSet?.effectiveLoad).toBe(120)
  })

  it('picks the heaviest set of the day, breaking ties toward more reps', () => {
    const progression = buildExerciseProgression(
      'barbell-bench-press',
      [
        set({ id: 'light', reps: 12, weight_lbs: 135 }),
        set({ id: 'heavy-5', reps: 5, weight_lbs: 185 }),
        set({ id: 'heavy-6', reps: 6, weight_lbs: 185 }),
      ],
      CATALOG
    )

    expect(progression?.points[0].topSet?.setId).toBe('heavy-6')
  })

  it('picks the most-reps set separately, breaking ties toward heavier load', () => {
    const progression = buildExerciseProgression(
      'barbell-bench-press',
      [
        set({ id: 'light-12', reps: 12, weight_lbs: 95 }),
        set({ id: 'heavy-12', reps: 12, weight_lbs: 135 }),
        set({ id: 'heavy-5', reps: 5, weight_lbs: 185 }),
      ],
      CATALOG
    )

    expect(progression?.points[0].bestRepSet.setId).toBe('heavy-12')
    expect(progression?.mostRepsSet.setId).toBe('heavy-12')
  })

  it('estimates a 1RM only from sets at or under the reliability cutoff', () => {
    const progression = buildExerciseProgression(
      'barbell-bench-press',
      [
        // The heaviest set of the day, but far too many reps for Epley.
        set({ id: 'high-rep', reps: 25, weight_lbs: 155 }),
        set({ id: 'low-rep', reps: E1RM_MAX_RELIABLE_REPS, weight_lbs: 135 }),
      ],
      CATALOG
    )

    // Off the reliable set (135 × (1 + 12/30) = 189), not off the heavier one.
    expect(progression?.points[0].estimatedOneRepMax).toBeCloseTo(189, 5)
    expect(progression?.points[0].topSet?.setId).toBe('high-rep')
    expect(progression?.bestOneRepMax).toBeCloseTo(189, 5)
  })

  it('reports no estimate at all when every loaded set is high-rep', () => {
    const progression = buildExerciseProgression(
      'shrugs',
      [
        set({ id: 'a', exercise: 'shrugs', reps: 25, weight_lbs: 50 }),
        set({ id: 'b', exercise: 'shrugs', reps: 20, weight_lbs: 50 }),
      ],
      CATALOG
    )

    expect(progression?.points[0].estimatedOneRepMax).toBeNull()
    expect(progression?.bestOneRepMax).toBeNull()
    expect(progression?.loadedSets).toBe(2)
    expect(progression?.highRepLoadedSets).toBe(2)
  })

  it('treats a movement with no loaded set as bodyweight, with no top set', () => {
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'a', exercise: 'pullups', reps: 8 }),
        set({ id: 'b', exercise: 'pullups', reps: 5 }),
      ],
      CATALOG
    )

    expect(progression?.isBodyweight).toBe(true)
    expect(progression?.heaviestSet).toBeNull()
    expect(progression?.points[0].topSet).toBeNull()
    expect(progression?.points[0].tonnage).toBe(0)
    expect(progression?.mostRepsSet.reps).toBe(8)
  })

  it("keeps a session's sets on the session's own day when it runs past midnight", () => {
    const session = workout({
      id: 'late-night',
      source: 'manual',
      started_at: '2026-08-01T22:30:00-07:00',
    })
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'before', exercise: 'pullups', reps: 8, workout_id: 'late-night' }),
        // 12:20am Pacific on 8/2 — the same session, an hour later.
        set({
          id: 'after',
          exercise: 'pullups',
          reps: 6,
          workout_id: 'late-night',
          logged_at: '2026-08-02T00:20:00-07:00',
        }),
      ],
      CATALOG,
      [session]
    )

    expect(progression?.points).toHaveLength(1)
    expect(progression?.points[0].dayKey).toBe('2026-08-01')
    expect(progression?.points[0].reps).toBe(14)
  })

  it('dates a set by its own timestamp when its session is unknown', () => {
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({
          id: 'orphan',
          exercise: 'pullups',
          reps: 6,
          workout_id: 'missing',
          logged_at: '2026-08-02T00:20:00-07:00',
        }),
      ],
      CATALOG,
      []
    )

    expect(progression?.points[0].dayKey).toBe('2026-08-02')
  })

  it('counts loose sets and session sets alike', () => {
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'loose', exercise: 'pullups', reps: 5 }),
        set({ id: 'in-session', exercise: 'pullups', reps: 7, workout_id: 'workout-1' }),
      ],
      CATALOG
    )

    expect(progression?.totalSets).toBe(2)
    expect(progression?.totalReps).toBe(12)
  })

  it('drops sets whose timestamp has no day to belong to', () => {
    const progression = buildExerciseProgression(
      'pullups',
      [
        set({ id: 'good', exercise: 'pullups', reps: 5 }),
        set({ id: 'bad', exercise: 'pullups', reps: 99, logged_at: 'not-a-timestamp' }),
      ],
      CATALOG
    )

    expect(progression?.totalSets).toBe(1)
    expect(progression?.mostRepsSet.reps).toBe(5)
  })

  it('understates rather than invents load when the catalog is missing', () => {
    const progression = buildExerciseProgression('shrugs', [
      set({ id: 'a', exercise: 'shrugs', reps: 10, weight_lbs: 60 }),
    ])

    // No multiplier available, so one implement — half the truth, but never more
    // than was lifted.
    expect(progression?.points[0].topSet?.effectiveLoad).toBe(60)
  })
})

describe('buildSetDetailCoverage', () => {
  const sessions = [
    workout({ id: 'w1', started_at: '2018-01-08T18:00:00Z' }),
    workout({ id: 'w2', started_at: '2022-06-01T18:00:00Z' }),
    workout({ id: 'w3', started_at: '2026-08-04T18:00:00Z' }),
  ]

  it('counts only the detail-free sessions that predate the first set', () => {
    const coverage = buildSetDetailCoverage('2026-08-01', sessions, [])

    expect(coverage.sessionsBefore).toBe(2)
    expect(coverage.earliestSessionDayKey).toBe('2018-01-08')
  })

  it('excludes sessions that carry set detail of their own', () => {
    const coverage = buildSetDetailCoverage('2026-08-01', sessions, [
      set({ id: 's', workout_id: 'w2', logged_at: '2022-06-01T19:00:00Z' }),
    ])

    expect(coverage.sessionsBefore).toBe(1)
    expect(coverage.earliestSessionDayKey).toBe('2018-01-08')
  })

  it('excludes manually recorded sessions, which were never imports', () => {
    // The render site names Apple Health as the reason the detail is missing, so
    // a manual session abandoned before any set was logged must not pad the
    // number behind that sentence.
    const coverage = buildSetDetailCoverage(
      '2026-08-01',
      [...sessions, workout({ id: 'w4', source: 'manual', started_at: '2026-07-01T18:00:00Z' })],
      []
    )

    expect(coverage.sessionsBefore).toBe(2)
  })

  it('excludes a session started on the first training day itself', () => {
    const coverage = buildSetDetailCoverage('2018-01-08', sessions, [])

    expect(coverage.sessionsBefore).toBe(0)
    expect(coverage.earliestSessionDayKey).toBeNull()
  })

  it('ignores a session whose start timestamp has no day to belong to', () => {
    const coverage = buildSetDetailCoverage('2026-08-01', [workout({ started_at: 'nope' })], [])

    expect(coverage.sessionsBefore).toBe(0)
    expect(coverage.earliestSessionDayKey).toBeNull()
  })

  it('reports nothing when the movement has no first day', () => {
    expect(buildSetDetailCoverage(null, sessions, [])).toEqual({
      sessionsBefore: 0,
      earliestSessionDayKey: null,
    })
  })
})

describe('trendableExercises', () => {
  it('lists movements most-recently-trained first', () => {
    const sets = [
      set({ id: 'a', exercise: 'pullups', logged_at: '2026-08-01T18:00:00Z' }),
      set({ id: 'b', exercise: 'shrugs', logged_at: '2026-08-05T18:00:00Z' }),
      set({ id: 'c', exercise: 'pullups', logged_at: '2026-07-01T18:00:00Z' }),
    ]

    expect(trendableExercises(sets)).toEqual(['shrugs', 'pullups'])
  })

  it('breaks a same-day tie alphabetically', () => {
    const sets = [
      set({ id: 'a', exercise: 'squats', logged_at: '2026-08-05T18:00:00Z' }),
      set({ id: 'b', exercise: 'lunges', logged_at: '2026-08-05T18:00:00Z' }),
    ]

    expect(trendableExercises(sets)).toEqual(['lunges', 'squats'])
  })
})
