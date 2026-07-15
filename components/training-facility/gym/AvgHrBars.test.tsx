import { describe, it, expect } from 'vitest'
import { pickEvenlySpacedIndices } from './AvgHrBars'

describe('pickEvenlySpacedIndices', () => {
  it('returns [] for a non-positive total', () => {
    expect(pickEvenlySpacedIndices(0, 12)).toEqual([])
    expect(pickEvenlySpacedIndices(-3, 12)).toEqual([])
  })

  it('keeps every index when the total fits under the cap', () => {
    expect(pickEvenlySpacedIndices(5, 12)).toEqual([0, 1, 2, 3, 4])
  })

  it('returns just the first index for a single point or a cap of one', () => {
    expect(pickEvenlySpacedIndices(1, 12)).toEqual([0])
    expect(pickEvenlySpacedIndices(40, 1)).toEqual([0])
  })

  it('thins a large total to at most maxLabels, spanning first→last', () => {
    const out = pickEvenlySpacedIndices(100, 12)
    expect(out.length).toBeLessThanOrEqual(12)
    expect(out[0]).toBe(0)
    expect(out[out.length - 1]).toBe(99)
  })

  it('returns a sorted, de-duplicated list of indices', () => {
    const out = pickEvenlySpacedIndices(100, 12)
    const sorted = [...out].sort((a, b) => a - b)
    expect(out).toEqual(sorted)
    expect(new Set(out).size).toBe(out.length)
  })
})
