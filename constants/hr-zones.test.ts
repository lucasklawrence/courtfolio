import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MAX_HR,
  HR_ZONES,
  bpmRangeForZone,
  estimateMaxHr,
  hrZoneForBpm,
} from './hr-zones'

describe('estimateMaxHr', () => {
  it('returns 220 - age for valid ages', () => {
    expect(estimateMaxHr(35)).toBe(185)
    expect(estimateMaxHr(20)).toBe(200)
    expect(estimateMaxHr(60)).toBe(160)
  })

  it.each([0, 121, -1, 999, NaN, Infinity, -Infinity])(
    'throws RangeError for out-of-range age %s',
    (age) => {
      expect(() => estimateMaxHr(age)).toThrow(RangeError)
    },
  )

  it('accepts the inclusive bounds 1 and 120', () => {
    expect(estimateMaxHr(1)).toBe(219)
    expect(estimateMaxHr(120)).toBe(100)
  })
})

describe('hrZoneForBpm', () => {
  // With DEFAULT_MAX_HR = 185, zone seams in BPM:
  //   Z1 [0.5,0.6) → [92.5, 111)   → 93 enters Z1, 111 enters Z2
  //   Z2 [0.6,0.7) → [111, 129.5)  → 111 enters Z2, 130 enters Z3
  //   Z5 [0.9,1.0] → [166.5, 185]  → 185 stays Z5 (inclusive on Z5 max)
  it('returns the lowest-bound zone at the seam', () => {
    expect(hrZoneForBpm(111, 185)).toBe('Z2') // 0.6 exactly → Z2 (lower bound is inclusive)
    expect(hrZoneForBpm(110.999, 185)).toBe('Z1') // just under 0.6 → Z1
  })

  it('returns null for sub-Z1 samples', () => {
    expect(hrZoneForBpm(60, 185)).toBeNull() // 0.32 of max → below Z1
    expect(hrZoneForBpm(0, 185)).toBeNull()
  })

  it('keeps 100% of maxHR in Z5 (inclusive Z5 upper bound)', () => {
    expect(hrZoneForBpm(185, 185)).toBe('Z5')
  })

  it('clamps above-100% samples into Z5 instead of dropping them', () => {
    expect(hrZoneForBpm(220, 185)).toBe('Z5') // 1.19 of max — sensor glitch territory
  })

  it('returns null when maxHr is non-positive', () => {
    expect(hrZoneForBpm(150, 0)).toBeNull()
    expect(hrZoneForBpm(150, -1)).toBeNull()
  })

  it('uses DEFAULT_MAX_HR when caller omits maxHr', () => {
    // 130 / 185 ≈ 0.703 → just into Z3 (Z3 starts at 0.7).
    expect(hrZoneForBpm(130)).toBe('Z3')
    expect(hrZoneForBpm(130, DEFAULT_MAX_HR)).toBe('Z3')
  })
})

describe('bpmRangeForZone', () => {
  it('rounds the percentage range to whole BPM', () => {
    const z2 = HR_ZONES.find((z) => z.id === 'Z2')!
    // 0.6 * 185 = 111, 0.7 * 185 = 129.5 → rounds to [111, 130]
    expect(bpmRangeForZone(z2, 185)).toEqual([111, 130])
  })

  it('uses DEFAULT_MAX_HR by default', () => {
    const z5 = HR_ZONES.find((z) => z.id === 'Z5')!
    expect(bpmRangeForZone(z5)).toEqual([167, 185])
  })

  it('scales correctly for a non-default max', () => {
    const z1 = HR_ZONES.find((z) => z.id === 'Z1')!
    // 0.5 * 200 = 100, 0.6 * 200 = 120
    expect(bpmRangeForZone(z1, 200)).toEqual([100, 120])
  })
})

describe('HR_ZONES table invariants', () => {
  it('has exactly 5 zones in ascending intensity order', () => {
    expect(HR_ZONES).toHaveLength(5)
    const ids = HR_ZONES.map((z) => z.id)
    expect(ids).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
  })

  it('has contiguous bounds — every zone max is the next zone min', () => {
    for (let i = 0; i < HR_ZONES.length - 1; i++) {
      expect(HR_ZONES[i].maxPct).toBe(HR_ZONES[i + 1].minPct)
    }
  })
})
