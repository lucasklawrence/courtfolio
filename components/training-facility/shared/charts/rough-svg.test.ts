import { describe, it, expect } from 'vitest'
import { extent } from './rough-svg'

describe('extent', () => {
  it('returns [Infinity, -Infinity] for an empty array (sentinel range)', () => {
    // Callers can detect an empty input by checking !isFinite(min). The function
    // intentionally doesn't throw — chart primitives handle empty data themselves.
    const [min, max] = extent([])
    expect(min).toBe(Infinity)
    expect(max).toBe(-Infinity)
  })

  it('returns the same value for both bounds when given a single sample', () => {
    expect(extent([42])).toEqual([42, 42])
    expect(extent([-3.14])).toEqual([-3.14, -3.14])
  })

  it('finds min and max across mixed-sign values', () => {
    expect(extent([3, 1, 4, 1, 5, 9, 2, 6])).toEqual([1, 9])
    expect(extent([-5, 0, 5])).toEqual([-5, 5])
  })

  it('skips NaN values rather than treating them as min or max', () => {
    // Comparisons against NaN always return false, so NaN is naturally skipped.
    // Test guards against a future regression where someone "fixes" the loop.
    expect(extent([1, NaN, 3, NaN, 2])).toEqual([1, 3])
  })

  it('returns sentinel range when every value is NaN', () => {
    const [min, max] = extent([NaN, NaN, NaN])
    expect(min).toBe(Infinity)
    expect(max).toBe(-Infinity)
  })

  it('handles Infinity and -Infinity as legitimate bounds', () => {
    expect(extent([-Infinity, 0, Infinity])).toEqual([-Infinity, Infinity])
  })
})
