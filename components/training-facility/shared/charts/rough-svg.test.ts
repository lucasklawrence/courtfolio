import { describe, it, expect } from 'vitest'
import { drawableToPaths, extent, getGenerator, roundSvgCoordinate } from './rough-svg'

describe('roundSvgCoordinate', () => {
  it('makes two values that differ only in their last float digits identical', () => {
    // A real pair from a server and browser render of the same seeded path.
    expect(roundSvgCoordinate(354.85143271632626)).toBe(roundSvgCoordinate(354.85143271632628))
    expect(roundSvgCoordinate(147.79467149218922)).toBe(147.79)
  })
})

describe('drawableToPaths', () => {
  it('rounds every coordinate in the path data', () => {
    const drawable = getGenerator().line(0.123456, 1.987654, 100.5, 200.25, { seed: 7 })
    const [path] = drawableToPaths(drawable)
    const decimals = path.d.match(/\.\d+/g) ?? []
    expect(decimals.length).toBeGreaterThan(0)
    expect(decimals.every(decimal => decimal.length <= 3)).toBe(true)
  })

  it('keeps the same seed drawing the same path', () => {
    const draw = () => drawableToPaths(getGenerator().line(0, 0, 100, 100, { seed: 7 }))[0].d
    expect(draw()).toBe(draw())
  })
})

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
