import { describe, expect, it } from 'vitest'

import { exerciseLabel, slugLabel } from './exercise-labels'

describe('exerciseLabel (#384)', () => {
  it('prefers the catalog label', () => {
    expect(
      exerciseLabel({ exercise: 'barbell-bench-press', display_name: 'Barbell Bench Press' }),
    ).toBe('Barbell Bench Press')
  })

  it('falls back to the slug when the catalog has no row', () => {
    // The pre-#384 behavior — a partially-migrated project still renders.
    expect(exerciseLabel({ exercise: 'pushups' })).toBe('pushups')
  })

  it('keeps a label the slug could never produce', () => {
    // The reason this reads the catalog rather than detokenizing the slug.
    expect(exerciseLabel({ exercise: 'farmers-carry', display_name: "Farmer's Carry" })).toBe(
      "Farmer's Carry",
    )
  })

  it('does not treat an empty label as a fallback trigger', () => {
    // The column is `check (btrim(display_name) <> '')`, so an empty string
    // can't come from the catalog — but if it ever did, surfacing it is more
    // honest than silently swapping in the slug and hiding the bad row.
    expect(exerciseLabel({ exercise: 'pushups', display_name: '' })).toBe('')
  })
})

describe('slugLabel (#384)', () => {
  it('reads the label off the matching record', () => {
    expect(
      slugLabel('barbell-row', { exercise: 'barbell-row', display_name: 'Barbell Row' }),
    ).toBe('Barbell Row')
  })

  it('falls back to the slug with no record', () => {
    // A set whose goal was deleted still renders — the sets outlive the goal
    // by design (#373), so this path is reachable, not theoretical.
    expect(slugLabel('barbell-row')).toBe('barbell-row')
    expect(slugLabel('barbell-row', { exercise: 'barbell-row' })).toBe('barbell-row')
  })
})
