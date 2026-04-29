import { describe, expect, it } from 'vitest'
import type { Benchmark } from '@/types/movement'
import { freshnessOpacity, selectJumpEntries } from './jump-tracker-utils'

describe('selectJumpEntries', () => {
  it('returns an empty array when no entries have a vertical', () => {
    const noJumps: Benchmark[] = [
      { date: '2026-01-15', bodyweight_lbs: 240 },
      { date: '2026-02-15', shuttle_5_10_5_s: 5.4 },
    ]
    expect(selectJumpEntries(noJumps)).toEqual([])
  })

  it('drops entries without a vertical_in value', () => {
    const mixed: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-02-15' },
      { date: '2026-03-15', vertical_in: 21 },
    ]
    const result = selectJumpEntries(mixed)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.date)).toEqual(['2026-01-15', '2026-03-15'])
  })

  it('drops sessions explicitly marked is_complete: false', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-02-15', vertical_in: 20, is_complete: false },
      { date: '2026-03-15', vertical_in: 21 },
    ]
    expect(selectJumpEntries(entries).map((e) => e.date)).toEqual([
      '2026-01-15',
      '2026-03-15',
    ])
  })

  it('sorts oldest → newest so the last element is the "latest" silhouette', () => {
    const unsorted: Benchmark[] = [
      { date: '2026-04-15', vertical_in: 23 },
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-03-15', vertical_in: 21 },
    ]
    expect(selectJumpEntries(unsorted).map((e) => e.date)).toEqual([
      '2026-01-15',
      '2026-03-15',
      '2026-04-15',
    ])
  })

  it('preserves bodyweight on the projected entry for tooltip use', () => {
    const entries: Benchmark[] = [
      { date: '2026-04-15', vertical_in: 23, bodyweight_lbs: 232 },
    ]
    expect(selectJumpEntries(entries)[0]?.bodyweightLbs).toBe(232)
  })
})

describe('freshnessOpacity', () => {
  it('returns 1 for a single-entry stack — no fade gradient possible', () => {
    expect(freshnessOpacity(0, 1)).toBe(1)
  })

  it('puts the newest entry at full opacity', () => {
    expect(freshnessOpacity(2, 3)).toBe(1)
  })

  it('puts the oldest entry at the floor opacity', () => {
    expect(freshnessOpacity(0, 3)).toBe(0.25)
  })

  it('interpolates linearly for middle entries', () => {
    expect(freshnessOpacity(1, 3)).toBeCloseTo(0.625, 5)
  })

  it('honors a caller-provided floor', () => {
    expect(freshnessOpacity(0, 4, 0.1)).toBe(0.1)
  })
})
