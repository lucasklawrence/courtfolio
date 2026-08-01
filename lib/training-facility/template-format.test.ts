import { describe, expect, it } from 'vitest'

import type { TemplateSlot } from '@/types/weight-room'

import {
  AMRAP_LABEL,
  formatRepRange,
  formatSetCount,
  formatSlotPrescription,
  isSuperset,
} from './template-format'

/**
 * Coverage for template prescription formatting (#375) — mostly the awkward
 * cases the six seeded templates actually contain: set ranges, absent rep
 * targets, and a drop set's descending loads.
 */

/** A slot with sensible defaults; override what the case is about. */
function slot(overrides: Partial<TemplateSlot> = {}): TemplateSlot {
  return {
    id: 's1',
    position: 0,
    exercise: 'barbell-bench-press',
    target_sets: 4,
    steps: [],
    alternates: [],
    ...overrides,
  }
}

describe('formatSetCount', () => {
  it('shows a single count when there is no range', () => {
    expect(formatSetCount(slot())).toBe('4')
  })

  it('shows a range when target_sets_max differs — "Skull Crushers 4-5 sets"', () => {
    expect(formatSetCount(slot({ target_sets_max: 5 }))).toBe('4-5')
  })

  it('collapses a range whose ends are equal', () => {
    expect(formatSetCount(slot({ target_sets_max: 4 }))).toBe('4')
  })
})

describe('formatRepRange', () => {
  it('returns null when there is no rep target', () => {
    // Not zero, and not an omission — it means AMRAP, and is also how a
    // transcribed template that only recorded set counts arrives.
    expect(formatRepRange(slot())).toBeNull()
  })

  it('formats an exact prescription', () => {
    expect(formatRepRange(slot({ target_reps: 5 }))).toBe('5')
  })

  it('formats a range', () => {
    expect(formatRepRange(slot({ target_reps: 8, target_reps_max: 12 }))).toBe('8-12')
  })
})

describe('formatSlotPrescription', () => {
  it('formats the ordinary case', () => {
    expect(formatSlotPrescription(slot({ target_reps: 5 }))).toBe('4 × 5')
  })

  it('renders an absent rep target as "to failure" rather than a blank or a zero', () => {
    expect(formatSlotPrescription(slot())).toBe(`4 × ${AMRAP_LABEL}`)
  })

  it('combines ranges on both axes', () => {
    expect(
      formatSlotPrescription(slot({ target_sets_max: 5, target_reps: 8, target_reps_max: 12 })),
    ).toBe('4-5 × 8-12')
  })

  it('appends a prescribed load', () => {
    expect(formatSlotPrescription(slot({ target_reps: 5, target_weight_lbs: 185 }))).toBe(
      '4 × 5 @ 185 lb',
    )
  })

  it('surfaces a drop set’s descending loads from its steps', () => {
    // The rack run on Back Day 1: the loads live on the steps, not on the slot.
    const rackRun = slot({
      exercise: 'dumbbell-curl',
      target_sets: 2,
      steps: [
        { id: 'a', position: 0, target_weight_lbs: 35 },
        { id: 'b', position: 1, target_weight_lbs: 30 },
        { id: 'c', position: 2, target_weight_lbs: 25 },
        { id: 'd', position: 3, target_weight_lbs: 20 },
      ],
    })
    expect(formatSlotPrescription(rackRun)).toBe(
      `2 × ${AMRAP_LABEL} · 35 → 30 → 25 → 20 lb`,
    )
  })
})

describe('isSuperset', () => {
  it('is false for a plain straight set', () => {
    expect(isSuperset(slot())).toBe(false)
  })

  it('is false for a drop set — same movement, descending load', () => {
    expect(
      isSuperset(slot({ steps: [{ id: 'a', position: 0, target_weight_lbs: 35 }] })),
    ).toBe(false)
  })

  it('is true once a step names its own movement', () => {
    expect(
      isSuperset(slot({ steps: [{ id: 'a', position: 0, exercise: 'dumbbell-row' }] })),
    ).toBe(true)
  })
})
