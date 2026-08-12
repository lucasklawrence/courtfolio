import { describe, expect, it } from 'vitest'

import type {
  StrengthSet,
  TemplateSlot,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

import {
  E1RM_MAX_RELIABLE_REPS,
  buildWorkoutAdherence,
  buildWorkoutHistory,
  buildWorkoutSummary,
  countWorkingSets,
  compareToPrevious,
  effectiveSetLoad,
  epleyOneRepMax,
  findPersonalBests,
  findPreviousRun,
  loadMultipliersBySlug,
  WORKOUT_PAGE_SIZE,
  paginateWorkouts,
  workoutDisplayTitle,
  workoutYearOptions,
} from './workout-stats'

/**
 * Coverage for per-workout statistics (#377).
 *
 * The cases that matter are the ones where a plausible implementation is
 * quietly wrong: tonnage that forgets a movement is carried two at a time,
 * adherence that scores a substitution as a miss, a "personal best" measured
 * against a baseline that already includes the set being tested, and a previous
 * run resolved by template *name*.
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
    workout_id: 'w1',
    ...overrides,
  }
}

function workout(overrides: Partial<WeightRoomWorkout> = {}): WeightRoomWorkout {
  return {
    id: 'w1',
    started_at: '2026-08-01T18:00:00Z',
    ended_at: '2026-08-01T19:00:00Z',
    ...overrides,
  }
}

function slot(overrides: Partial<TemplateSlot> = {}): TemplateSlot {
  return {
    id: 'slot-1',
    position: 0,
    exercise: 'barbell-bench-press',
    target_sets: 4,
    steps: [],
    alternates: [],
    ...overrides,
  }
}

function template(slots: TemplateSlot[]): WorkoutTemplate {
  return { id: 't1', name: 'Chest Day 1', position: 0, slots }
}

describe('epleyOneRepMax', () => {
  it('returns the load itself for a single, never Epley’s inflated value', () => {
    // w × (1 + 1/30) would be 206.7 — an estimate that beats the measurement.
    expect(epleyOneRepMax(200, 1)).toBe(200)
  })

  it('applies Epley above one rep', () => {
    expect(epleyOneRepMax(200, 5)).toBeCloseTo(200 * (1 + 5 / 30), 6)
  })

  it('has no answer for a bodyweight or nonsensical set', () => {
    expect(epleyOneRepMax(0, 10)).toBeNull()
    expect(epleyOneRepMax(-5, 10)).toBeNull()
    expect(epleyOneRepMax(200, 0)).toBeNull()
    expect(epleyOneRepMax(Number.NaN, 5)).toBeNull()
  })
})

describe('effectiveSetLoad', () => {
  const multipliers = loadMultipliersBySlug(CATALOG)

  it('doubles a two-implement movement', () => {
    expect(effectiveSetLoad({ exercise: 'shrugs', weight_lbs: 60 }, multipliers)).toBe(120)
  })

  it('leaves a single-implement movement alone', () => {
    expect(
      effectiveSetLoad({ exercise: 'barbell-bench-press', weight_lbs: 185 }, multipliers)
    ).toBe(185)
  })

  it('is zero for a bodyweight set', () => {
    expect(effectiveSetLoad({ exercise: 'pullups' }, multipliers)).toBe(0)
  })

  it('falls back to one implement for a movement missing from the catalog', () => {
    // Understating a pair is recoverable; inventing load is not.
    expect(effectiveSetLoad({ exercise: 'unknown-lift', weight_lbs: 100 }, multipliers)).toBe(100)
  })
})

describe('countWorkingSets', () => {
  it('counts an ordinary row as one set', () => {
    expect(countWorkingSets([set({ id: 'a' }), set({ id: 'b' })])).toBe(2)
  })

  it('collapses the drops of one rack pass into a single set (#440)', () => {
    // `Set 1: 30, 15` and `Set 2: 30, 27.5, 22.5` — five rows, two sets.
    const drops = [
      set({ id: 'd1', exercise: 'dumbbell-curl', reps: null, set_group: 1 }),
      set({ id: 'd2', exercise: 'dumbbell-curl', reps: null, set_group: 1 }),
      set({ id: 'd3', exercise: 'dumbbell-curl', reps: null, set_group: 2 }),
      set({ id: 'd4', exercise: 'dumbbell-curl', reps: null, set_group: 2 }),
      set({ id: 'd5', exercise: 'dumbbell-curl', reps: null, set_group: 2 }),
    ]
    expect(countWorkingSets(drops)).toBe(2)
  })

  it('keeps groups from different movements apart', () => {
    // A group number is only unique within the movement that recorded it, so
    // keying on the number alone would merge two unrelated sets into one.
    const sets = [
      set({ id: 'a', exercise: 'dumbbell-curl', set_group: 1 }),
      set({ id: 'b', exercise: 'ez-bar-curl', set_group: 1 }),
    ]
    expect(countWorkingSets(sets)).toBe(2)
  })

  it('mixes grouped and ungrouped rows in one session', () => {
    const sets = [
      set({ id: 'bench-1' }),
      set({ id: 'bench-2' }),
      set({ id: 'd1', exercise: 'dumbbell-curl', reps: null, set_group: 1 }),
      set({ id: 'd2', exercise: 'dumbbell-curl', reps: null, set_group: 1 }),
    ]
    expect(countWorkingSets(sets)).toBe(3)
  })

  it('treats group 0 as a real group, not as absent', () => {
    // A falsy check here would count each drop separately again.
    const sets = [
      set({ id: 'd1', exercise: 'dumbbell-curl', set_group: 0 }),
      set({ id: 'd2', exercise: 'dumbbell-curl', set_group: 0 }),
    ]
    expect(countWorkingSets(sets)).toBe(1)
  })
})

describe('buildWorkoutSummary — rack runs (#440)', () => {
  it('reports a two-pass rack run as two sets, not five rows', () => {
    const drops = [
      set({ id: 'd1', exercise: 'dumbbell-curl', reps: null, weight_lbs: 30, set_group: 1 }),
      set({ id: 'd2', exercise: 'dumbbell-curl', reps: null, weight_lbs: 15, set_group: 1 }),
      set({ id: 'd3', exercise: 'dumbbell-curl', reps: null, weight_lbs: 30, set_group: 2 }),
      set({ id: 'd4', exercise: 'dumbbell-curl', reps: null, weight_lbs: 27.5, set_group: 2 }),
      set({ id: 'd5', exercise: 'dumbbell-curl', reps: null, weight_lbs: 22.5, set_group: 2 }),
    ]
    const summary = buildWorkoutSummary(workout(), drops)
    expect(summary.totalSets).toBe(2)
    expect(summary.exercises[0].sets).toBe(2)
  })

  it('adds no reps for drops whose count was never recorded', () => {
    const drops = [
      set({ id: 'd1', exercise: 'dumbbell-curl', reps: null, weight_lbs: 30, set_group: 1 }),
      set({ id: 'd2', exercise: 'dumbbell-curl', reps: null, weight_lbs: 15, set_group: 1 }),
    ]
    const summary = buildWorkoutSummary(workout(), drops)
    expect(summary.totalReps).toBe(0)
    // And no tonnage invented from a placeholder rep count: 1 x 30 + 1 x 15
    // would have been 45.
    expect(summary.tonnage).toBe(0)
  })

  it('still counts a counted set alongside them', () => {
    const sets = [
      set({ id: 'bench', reps: 8, weight_lbs: 135 }),
      set({ id: 'd1', exercise: 'dumbbell-curl', reps: null, weight_lbs: 30, set_group: 1 }),
    ]
    const summary = buildWorkoutSummary(workout(), sets)
    expect(summary.totalReps).toBe(8)
    expect(summary.tonnage).toBe(8 * 135)
    expect(summary.totalSets).toBe(2)
  })
})

describe('buildWorkoutSummary', () => {
  it('counts tonnage through the catalog multiplier', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [set({ id: 's1', exercise: 'shrugs', reps: 10, weight_lbs: 60 })],
      CATALOG
    )
    // 10 reps × 60 lb per hand × 2 hands.
    expect(summary.tonnage).toBe(1200)
  })

  it('halves tonnage when the catalog is withheld, proving the multiplier is load-bearing', () => {
    const summary = buildWorkoutSummary(workout(), [
      set({ id: 's1', exercise: 'shrugs', reps: 10, weight_lbs: 60 }),
    ])
    expect(summary.tonnage).toBe(600)
  })

  it('counts bodyweight reps but excludes them from tonnage, and says how many', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [
        set({ id: 's1', exercise: 'pullups', reps: 12 }),
        set({ id: 's2', exercise: 'barbell-bench-press', reps: 5, weight_lbs: 185 }),
      ],
      CATALOG
    )
    expect(summary.totalReps).toBe(17)
    expect(summary.tonnage).toBe(925)
    expect(summary.bodyweightSets).toBe(1)
    expect(summary.weightedSets).toBe(1)
  })

  it('computes density from the session duration', () => {
    const summary = buildWorkoutSummary(
      workout({ started_at: '2026-08-01T18:00:00Z', ended_at: '2026-08-01T19:00:00Z' }),
      [set({ id: 's1', reps: 5, weight_lbs: 100 }), set({ id: 's2', reps: 5, weight_lbs: 100 })],
      CATALOG
    )
    expect(summary.durationMinutes).toBe(60)
    expect(summary.density?.setsPerMinute).toBeCloseTo(2 / 60, 6)
    expect(summary.density?.tonnagePerMinute).toBeCloseTo(1000 / 60, 6)
  })

  it('has no density for a session still in progress', () => {
    const summary = buildWorkoutSummary(
      workout({ ended_at: undefined }),
      [set({ id: 's1' })],
      CATALOG,
      new Date('2026-08-01T18:30:00Z')
    )
    expect(summary.isInProgress).toBe(true)
    expect(summary.isAbandoned).toBe(false)
    expect(summary.durationMinutes).toBeNull()
    expect(summary.density).toBeNull()
  })

  it('marks a session left open past the staleness horizon as abandoned', () => {
    const summary = buildWorkoutSummary(
      workout({ ended_at: undefined }),
      [set({ id: 's1' })],
      CATALOG,
      new Date('2026-08-03T18:00:00Z')
    )
    expect(summary.isAbandoned).toBe(true)
    expect(summary.durationMinutes).toBeNull()
    // Totals still hold — the sets happened even though the clock didn't stop.
    expect(summary.totalSets).toBe(1)
  })

  it('picks the heaviest set as the top set, breaking ties toward more reps', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [
        set({ id: 's1', reps: 5, weight_lbs: 185 }),
        set({ id: 's2', reps: 8, weight_lbs: 185 }),
        set({ id: 's3', reps: 12, weight_lbs: 135 }),
      ],
      CATALOG
    )
    const bench = summary.exercises[0]
    expect(bench.topSet?.setId).toBe('s2')
    expect(bench.bestRepSet.setId).toBe('s3')
  })

  it('flags a high-rep 1RM estimate as unreliable', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [set({ id: 's1', reps: E1RM_MAX_RELIABLE_REPS + 8, weight_lbs: 95 })],
      CATALOG
    )
    expect(summary.exercises[0].estimatedOneRepMax).not.toBeNull()
    expect(summary.exercises[0].oneRepMaxIsReliable).toBe(false)
  })

  it('reports no 1RM estimate for a bodyweight movement', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [set({ id: 's1', exercise: 'pullups', reps: 10 })],
      CATALOG
    )
    expect(summary.exercises[0].isBodyweight).toBe(true)
    expect(summary.exercises[0].estimatedOneRepMax).toBeNull()
    expect(summary.exercises[0].topSet).toBeNull()
    expect(summary.exercises[0].bestRepSet.reps).toBe(10)
  })

  it('orders sets by instant, so mixed UTC and Pacific offsets do not scramble them', () => {
    // 05:00-07:00 is 12:00Z — two hours AFTER 10:00Z, but sorts before it as a
    // string. A lexicographic sort puts these in the wrong order, and
    // `WorkoutSummary.sets` promises oldest-first.
    const summary = buildWorkoutSummary(
      workout(),
      [
        set({ id: 'later', logged_at: '2026-08-01T05:00:00-07:00' }),
        set({ id: 'earlier', logged_at: '2026-08-01T10:00:00Z' }),
      ],
      CATALOG
    )
    expect(summary.sets.map(s => s.id)).toEqual(['earlier', 'later'])
  })

  it('handles a session with no sets at all', () => {
    const summary = buildWorkoutSummary(workout(), [], CATALOG)
    expect(summary.totalSets).toBe(0)
    expect(summary.totalReps).toBe(0)
    expect(summary.tonnage).toBe(0)
    expect(summary.exercises).toEqual([])
  })
})

describe('buildWorkoutAdherence', () => {
  it('counts a substituted slot as completed, not as a miss', () => {
    const bench = slot({ id: 'slot-bench', target_sets: 3 })
    const adherence = buildWorkoutAdherence(template([bench]), [
      set({ id: 's1', exercise: 'dumbbell-bench-press', template_slot_id: 'slot-bench' }),
      set({ id: 's2', exercise: 'dumbbell-bench-press', template_slot_id: 'slot-bench' }),
      set({ id: 's3', exercise: 'dumbbell-bench-press', template_slot_id: 'slot-bench' }),
    ])
    expect(adherence.slots[0].isSubstituted).toBe(true)
    expect(adherence.slots[0].isComplete).toBe(true)
    expect(adherence.substitutedSlots).toBe(1)
    expect(adherence.completedSlots).toBe(1)
    expect(adherence.completion).toBe(1)
  })

  it('reports a shortfall when a slot came up short', () => {
    const bench = slot({ id: 'slot-bench', target_sets: 5 })
    const adherence = buildWorkoutAdherence(template([bench]), [
      set({ id: 's1', template_slot_id: 'slot-bench' }),
      set({ id: 's2', template_slot_id: 'slot-bench' }),
      set({ id: 's3', template_slot_id: 'slot-bench' }),
    ])
    expect(adherence.slots[0].shortfall).toBe(2)
    expect(adherence.slots[0].isComplete).toBe(false)
    expect(adherence.completion).toBeCloseTo(3 / 5, 6)
  })

  it('treats a set range as satisfied at its floor', () => {
    const ranged = slot({ id: 'slot-r', target_sets: 4, target_sets_max: 5 })
    const adherence = buildWorkoutAdherence(template([ranged]), [
      set({ id: 's1', template_slot_id: 'slot-r' }),
      set({ id: 's2', template_slot_id: 'slot-r' }),
      set({ id: 's3', template_slot_id: 'slot-r' }),
      set({ id: 's4', template_slot_id: 'slot-r' }),
    ])
    expect(adherence.slots[0].isComplete).toBe(true)
    expect(adherence.slots[0].shortfall).toBe(0)
    // Four of "4–5" is hitting the prescription, not exceeding it.
    expect(adherence.slots[0].surplus).toBe(0)
  })

  it('does not let surplus on one slot pay down a shortfall on another', () => {
    const a = slot({ id: 'slot-a', target_sets: 3 })
    const b = slot({ id: 'slot-b', position: 1, exercise: 'shrugs', target_sets: 3 })
    const adherence = buildWorkoutAdherence(template([a, b]), [
      ...Array.from({ length: 8 }, (_, i) => set({ id: `a${i}`, template_slot_id: 'slot-a' })),
      set({ id: 'b1', exercise: 'shrugs', template_slot_id: 'slot-b' }),
    ])
    // 3 credited on slot-a (capped) + 1 on slot-b, out of 6 prescribed.
    expect(adherence.completedSets).toBe(4)
    expect(adherence.completion).toBeCloseTo(4 / 6, 6)
    expect(adherence.slots[0].surplus).toBe(5)
  })

  it('files sets with no slot as extra work', () => {
    const bench = slot({ id: 'slot-bench', target_sets: 1 })
    const adherence = buildWorkoutAdherence(template([bench]), [
      set({ id: 's1', template_slot_id: 'slot-bench' }),
      set({ id: 's2', exercise: 'pullups' }),
    ])
    expect(adherence.extra).toHaveLength(1)
    expect(adherence.extra[0].id).toBe('s2')
  })

  it('scores a freestyle session as complete rather than as a total miss', () => {
    const adherence = buildWorkoutAdherence(null, [set({ id: 's1' })])
    expect(adherence.slots).toEqual([])
    expect(adherence.prescribedSets).toBe(0)
    expect(adherence.completion).toBe(1)
    expect(adherence.extra).toHaveLength(1)
  })
})

describe('findPreviousRun', () => {
  const current = workout({ id: 'w3', template_id: 't1', started_at: '2026-08-01T18:00:00Z' })

  it('picks the nearest earlier session running the same template', () => {
    const older = workout({ id: 'w1', template_id: 't1', started_at: '2026-07-01T18:00:00Z' })
    const nearer = workout({ id: 'w2', template_id: 't1', started_at: '2026-07-25T18:00:00Z' })
    expect(findPreviousRun(current, [older, nearer])?.id).toBe('w2')
  })

  it('ignores sessions that ran a different template even when the title matches', () => {
    const impostor = workout({
      id: 'w2',
      template_id: 't2',
      title: 'Chest Day 1',
      started_at: '2026-07-25T18:00:00Z',
    })
    expect(findPreviousRun(current, [impostor])).toBeNull()
  })

  it('ignores later sessions and itself', () => {
    const later = workout({ id: 'w4', template_id: 't1', started_at: '2026-08-08T18:00:00Z' })
    expect(findPreviousRun(current, [current, later])).toBeNull()
  })

  it('has no previous run for a freestyle session', () => {
    const freestyle = workout({ id: 'w9', started_at: '2026-08-01T18:00:00Z' })
    const other = workout({ id: 'w8', started_at: '2026-07-01T18:00:00Z' })
    expect(findPreviousRun(freestyle, [other])).toBeNull()
  })

  it('compares as instants, so a Pacific-offset timestamp is not mis-sorted', () => {
    // 05:00-07:00 is 12:00Z — two hours AFTER 10:00Z, but sorts before it as a
    // string. A lexicographic implementation would wrongly call this earlier.
    const offsetLater = workout({
      id: 'w2',
      template_id: 't1',
      started_at: '2026-08-01T05:00:00-07:00',
    })
    const utcCurrent = workout({
      id: 'w3',
      template_id: 't1',
      started_at: '2026-08-01T10:00:00Z',
    })
    expect(findPreviousRun(utcCurrent, [offsetLater])).toBeNull()
  })
})

describe('compareToPrevious', () => {
  const currentSummary = buildWorkoutSummary(
    workout({ id: 'w2', started_at: '2026-08-01T18:00:00Z', ended_at: '2026-08-01T19:00:00Z' }),
    [
      set({ id: 'c1', workout_id: 'w2', reps: 5, weight_lbs: 200 }),
      set({ id: 'c2', workout_id: 'w2', exercise: 'pullups', reps: 10 }),
    ],
    CATALOG
  )
  const previousSummary = buildWorkoutSummary(
    workout({ id: 'w1', started_at: '2026-07-25T18:00:00Z', ended_at: '2026-07-25T19:30:00Z' }),
    [set({ id: 'p1', workout_id: 'w1', reps: 5, weight_lbs: 185 })],
    CATALOG
  )

  it('returns null when there is no previous run', () => {
    expect(compareToPrevious(currentSummary, null)).toBeNull()
  })

  it('reports headline deltas', () => {
    const comparison = compareToPrevious(currentSummary, previousSummary)
    expect(comparison?.setsDelta).toBe(1)
    expect(comparison?.repsDelta).toBe(10)
    expect(comparison?.tonnageDelta).toBe(1000 - 925)
    expect(comparison?.durationDelta).toBe(-30)
  })

  it('reports a top-set gain for a movement in both sessions', () => {
    const comparison = compareToPrevious(currentSummary, previousSummary)
    const bench = comparison?.exercises.find(e => e.exercise === 'barbell-bench-press')
    expect(bench?.topSetLoadDelta).toBe(15)
    expect(bench?.isNew).toBe(false)
  })

  it('marks a movement absent from the previous run as new', () => {
    const comparison = compareToPrevious(currentSummary, previousSummary)
    const pullups = comparison?.exercises.find(e => e.exercise === 'pullups')
    expect(pullups?.isNew).toBe(true)
    // Bodyweight both sides — a 0 lb delta would read as "no progress".
    expect(pullups?.topSetLoadDelta).toBeNull()
  })

  it('has no duration delta when a session never ended', () => {
    const openSummary = buildWorkoutSummary(
      workout({ id: 'w2', ended_at: undefined }),
      [set({ id: 'c1', workout_id: 'w2' })],
      CATALOG
    )
    expect(compareToPrevious(openSummary, previousSummary)?.durationDelta).toBeNull()
  })
})

describe('findPersonalBests', () => {
  it('finds a load PR against everything logged before the session', () => {
    const summary = buildWorkoutSummary(
      workout({ started_at: '2026-08-01T18:00:00Z' }),
      [set({ id: 'new', reps: 5, weight_lbs: 200 })],
      CATALOG
    )
    const bests = findPersonalBests(
      summary,
      [set({ id: 'old', logged_at: '2026-07-01T18:00:00Z', reps: 5, weight_lbs: 185 })],
      CATALOG
    )
    expect(bests).toHaveLength(1)
    expect(bests[0].kind).toBe('load')
    expect(bests[0].previousBest).toBe(185)
  })

  it('does not let the session’s own sets become the baseline they are tested against', () => {
    const sets = [set({ id: 'new', reps: 5, weight_lbs: 200 })]
    const summary = buildWorkoutSummary(workout(), sets, CATALOG)
    // The caller passes the whole log, session sets included.
    const bests = findPersonalBests(summary, sets, CATALOG)
    expect(bests).toHaveLength(1)
    expect(bests[0].previousBest).toBeNull()
  })

  it('counts loose grease-the-groove sets in the baseline', () => {
    const summary = buildWorkoutSummary(
      workout({ started_at: '2026-08-01T18:00:00Z' }),
      [set({ id: 'new', exercise: 'pullups', reps: 12 })],
      CATALOG
    )
    const bests = findPersonalBests(
      summary,
      [
        // No workout_id — a loose set, but real reps against the same movement.
        {
          id: 'loose',
          logged_at: '2026-07-01T12:00:00Z',
          exercise: 'pullups',
          reps: 15,
        },
      ],
      CATALOG
    )
    expect(bests).toEqual([])
  })

  it('judges a bodyweight movement on reps', () => {
    const summary = buildWorkoutSummary(
      workout({ started_at: '2026-08-01T18:00:00Z' }),
      [set({ id: 'new', exercise: 'pullups', reps: 16 })],
      CATALOG
    )
    const bests = findPersonalBests(
      summary,
      [
        {
          id: 'old',
          logged_at: '2026-07-01T12:00:00Z',
          exercise: 'pullups',
          reps: 15,
        },
      ],
      CATALOG
    )
    expect(bests[0].kind).toBe('reps')
    expect(bests[0].previousBest).toBe(15)
  })

  it('does not report a rep PR for a loaded movement’s light back-off set', () => {
    const summary = buildWorkoutSummary(
      workout({ started_at: '2026-08-01T18:00:00Z' }),
      [
        set({ id: 'heavy', reps: 3, weight_lbs: 185 }),
        set({ id: 'backoff', reps: 20, weight_lbs: 95 }),
      ],
      CATALOG
    )
    const bests = findPersonalBests(
      summary,
      [set({ id: 'old', logged_at: '2026-07-01T18:00:00Z', reps: 5, weight_lbs: 225 })],
      CATALOG
    )
    // 185 doesn't beat 225, and reps are not the record for a loaded movement.
    expect(bests).toEqual([])
  })

  it('reports a first-ever set as a first rather than as beating a previous mark', () => {
    const summary = buildWorkoutSummary(
      workout(),
      [set({ id: 'new', reps: 5, weight_lbs: 135 })],
      CATALOG
    )
    expect(findPersonalBests(summary, [], CATALOG)[0].previousBest).toBeNull()
  })
})

describe('buildWorkoutHistory', () => {
  const w1 = workout({ id: 'w1', started_at: '2026-07-01T18:00:00Z', template_id: 't1' })
  const w2 = workout({ id: 'w2', started_at: '2026-08-01T18:00:00Z' })

  it('orders newest first regardless of input order', () => {
    const history = buildWorkoutHistory([w1, w2], [], [], CATALOG)
    expect(history.map(e => e.workout.id)).toEqual(['w2', 'w1'])
  })

  it('groups each session’s sets and ignores loose ones', () => {
    const history = buildWorkoutHistory(
      [w1, w2],
      [
        set({ id: 'a', workout_id: 'w1', reps: 5 }),
        set({ id: 'b', workout_id: 'w2', reps: 8 }),
        { id: 'loose', logged_at: '2026-08-01T12:00:00Z', exercise: 'pushups', reps: 40 },
      ],
      [],
      CATALOG
    )
    expect(history[0].summary.totalReps).toBe(8)
    expect(history[1].summary.totalReps).toBe(5)
  })

  it('attaches the template name and color it ran', () => {
    const history = buildWorkoutHistory(
      [w1],
      [],
      [{ id: 't1', name: 'Chest Day 1', color: '#EA580C', position: 0, slots: [] }],
      CATALOG
    )
    expect(history[0].templateName).toBe('Chest Day 1')
    expect(history[0].templateColor).toBe('#EA580C')
  })

  it('leaves a freestyle session with no template name', () => {
    const history = buildWorkoutHistory([w2], [], [], CATALOG)
    expect(history[0].templateName).toBeNull()
  })

  it('sorts an unparseable start date last rather than to the top', () => {
    const broken = workout({ id: 'bad', started_at: 'not-a-date' })
    const history = buildWorkoutHistory([broken, w2], [], [], CATALOG)
    expect(history.map(e => e.workout.id)).toEqual(['w2', 'bad'])
  })
})

describe('workoutDisplayTitle (#413)', () => {
  it('prefers the template name', () => {
    expect(workoutDisplayTitle({}, 'Chest Day 1')).toBe('Chest Day 1')
  })

  it('falls back to a free-text title', () => {
    expect(workoutDisplayTitle({ title: 'Push Day' }, null)).toBe('Push Day')
  })

  it('calls an untitled manual session freestyle', () => {
    expect(workoutDisplayTitle({}, null)).toBe('Freestyle session')
  })

  it('does not call an imported session freestyle', () => {
    // "Freestyle" asserts a plan was available and declined. An import had no
    // template to decline — the app wasn't involved.
    expect(workoutDisplayTitle({ source: 'apple_health' }, null)).toBe('Strength training')
  })

  it('still honours a template on an imported session, once #400 links one', () => {
    expect(workoutDisplayTitle({ source: 'apple_health' }, 'Chest Day 1')).toBe('Chest Day 1')
  })
})

describe('workoutYearOptions (#416)', () => {
  function at(id: string, iso: string) {
    return buildWorkoutHistory([{ id, started_at: iso }], [], [], [])[0]
  }

  it('counts sessions per Pacific year, newest first', () => {
    const entries = [
      at('a', '2022-05-01T18:00:00Z'),
      at('b', '2022-06-01T18:00:00Z'),
      at('c', '2024-01-01T18:00:00Z'),
    ]
    expect(workoutYearOptions(entries)).toEqual([
      { year: 2024, count: 1 },
      { year: 2022, count: 2 },
    ])
  })

  it('omits years with no sessions rather than filling them in', () => {
    // The gaps are the interesting part — 2019/2020/2025 are absent from the
    // real log and shouldn't be rendered as empty chips.
    const entries = [at('a', '2018-05-01T18:00:00Z'), at('b', '2021-05-01T18:00:00Z')]
    expect(workoutYearOptions(entries).map(y => y.year)).toEqual([2021, 2018])
  })

  it('buckets by Pacific year, not UTC', () => {
    // 2021-12-31T20:00 Pacific is 2022-01-01T04:00Z — UTC would file it as 2022.
    expect(workoutYearOptions([at('a', '2022-01-01T04:00:00Z')])).toEqual([
      { year: 2021, count: 1 },
    ])
  })

  it('ignores an unparseable timestamp instead of inventing a year', () => {
    expect(workoutYearOptions([at('bad', 'not-a-date')])).toEqual([])
  })
})

describe('paginateWorkouts (#416)', () => {
  const entries = Array.from(
    { length: 120 },
    (_, i) =>
      buildWorkoutHistory([{ id: `w${i}`, started_at: '2024-01-01T18:00:00Z' }], [], [], [])[0]
  )

  it('slices to the page size and reports the totals', () => {
    const result = paginateWorkouts(entries, 1, 50)
    expect(result.entries).toHaveLength(50)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(3)
    expect(result.totalEntries).toBe(120)
  })

  it('returns the remainder on the last page', () => {
    expect(paginateWorkouts(entries, 3, 50).entries).toHaveLength(20)
  })

  it('clamps a page past the end rather than erroring', () => {
    // A filter change can shrink the list under a bookmarked ?page=99.
    const result = paginateWorkouts(entries, 99, 50)
    expect(result.page).toBe(3)
    expect(result.entries).toHaveLength(20)
  })

  it('clamps a nonsense page to the first', () => {
    expect(paginateWorkouts(entries, -3, 50).page).toBe(1)
    expect(paginateWorkouts(entries, Number.NaN, 50).page).toBe(1)
    expect(paginateWorkouts(entries, 0, 50).page).toBe(1)
  })

  it('reports the offset so the caption cannot disagree with the rows', () => {
    // Derived here rather than at the render site, which would have to assume
    // the default page size even when a caller passed a different one.
    expect(paginateWorkouts(entries, 1, 50).startIndex).toBe(1)
    expect(paginateWorkouts(entries, 2, 50).startIndex).toBe(51)
    expect(paginateWorkouts(entries, 3, 50).startIndex).toBe(101)
    expect(paginateWorkouts(entries, 2, 25).startIndex).toBe(26)
  })

  it('reports a zero offset when there is nothing to show', () => {
    expect(paginateWorkouts([], 1, 50).startIndex).toBe(0)
  })

  it('reports one page for an empty list, so the UI has something to render', () => {
    const result = paginateWorkouts([], 1, 50)
    expect(result.totalPages).toBe(1)
    expect(result.entries).toEqual([])
    expect(result.totalEntries).toBe(0)
  })

  it('never divides by a zero page size', () => {
    expect(paginateWorkouts(entries, 1, 0).entries).toHaveLength(1)
  })

  it('bounds the real production case — 507 sessions', () => {
    const many = Array.from(
      { length: 507 },
      (_, i) =>
        buildWorkoutHistory([{ id: `p${i}`, started_at: '2022-01-01T18:00:00Z' }], [], [], [])[0]
    )
    const result = paginateWorkouts(many, 1)
    expect(result.entries).toHaveLength(WORKOUT_PAGE_SIZE)
    expect(result.totalPages).toBe(Math.ceil(507 / WORKOUT_PAGE_SIZE))
  })
})

describe('buildWorkoutAdherence — stepped slots (#407)', () => {
  const RACK_STEPS = [
    { id: 'st-35', position: 0, target_weight_lbs: 35 },
    { id: 'st-30', position: 1, target_weight_lbs: 30 },
    { id: 'st-25', position: 2, target_weight_lbs: 25 },
    { id: 'st-20', position: 3, target_weight_lbs: 20 },
  ]
  const RACK = slot({
    id: 'slot-rack',
    exercise: 'dumbbell-curl',
    target_sets: 2,
    steps: RACK_STEPS,
  })

  function pass(round: number): StrengthSet[] {
    return RACK_STEPS.map((st, i) =>
      set({
        id: `r${round}-${i}`,
        exercise: 'dumbbell-curl',
        weight_lbs: st.target_weight_lbs,
        template_slot_id: 'slot-rack',
        template_slot_step_id: st.id,
      })
    )
  }

  it('scores two passes as 2 of 2 prescribed sets, not 8', () => {
    const adherence = buildWorkoutAdherence(template([RACK]), [...pass(1), ...pass(2)])
    expect(adherence.prescribedSets).toBe(2)
    expect(adherence.completedSets).toBe(2)
    expect(adherence.completion).toBe(1)
    expect(adherence.slots[0].surplus).toBe(0)
  })

  it('reports a shortfall in passes, not in rungs', () => {
    const adherence = buildWorkoutAdherence(template([RACK]), pass(1))
    expect(adherence.completedSets).toBe(1)
    expect(adherence.slots[0].shortfall).toBe(1)
    expect(adherence.completion).toBe(0.5)
  })

  it('does not credit a half-finished drop set as over-delivery', () => {
    // Before #407 this scored 3 rows against 2 target_sets — 150% complete for
    // a drop set that was never finished.
    const adherence = buildWorkoutAdherence(template([RACK]), pass(1).slice(0, 3))
    expect(adherence.completedSets).toBe(0)
    expect(adherence.slots[0].surplus).toBe(0)
    expect(adherence.slots[0].shortfall).toBe(2)
  })
})
