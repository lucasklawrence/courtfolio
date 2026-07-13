import { describe, it, expect } from 'vitest'

import {
  classifyAcwr,
  classifyWowPct,
  combineFlags,
  RAMP_FLAGS,
  RAMP_RATE_THRESHOLDS,
  type RampRateThresholds,
} from './ramp-rate'

describe('classifyAcwr', () => {
  it('returns green when there is no baseline (null / non-finite)', () => {
    expect(classifyAcwr(null)).toBe('green')
    expect(classifyAcwr(Number.NaN)).toBe('green')
    expect(classifyAcwr(Number.POSITIVE_INFINITY)).toBe('green')
  })

  it('flags detraining below 0.8', () => {
    expect(classifyAcwr(0.5)).toBe('yellow')
    expect(classifyAcwr(0.79)).toBe('yellow')
  })

  it('is green across the sweet spot [0.8, 1.3]', () => {
    expect(classifyAcwr(0.8)).toBe('green')
    expect(classifyAcwr(1.0)).toBe('green')
    expect(classifyAcwr(1.3)).toBe('green')
  })

  it('flags elevated in (1.3, 1.5]', () => {
    expect(classifyAcwr(1.31)).toBe('yellow')
    expect(classifyAcwr(1.5)).toBe('yellow')
  })

  it('flags red above 1.5', () => {
    expect(classifyAcwr(1.51)).toBe('red')
    expect(classifyAcwr(2)).toBe('red')
  })

  it('honors overridden thresholds', () => {
    const strict: RampRateThresholds = {
      ...RAMP_RATE_THRESHOLDS,
      acwrGreenMax: 1.1,
      acwrElevatedMax: 1.2,
    }
    // 1.4 is elevated (yellow) by default but red under the tighter ceiling.
    expect(classifyAcwr(1.4)).toBe('yellow')
    expect(classifyAcwr(1.4, strict)).toBe('red')
  })
})

describe('classifyWowPct', () => {
  it('returns green when there is no prior week (null / non-finite)', () => {
    expect(classifyWowPct(null)).toBe('green')
    expect(classifyWowPct(Number.NaN)).toBe('green')
  })

  it('is green at or below the +10% ceiling', () => {
    expect(classifyWowPct(0)).toBe('green')
    expect(classifyWowPct(0.1)).toBe('green')
  })

  it('is green for flat-or-down weeks', () => {
    expect(classifyWowPct(-0.25)).toBe('green')
  })

  it('flags yellow above +10%', () => {
    expect(classifyWowPct(0.1001)).toBe('yellow')
    expect(classifyWowPct(0.5)).toBe('yellow')
  })

  it('honors an overridden ceiling', () => {
    const loose: RampRateThresholds = { ...RAMP_RATE_THRESHOLDS, wowYellowPct: 0.25 }
    expect(classifyWowPct(0.2, loose)).toBe('green')
    expect(classifyWowPct(0.2)).toBe('yellow')
  })
})

describe('combineFlags', () => {
  it('returns green with no flags', () => {
    expect(combineFlags()).toBe('green')
  })

  it('returns the worst of the given flags', () => {
    expect(combineFlags('green', 'green')).toBe('green')
    expect(combineFlags('green', 'yellow')).toBe('yellow')
    expect(combineFlags('yellow', 'red')).toBe('red')
    expect(combineFlags('red', 'green')).toBe('red')
  })
})

describe('RAMP_FLAGS', () => {
  it('has metadata for every flag', () => {
    for (const flag of ['green', 'yellow', 'red'] as const) {
      expect(RAMP_FLAGS[flag].flag).toBe(flag)
      expect(RAMP_FLAGS[flag].color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(RAMP_FLAGS[flag].label.length).toBeGreaterThan(0)
    }
  })
})
