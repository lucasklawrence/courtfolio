import { describe, expect, it } from 'vitest'

import type {
  StrengthSet,
  TemplateSlot,
  TemplateSlotStep,
  WorkoutTemplate,
} from '@/types/weight-room'

import { buildSlotProgress, extraSets, nextSetDefaults, nextSetPosition } from './live-workout'

/**
 * Coverage for the live-recording logic (#376) — chiefly the two things the
 * schema encodes implicitly and a component would otherwise get wrong: a
 * substitution is a *derived* fact about the sets, and "extra work" is an
 * absence that only means something inside a workout.
 */

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

function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: 'set-1',
    logged_at: '2026-08-01T18:00:00Z',
    exercise: 'barbell-bench-press',
    reps: 5,
    ...overrides,
  }
}

function template(slots: TemplateSlot[]): WorkoutTemplate {
  return { id: 't1', name: 'Chest Day 1', position: 0, slots }
}

describe('buildSlotProgress', () => {
  it('counts sets logged against each slot', () => {
    const s = slot()
    const progress = buildSlotProgress(template([s]), [
      set({ id: 'a', template_slot_id: 'slot-1' }),
      set({ id: 'b', template_slot_id: 'slot-1', logged_at: '2026-08-01T18:05:00Z' }),
    ])
    expect(progress[0].logged).toBe(2)
    expect(progress[0].isComplete).toBe(false)
  })

  it('is complete at the prescribed count, and stays complete beyond it', () => {
    const s = slot({ target_sets: 2 })
    const two = buildSlotProgress(template([s]), [
      set({ id: 'a', template_slot_id: 'slot-1' }),
      set({ id: 'b', template_slot_id: 'slot-1' }),
    ])
    expect(two[0].isComplete).toBe(true)

    const three = buildSlotProgress(template([s]), [
      set({ id: 'a', template_slot_id: 'slot-1' }),
      set({ id: 'b', template_slot_id: 'slot-1' }),
      set({ id: 'c', template_slot_id: 'slot-1' }),
    ])
    expect(three[0].logged).toBe(3)
    expect(three[0].isComplete).toBe(true)
  })

  it('treats a set-range slot as complete at its floor', () => {
    // "4-5 sets" means 4 hits the prescription; the 5th is within range, not
    // over it.
    const s = slot({ target_sets: 4, target_sets_max: 5 })
    const progress = buildSlotProgress(
      template([s]),
      Array.from({ length: 4 }, (_, i) => set({ id: `a${i}`, template_slot_id: 'slot-1' }))
    )
    expect(progress[0].isComplete).toBe(true)
  })

  it('derives a substitution from the logged movement, with no flag', () => {
    const progress = buildSlotProgress(template([slot()]), [
      set({ id: 'a', template_slot_id: 'slot-1', exercise: 'dumbbell-bench-press' }),
    ])
    expect(progress[0].isSubstituted).toBe(true)
    expect(progress[0].performedExercise).toBe('dumbbell-bench-press')
  })

  it('is not a substitution when the prescribed movement was used', () => {
    const progress = buildSlotProgress(template([slot()]), [
      set({ id: 'a', template_slot_id: 'slot-1' }),
    ])
    expect(progress[0].isSubstituted).toBe(false)
  })

  it('lets the newest set decide the current movement after a mid-slot swap', () => {
    // Two barbell sets, then the rack goes — earlier sets keep what they were
    // actually done with, but the slot is now being performed with dumbbells.
    const progress = buildSlotProgress(template([slot()]), [
      set({ id: 'a', template_slot_id: 'slot-1', logged_at: '2026-08-01T18:00:00Z' }),
      set({
        id: 'b',
        template_slot_id: 'slot-1',
        exercise: 'dumbbell-bench-press',
        logged_at: '2026-08-01T18:10:00Z',
      }),
    ])
    expect(progress[0].performedExercise).toBe('dumbbell-bench-press')
    expect(progress[0].sets[0].exercise).toBe('barbell-bench-press')
  })

  it('orders slots by position regardless of set order', () => {
    const a = slot({ id: 'slot-a', position: 1, exercise: 'dips' })
    const b = slot({ id: 'slot-b', position: 0, exercise: 'pushups' })
    const progress = buildSlotProgress(template([a, b]), [])
    expect(progress.map(p => p.slot.exercise)).toEqual(['pushups', 'dips'])
  })

  it('yields no slots for a session started without a template', () => {
    expect(buildSlotProgress(null, [set({ id: 'a' })])).toEqual([])
  })
})

describe('extraSets', () => {
  it('returns sets in the workout that no slot prescribed', () => {
    const found = extraSets([
      set({ id: 'a', template_slot_id: 'slot-1' }),
      set({ id: 'b', exercise: 'pec-deck' }),
    ])
    expect(found.map(s => s.id)).toEqual(['b'])
  })

  it('returns nothing when everything was prescribed', () => {
    expect(extraSets([set({ id: 'a', template_slot_id: 'slot-1' })])).toEqual([])
  })
})

describe('nextSetDefaults', () => {
  it('repeats the previous set in this slot', () => {
    // Loads get adjusted on set one and then held, so after a set the
    // prescription is the stale number.
    const s = slot({ target_reps: 5, target_weight_lbs: 135 })
    const defaults = nextSetDefaults(s, [set({ reps: 5, weight_lbs: 185 })])
    expect(defaults).toEqual({ reps: 5, weight_lbs: 185 })
  })

  it('falls back to the prescription for the first set', () => {
    const s = slot({ target_reps: 5, target_weight_lbs: 135 })
    expect(nextSetDefaults(s, [])).toEqual({ reps: 5, weight_lbs: 135 })
  })

  it('falls back to the last time this movement was done when nothing is prescribed', () => {
    const s = slot({ target_reps: undefined })
    const defaults = nextSetDefaults(s, [], set({ reps: 8, weight_lbs: 50 }))
    expect(defaults).toEqual({ reps: 8, weight_lbs: 50 })
  })

  it('prefills nothing for AMRAP with no history rather than guessing', () => {
    expect(nextSetDefaults(slot(), [])).toEqual({ reps: null, weight_lbs: null })
  })

  it('carries a bodyweight previous set through as a null load', () => {
    const defaults = nextSetDefaults(slot(), [set({ reps: 12 })])
    expect(defaults).toEqual({ reps: 12, weight_lbs: null })
  })
})

describe('nextSetPosition', () => {
  it('starts at zero for an empty workout', () => {
    expect(nextSetPosition([])).toBe(0)
  })

  it('takes the max rather than the count, so a deletion never reuses an index', () => {
    // Sets 0,1,2 logged then set 1 deleted: the next set must be 3, not 2, or
    // it lands in the middle of the history.
    expect(nextSetPosition([set({ position: 0 }), set({ position: 2 })])).toBe(3)
  })

  it('ignores sets with no position', () => {
    expect(nextSetPosition([set({ position: 4 }), set({})])).toBe(5)
  })
})

describe('buildSlotProgress — mixed timestamp offsets (#377)', () => {
  it('picks the newest set by instant, so the current movement is right', () => {
    // 05:00-07:00 is 12:00Z, two hours AFTER 10:00Z, but sorts before it as a
    // string. Lexicographically the barbell set looks newest, so the slot would
    // report itself un-substituted while the dumbbell set is the real latest.
    const [progress] = buildSlotProgress(
      {
        id: 't1',
        name: 'Chest Day 1',
        position: 0,
        slots: [slot({ id: 'slot-bench' })],
      },
      [
        set({
          id: 'barbell',
          logged_at: '2026-08-01T10:00:00Z',
          exercise: 'barbell-bench-press',
          template_slot_id: 'slot-bench',
        }),
        set({
          id: 'dumbbell',
          logged_at: '2026-08-01T05:00:00-07:00',
          exercise: 'dumbbell-bench-press',
          template_slot_id: 'slot-bench',
        }),
      ]
    )
    expect(progress.sets.map(s => s.id)).toEqual(['barbell', 'dumbbell'])
    expect(progress.performedExercise).toBe('dumbbell-bench-press')
    expect(progress.isSubstituted).toBe(true)
  })
})

describe('buildSlotProgress — within-set steps (#407)', () => {
  /** Back Day 1's real rack run: 35 → 30 → 25 → 20, two passes. */
  const RACK_STEPS: TemplateSlotStep[] = [
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

  function template(s: TemplateSlot): WorkoutTemplate {
    return { id: 't1', name: 'Back Day 1', position: 0, slots: [s] }
  }

  function mini(stepId: string, weight: number, id: string): StrengthSet {
    return set({
      id,
      exercise: 'dumbbell-curl',
      weight_lbs: weight,
      template_slot_id: 'slot-rack',
      template_slot_step_id: stepId,
    })
  }

  /** One full pass down the rack. */
  function pass(round: number): StrengthSet[] {
    return RACK_STEPS.map((st, i) => mini(st.id, st.target_weight_lbs as number, `r${round}-${i}`))
  }

  it('counts a full pass as one prescribed set, not four', () => {
    const [progress] = buildSlotProgress(template(RACK), pass(1))
    expect(progress.logged).toBe(4)
    expect(progress.completedSets).toBe(1)
    expect(progress.isComplete).toBe(false)
  })

  it('is complete after two passes — eight rows, two sets', () => {
    const [progress] = buildSlotProgress(template(RACK), [...pass(1), ...pass(2)])
    expect(progress.logged).toBe(8)
    expect(progress.completedSets).toBe(2)
    expect(progress.isComplete).toBe(true)
  })

  it('does not call a partial pass a completed set', () => {
    // The exact bug this issue exists for: three rungs down is not a drop set.
    const [progress] = buildSlotProgress(template(RACK), pass(1).slice(0, 3))
    expect(progress.completedSets).toBe(0)
  })

  it('does not let a repeated rung fake a completed pass', () => {
    // 35, 35, 30, 25 is four rows but the 20 was never done.
    const sets = [
      mini('st-35', 35, 'a'),
      mini('st-35', 35, 'b'),
      mini('st-30', 30, 'c'),
      mini('st-25', 25, 'd'),
    ]
    expect(buildSlotProgress(template(RACK), sets)[0].completedSets).toBe(0)
  })

  it('walks the sequence in order on a fresh round', () => {
    expect(buildSlotProgress(template(RACK), [])[0].nextStep?.id).toBe('st-35')
    expect(buildSlotProgress(template(RACK), pass(1).slice(0, 1))[0].nextStep?.id).toBe('st-30')
    expect(buildSlotProgress(template(RACK), pass(1).slice(0, 3))[0].nextStep?.id).toBe('st-20')
  })

  it('resumes at the right rung after a full pass', () => {
    expect(buildSlotProgress(template(RACK), pass(1))[0].nextStep?.id).toBe('st-35')
  })

  it('resumes mid-round after a deleted mini-set rather than restarting', () => {
    // The 25 was removed; the next thing to log is the 25, not the 35.
    const sets = pass(1).filter(s => s.template_slot_step_id !== 'st-25')
    expect(buildSlotProgress(template(RACK), sets)[0].nextStep?.id).toBe('st-25')
  })

  it('leaves a straight slot completely unchanged', () => {
    const straight = slot({ id: 'slot-bench', target_sets: 4 })
    const sets = Array.from({ length: 3 }, (_, i) =>
      set({ id: `s${i}`, template_slot_id: 'slot-bench' })
    )
    const [progress] = buildSlotProgress(template(straight), sets)
    expect(progress.isStepped).toBe(false)
    expect(progress.nextStep).toBeNull()
    expect(progress.completedSets).toBe(3)
    expect(progress.logged).toBe(3)
    expect(progress.isComplete).toBe(false)
  })

  it('does not mistake a superset for a substitution', () => {
    // A superset's second step names a different movement on purpose. Comparing
    // it to the slot's exercise would flag every superset as a swap.
    const superset = slot({
      id: 'slot-super',
      exercise: 'barbell-bench-press',
      target_sets: 1,
      steps: [
        { id: 'sup-1', position: 0 },
        { id: 'sup-2', position: 1, exercise: 'cable-fly' },
      ],
    })
    const sets = [
      set({
        id: 'a',
        exercise: 'barbell-bench-press',
        template_slot_id: 'slot-super',
        template_slot_step_id: 'sup-1',
      }),
      set({
        id: 'b',
        exercise: 'cable-fly',
        template_slot_id: 'slot-super',
        template_slot_step_id: 'sup-2',
      }),
    ]
    const [progress] = buildSlotProgress(template(superset), sets)
    expect(progress.isSubstituted).toBe(false)
    expect(progress.completedSets).toBe(1)
    expect(progress.isComplete).toBe(true)
  })

  it('still detects a real substitution inside a stepped slot', () => {
    const sets = [mini('st-35', 35, 'a')].map(s => ({ ...s, exercise: 'barbell-curl' }))
    expect(buildSlotProgress(template(RACK), sets)[0].isSubstituted).toBe(true)
  })

  it('ignores a set whose step was deleted with the template', () => {
    // `on delete set null` leaves the row with a slot and no step.
    const orphan = set({ id: 'o', template_slot_id: 'slot-rack' })
    const [progress] = buildSlotProgress(template(RACK), [...pass(1), orphan])
    expect(progress.logged).toBe(5)
    expect(progress.completedSets).toBe(1)
  })
})

describe('nextSetDefaults — stepped slots (#407)', () => {
  const step30: TemplateSlotStep = { id: 'st-30', position: 1, target_weight_lbs: 30 }

  it("prefills the step's own load, not the previous set's", () => {
    // The whole point of a rack run is that the next rung is lighter. Repeating
    // the last set would hand you 35 when the next step prescribes 30.
    const previous = set({ id: 'a', weight_lbs: 35, template_slot_step_id: 'st-35' })
    const defaults = nextSetDefaults(slot({ steps: [step30] }), [previous], null, step30)
    expect(defaults.weight_lbs).toBe(30)
  })

  it('falls back to what was done on the same step last round', () => {
    const bare: TemplateSlotStep = { id: 'st-x', position: 0 }
    const lastRound = set({ id: 'a', reps: 12, weight_lbs: 22.5, template_slot_step_id: 'st-x' })
    const defaults = nextSetDefaults(slot({ steps: [bare] }), [lastRound], null, bare)
    expect(defaults.weight_lbs).toBe(22.5)
    expect(defaults.reps).toBe(12)
  })

  it('is unchanged for a straight set', () => {
    const previous = set({ id: 'a', reps: 8, weight_lbs: 155 })
    const defaults = nextSetDefaults(slot(), [previous])
    expect(defaults).toEqual({ reps: 8, weight_lbs: 155 })
  })
})
