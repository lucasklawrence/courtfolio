import { describe, expect, it } from 'vitest'

import { describeSet, describeSetOrHold, formatHold, formatLbs } from './strength-format'

/**
 * Coverage for load formatting (#427).
 *
 * The cases worth pinning are the defaults staying exactly as they were — this
 * is a parameterization, not a redesign, and every existing caller passes no
 * options — plus the deliberate non-behavior of `unit`: it relabels, it does not
 * convert.
 */

describe('formatLbs', () => {
  it('defaults to whole pounds, thousands separated', () => {
    expect(formatLbs(0)).toBe('0 lb')
    expect(formatLbs(60)).toBe('60 lb')
    expect(formatLbs(12345)).toBe('12,345 lb')
  })

  it('rounds rather than showing false precision', () => {
    // An Epley estimate is an estimate; a decimal implies a measurement.
    expect(formatLbs(204.1666)).toBe('204 lb')
    expect(formatLbs(0.4)).toBe('0 lb')
  })

  it('takes a unit label', () => {
    expect(formatLbs(60, { unit: 'kg' })).toBe('60 kg')
  })

  it('relabels without converting', () => {
    // The helper is handed a number and a label; inventing a conversion here
    // would silently rewrite the caller's data.
    expect(formatLbs(100, { unit: 'kg' })).toBe('100 kg')
  })

  it('takes a locale for separators', () => {
    expect(formatLbs(12345, { locale: 'de-DE' })).toBe('12.345 lb')
  })
})

describe('describeSet', () => {
  it('renders a loaded set as reps × load', () => {
    expect(describeSet(8, 60)).toBe('8 × 60 lb')
  })

  it('renders a bodyweight set as reps alone', () => {
    // Zero load is bodyweight, not a set that moved nothing.
    expect(describeSet(12, 0)).toBe('12 reps')
  })

  it('forwards unit and locale to the load half', () => {
    expect(describeSet(5, 1250, { unit: 'kg', locale: 'de-DE' })).toBe('5 × 1.250 kg')
  })

  it('ignores options for a bodyweight set, which has no load to label', () => {
    expect(describeSet(12, 0, { unit: 'kg' })).toBe('12 reps')
  })
})

describe('formatHold', () => {
  it('reads seconds as seconds under a minute', () => {
    expect(formatHold(45)).toBe('45s')
    expect(formatHold(59)).toBe('59s')
  })

  it('switches to minutes:seconds past a minute', () => {
    // `135s` has to be divided in the head; `2:15` does not.
    expect(formatHold(60)).toBe('1:00')
    expect(formatHold(135)).toBe('2:15')
    expect(formatHold(90)).toBe('1:30')
  })

  it('rounds rather than claiming precision the source never had', () => {
    expect(formatHold(44.6)).toBe('45s')
  })
})

describe('describeSetOrHold', () => {
  it('describes a hold by its duration, not as one rep', () => {
    // A plank is stored as `reps: 1, duration_seconds: 45` so rep rollups keep
    // working — but "1 rep" is a useless thing to show someone.
    expect(describeSetOrHold({ reps: 1, effectiveLoad: 0, durationSeconds: 45 })).toBe('45s')
  })

  it('appends the load when the hold was weighted', () => {
    expect(describeSetOrHold({ reps: 1, effectiveLoad: 25, durationSeconds: 60 })).toBe(
      '1:00 × 25 lb'
    )
  })

  it('falls back to the rep description when there is no duration', () => {
    expect(describeSetOrHold({ reps: 8, effectiveLoad: 60 })).toBe('8 × 60 lb')
    expect(describeSetOrHold({ reps: 12, effectiveLoad: 0, durationSeconds: null })).toBe('12 reps')
  })

  it('ignores a nonsensical duration rather than rendering it', () => {
    expect(describeSetOrHold({ reps: 12, effectiveLoad: 0, durationSeconds: 0 })).toBe('12 reps')
  })

  it('says what a to-failure set was, not its placeholder rep count', () => {
    // A rack-run drop stores `reps: 1` meaning "one set" (#435). Printing
    // "1 rep" would claim a count that was never recorded.
    expect(describeSetOrHold({ reps: 1, effectiveLoad: 50, toFailure: true })).toBe(
      '50 lb to failure'
    )
  })

  it('describes an unloaded to-failure set without inventing a load', () => {
    expect(describeSetOrHold({ reps: 1, effectiveLoad: 0, toFailure: true })).toBe('to failure')
  })

  it('leaves ordinary sets alone when the flag is absent or false', () => {
    expect(describeSetOrHold({ reps: 8, effectiveLoad: 60, toFailure: false })).toBe('8 × 60 lb')
  })
})
