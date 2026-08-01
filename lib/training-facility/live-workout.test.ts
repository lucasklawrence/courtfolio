import { describe, expect, it } from 'vitest'

import type { StrengthSet, TemplateSlot, WorkoutTemplate } from '@/types/weight-room'

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
