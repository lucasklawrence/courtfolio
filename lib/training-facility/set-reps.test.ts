/**
 * Tests for reading a possibly-unrecorded rep count (#440).
 *
 * The distinction these defend: `null` means nobody wrote the number down,
 * which is not the same as zero. Summing it as `0` is right — unknown work adds
 * nothing — but *displaying* it as `0` would assert a set of no reps, which is
 * precisely the false claim the nullable column exists to stop.
 */
import { describe, expect, it } from 'vitest'

import { countedReps, hasRecordedReps, repsLabel } from './set-reps'

describe('countedReps', () => {
  it('returns a recorded count unchanged', () => {
    expect(countedReps({ reps: 12 })).toBe(12)
    expect(countedReps(12)).toBe(12)
  })

  it('treats an unrecorded count as contributing nothing', () => {
    expect(countedReps({ reps: null })).toBe(0)
    expect(countedReps(null)).toBe(0)
    expect(countedReps(undefined)).toBe(0)
  })

  it('sums a mixed list without inventing reps', () => {
    // The rack-run case: two counted sets and three drops taken to failure.
    const sets = [{ reps: 10 }, { reps: null }, { reps: 8 }, { reps: null }, { reps: null }]
    expect(sets.reduce((n, s) => n + countedReps(s), 0)).toBe(18)
  })
})

describe('hasRecordedReps', () => {
  it('distinguishes a recorded count from an absent one', () => {
    expect(hasRecordedReps({ reps: 1 })).toBe(true)
    expect(hasRecordedReps({ reps: null })).toBe(false)
  })

  it('counts zero as recorded, since the column forbids it anyway', () => {
    // Guards the implementation against a truthiness check, which would call a
    // legitimately-stored 0 "unrecorded".
    expect(hasRecordedReps({ reps: 0 })).toBe(true)
  })
})

describe('repsLabel', () => {
  it('renders a recorded count as its number', () => {
    expect(repsLabel({ reps: 8 })).toBe('8')
    expect(repsLabel(8)).toBe('8')
  })

  it('renders an unrecorded count as a dash, never as zero', () => {
    expect(repsLabel({ reps: null })).toBe('—')
    expect(repsLabel(null)).toBe('—')
    expect(repsLabel(undefined)).toBe('—')
  })

  it('takes a caller-supplied placeholder', () => {
    expect(repsLabel(null, '?')).toBe('?')
  })
})
