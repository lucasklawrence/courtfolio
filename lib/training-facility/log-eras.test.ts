/**
 * Tests for the whole-log era split (#437).
 *
 * The load-bearing cases: the split lands on the *longest* layoff rather than
 * the first one over the threshold, the empty months between the eras are
 * present rather than skipped, and a log with no real layoff refuses to split
 * instead of manufacturing a comparison.
 */
import { describe, expect, it } from 'vitest'

import type { StrengthSet, WeightRoomExercise } from '@/types/weight-room'

import { buildLogEras } from './log-eras'

/** A set on a given Pacific day. */
function set(dayKey: string, exercise: string, reps = 10, weight?: number): StrengthSet {
  return {
    id: `${dayKey}-${exercise}-${reps}-${weight ?? 'bw'}`,
    logged_at: `${dayKey}T20:00:00Z`,
    exercise,
    reps,
    ...(weight === undefined ? {} : { weight_lbs: weight }),
  }
}

const CATALOG: WeightRoomExercise[] = [
  { slug: 'barbell-bench-press', display_name: 'Barbell Bench Press', load_multiplier: 1 },
  { slug: 'pushups', display_name: 'Pushups', load_multiplier: 0 },
  { slug: 'pullups', display_name: 'Pullups', load_multiplier: 0 },
] as unknown as WeightRoomExercise[]

/**
 * An archive era of loaded work, a long layoff, then a bodyweight era.
 *
 * The archive days are spread across its span on purpose: leaving a two-year
 * hole *inside* it would make that the longest gap, and the split would land
 * there rather than on the layoff under test.
 */
const TWO_ERAS: StrengthSet[] = [
  set('2022-03-03', 'barbell-bench-press', 8, 135),
  set('2022-03-10', 'barbell-bench-press', 8, 145),
  set('2022-03-10', 'pullups', 6),
  set('2022-09-14', 'barbell-bench-press', 6, 155),
  set('2023-03-21', 'barbell-bench-press', 6, 165),
  set('2023-10-04', 'pullups', 7),
  set('2024-04-18', 'barbell-bench-press', 5, 185),
  // 767-day layoff.
  set('2026-05-25', 'pushups', 25),
  set('2026-08-09', 'pushups', 30),
  set('2026-08-09', 'pullups', 8),
]

describe('buildLogEras', () => {
  it('splits at the layoff and describes each side', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    expect(eras).not.toBeNull()
    expect(eras?.then.startDayKey).toBe('2022-03-03')
    expect(eras?.then.endDayKey).toBe('2024-04-18')
    expect(eras?.now.startDayKey).toBe('2026-05-25')
    expect(eras?.now.endDayKey).toBe('2026-08-09')
    expect(eras?.gapDays).toBe(767)
  })

  it('counts loaded share per era, which is where the change in kind shows', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    // Archive: 5 loaded bench sets out of 7. Current: nothing loaded at all.
    expect(eras?.then.sets).toBe(7)
    expect(eras?.then.loadedSets).toBe(5)
    expect(eras?.then.loadedShare).toBeCloseTo(5 / 7)
    expect(eras?.now.loadedSets).toBe(0)
    expect(eras?.now.loadedShare).toBe(0)
  })

  it('counts a weighted bodyweight movement as loaded', () => {
    // A weighted pushup is loaded work; `load_multiplier` is an implement
    // count, not a bodyweight flag, so it never decides whether a set
    // qualifies.
    const eras = buildLogEras([...TWO_ERAS, set('2026-08-09', 'pushups', 20, 25)], CATALOG)
    expect(eras?.now.loadedSets).toBe(1)
  })

  it('splits at the longest layoff, not the first one over the threshold', () => {
    const twoGaps: StrengthSet[] = [
      set('2020-01-01', 'pullups'),
      // 200-day gap — over the threshold, but not the longest.
      set('2020-07-19', 'pullups'),
      // 900-day gap.
      set('2023-01-05', 'pushups'),
      set('2023-02-05', 'pushups'),
    ]
    const eras = buildLogEras(twoGaps, CATALOG)
    expect(eras?.then.endDayKey).toBe('2020-07-19')
    expect(eras?.now.startDayKey).toBe('2023-01-05')
  })

  it('refuses to split a log with no long layoff', () => {
    // One continuous stretch has no "then"; inventing a boundary would
    // manufacture the comparison the page exists to make.
    const continuous = [set('2026-05-01', 'pushups'), set('2026-06-01', 'pushups')]
    expect(buildLogEras(continuous, CATALOG)).toBeNull()
  })

  it('is null for an empty log', () => {
    expect(buildLogEras([], CATALOG)).toBeNull()
  })

  it('keeps the empty months so the layoff occupies space', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    const months = eras?.months ?? []
    // Contiguous from the first month to the last, gaps included.
    expect(months[0].monthKey).toBe('2022-03')
    expect(months[months.length - 1].monthKey).toBe('2026-08')
    const gapMonths = months.filter(m => m.era === 'gap')
    expect(gapMonths.length).toBeGreaterThan(12)
    expect(gapMonths.every(m => m.trainingDays === 0)).toBe(true)
  })

  it('rolls the calendar over a year boundary', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    const keys = (eras?.months ?? []).map(m => m.monthKey)
    expect(keys).toContain('2022-12')
    expect(keys).toContain('2023-01')
    // Strictly ascending, no repeats.
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('labels each month by the era it belongs to', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    const months = eras?.months ?? []
    expect(months.find(m => m.monthKey === '2022-03')?.era).toBe('then')
    expect(months.find(m => m.monthKey === '2025-01')?.era).toBe('gap')
    expect(months.find(m => m.monthKey === '2026-08')?.era).toBe('now')
  })

  it('separates movements exclusive to one era from the shared ones', () => {
    const eras = buildLogEras(TWO_ERAS, CATALOG)
    expect(eras?.roster.thenOnly).toEqual(['barbell-bench-press'])
    expect(eras?.roster.shared).toEqual(['pullups'])
    expect(eras?.roster.nowOnly).toEqual(['pushups'])
  })

  it('buckets a set on its Pacific day, not its UTC one', () => {
    // 2026-05-26 03:00 UTC is still May 25 in Pacific.
    const eras = buildLogEras(
      [set('2022-03-03', 'pullups'), { ...set('x', 'pushups'), logged_at: '2026-05-26T03:00:00Z' }],
      CATALOG
    )
    expect(eras?.now.startDayKey).toBe('2026-05-25')
  })
})
