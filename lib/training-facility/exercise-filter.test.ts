import { describe, expect, it } from 'vitest'

import {
  parseExerciseSelection,
  serializeExerciseSelection,
  toggleExercise,
} from './exercise-filter'

/** Render order for the History page's exercises. */
const AVAILABLE = ['pushups', 'pullups', 'squats', 'shrugs']

describe('parseExerciseSelection', () => {
  it('selects everything when the param is absent', () => {
    expect(parseExerciseSelection(null, AVAILABLE)).toEqual(AVAILABLE)
    expect(parseExerciseSelection(undefined, AVAILABLE)).toEqual(AVAILABLE)
  })

  it('selects nothing when the param is present but empty', () => {
    // Distinct from absent: this is a deliberate "show nothing", and is what
    // serializeExerciseSelection emits for an empty selection.
    expect(parseExerciseSelection('', AVAILABLE)).toEqual([])
    expect(parseExerciseSelection('   ', AVAILABLE)).toEqual([])
  })

  it('selects the named subset', () => {
    expect(parseExerciseSelection('pushups,squats', AVAILABLE)).toEqual(['pushups', 'squats'])
  })

  it('returns the subset in available order, not param order', () => {
    expect(parseExerciseSelection('squats,pushups', AVAILABLE)).toEqual(['pushups', 'squats'])
  })

  it('tolerates whitespace and casing', () => {
    expect(parseExerciseSelection(' Pushups , SQUATS ', AVAILABLE)).toEqual(['pushups', 'squats'])
  })

  it('drops unknown names so a stale link still renders what exists', () => {
    expect(parseExerciseSelection('pushups,dips', AVAILABLE)).toEqual(['pushups'])
  })

  it('yields an empty selection when every named exercise is unknown', () => {
    // Deliberate selection of nothing, distinct from an absent param.
    expect(parseExerciseSelection('dips', AVAILABLE)).toEqual([])
  })

  it('reads the first entry when the key is repeated', () => {
    expect(parseExerciseSelection(['pushups', 'squats'], AVAILABLE)).toEqual(['pushups'])
  })
})

describe('serializeExerciseSelection', () => {
  it('returns null when everything is selected so the param is dropped', () => {
    expect(serializeExerciseSelection(AVAILABLE, AVAILABLE)).toBeNull()
  })

  it('encodes a partial selection', () => {
    expect(serializeExerciseSelection(['pushups', 'squats'], AVAILABLE)).toBe('pushups,squats')
  })

  it('encodes an empty selection as an empty string, not null', () => {
    // Distinguishable from "no param" so deselecting everything survives a
    // reload instead of silently resetting to all.
    expect(serializeExerciseSelection([], AVAILABLE)).toBe('')
  })
})

describe('parse/serialize round trip', () => {
  it.each([
    ['everything', AVAILABLE],
    ['a subset', ['pushups', 'squats']],
    ['a single exercise', ['shrugs']],
    ['nothing', [] as string[]],
  ])('survives %s', (_label, selection) => {
    const encoded = serializeExerciseSelection(selection, AVAILABLE)
    expect(parseExerciseSelection(encoded, AVAILABLE)).toEqual(selection)
  })
})

describe('toggleExercise', () => {
  it('removes a selected exercise', () => {
    expect(toggleExercise(AVAILABLE, 'squats', AVAILABLE)).toEqual([
      'pushups',
      'pullups',
      'shrugs',
    ])
  })

  it('adds an unselected exercise back in available order', () => {
    expect(toggleExercise(['pushups', 'shrugs'], 'pullups', AVAILABLE)).toEqual([
      'pushups',
      'pullups',
      'shrugs',
    ])
  })

  it('round-trips to the original selection', () => {
    const once = toggleExercise(AVAILABLE, 'pullups', AVAILABLE)
    expect(toggleExercise(once, 'pullups', AVAILABLE)).toEqual(AVAILABLE)
  })
})
