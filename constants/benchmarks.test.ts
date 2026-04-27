import { describe, it, expect } from 'vitest'
import { BENCHMARKS, METRIC_KEYS, isMetricKey } from './benchmarks'

describe('isMetricKey', () => {
  it('returns true for every defined metric key', () => {
    for (const key of METRIC_KEYS) {
      expect(isMetricKey(key)).toBe(true)
    }
  })

  it('returns false for unknown strings', () => {
    expect(isMetricKey('')).toBe(false)
    expect(isMetricKey('not_a_metric')).toBe(false)
    expect(isMetricKey('date')).toBe(false) // present on Benchmark, not on BENCHMARKS
  })

  it('does not false-positive on inherited Object prototype props', () => {
    // The whole reason isMetricKey uses Object.hasOwn rather than `in`.
    expect(isMetricKey('toString')).toBe(false)
    expect(isMetricKey('hasOwnProperty')).toBe(false)
    expect(isMetricKey('__proto__')).toBe(false)
    expect(isMetricKey('constructor')).toBe(false)
  })
})

describe('METRIC_KEYS / BENCHMARKS parity', () => {
  it('METRIC_KEYS length matches Object.keys(BENCHMARKS) length', () => {
    expect(METRIC_KEYS.length).toBe(Object.keys(BENCHMARKS).length)
  })

  it('METRIC_KEYS is a subset of BENCHMARKS keys (every key has a config)', () => {
    for (const key of METRIC_KEYS) {
      expect(BENCHMARKS[key]).toBeDefined()
    }
  })

  it('every BENCHMARKS entry has the required display fields', () => {
    for (const [key, spec] of Object.entries(BENCHMARKS)) {
      expect(spec.label, `${key}.label`).toBeTruthy()
      expect(spec.shortLabel, `${key}.shortLabel`).toBeTruthy()
      expect(spec.precision, `${key}.precision`).toBeGreaterThanOrEqual(0)
      const [min, max] = spec.targetRange
      expect(min, `${key}.targetRange[min]`).toBeLessThan(max)
    }
  })
})
