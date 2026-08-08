import { describe, expect, it } from 'vitest'

import { describeSet, formatLbs } from './strength-format'

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
