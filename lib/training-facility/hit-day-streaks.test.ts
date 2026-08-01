import { describe, expect, it } from 'vitest'

import { streakFromDailyReps, streakFromHitDays } from './hit-day-streaks'

/**
 * Unit tests for the consolidated streak algorithm (#366).
 *
 * This replaced two independent implementations, so it's worth pinning
 * directly rather than only through its callers: the grace period, the
 * longest-vs-current split, and the DST-safe day arithmetic are exactly the
 * behaviours that would drift if the two copies had been merged carelessly.
 */

describe('streakFromHitDays', () => {
  it('returns zeroes for no hit days', () => {
    expect(streakFromHitDays([], '2026-07-15')).toEqual({ current: 0, longest: 0 })
  })

  it('counts a single hit day as a streak of 1', () => {
    expect(streakFromHitDays(['2026-07-15'], '2026-07-15')).toEqual({ current: 1, longest: 1 })
  })

  it('counts consecutive days', () => {
    const days = ['2026-07-13', '2026-07-14', '2026-07-15']
    expect(streakFromHitDays(days, '2026-07-15')).toEqual({ current: 3, longest: 3 })
  })

  it('sorts unordered input rather than trusting the caller', () => {
    const days = ['2026-07-15', '2026-07-13', '2026-07-14']
    expect(streakFromHitDays(days, '2026-07-15')).toEqual({ current: 3, longest: 3 })
  })

  it('does not mutate the caller-supplied array', () => {
    const days = ['2026-07-15', '2026-07-13']
    streakFromHitDays(days, '2026-07-15')
    expect(days).toEqual(['2026-07-15', '2026-07-13'])
  })

  it('breaks the run on a gap, keeping the longest', () => {
    // 3 days, gap, 2 days ending today.
    const days = [
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-14',
      '2026-07-15',
    ]
    expect(streakFromHitDays(days, '2026-07-15')).toEqual({ current: 2, longest: 3 })
  })

  it('keeps the streak alive when the last hit was yesterday', () => {
    // The grace period: without it a streak would read as broken every
    // morning until that day's first set landed.
    expect(streakFromHitDays(['2026-07-14', '2026-07-15'], '2026-07-16')).toEqual({
      current: 2,
      longest: 2,
    })
  })

  it('drops current to 0 once the last hit is older than yesterday', () => {
    const result = streakFromHitDays(['2026-07-14', '2026-07-15'], '2026-07-17')
    expect(result.current).toBe(0)
    expect(result.longest).toBe(2)
  })

  it('reports longest from the current run when it is the best', () => {
    const days = ['2026-07-01', '2026-07-13', '2026-07-14', '2026-07-15']
    expect(streakFromHitDays(days, '2026-07-15')).toEqual({ current: 3, longest: 3 })
  })

  it('counts across a month boundary', () => {
    const days = ['2026-07-30', '2026-07-31', '2026-08-01']
    expect(streakFromHitDays(days, '2026-08-01')).toEqual({ current: 3, longest: 3 })
  })

  it('counts across the spring-forward DST transition', () => {
    // 2026-03-08 is a 23-hour Pacific day; millisecond arithmetic would
    // mis-step here, calendar arithmetic doesn't.
    const days = ['2026-03-07', '2026-03-08', '2026-03-09']
    expect(streakFromHitDays(days, '2026-03-09')).toEqual({ current: 3, longest: 3 })
  })

  it('counts across the fall-back DST transition', () => {
    const days = ['2026-10-31', '2026-11-01', '2026-11-02']
    expect(streakFromHitDays(days, '2026-11-02')).toEqual({ current: 3, longest: 3 })
  })

  it('yields current 0 but a real longest for an unparseable clock', () => {
    // `todayKey === ''` means "today is unknown" — better to report no active
    // streak than to invent one against a key that matches nothing.
    const result = streakFromHitDays(['2026-07-14', '2026-07-15'], '')
    expect(result.current).toBe(0)
    expect(result.longest).toBe(2)
  })
})

describe('streakFromDailyReps', () => {
  /** Every day scored against a flat target, the common case. */
  const flat = (n: number) => () => n

  it('counts only days that clear the target', () => {
    const reps = new Map([
      ['2026-07-13', 100],
      ['2026-07-14', 40], // short
      ['2026-07-15', 100],
    ])
    expect(streakFromDailyReps(reps, flat(100), '2026-07-15')).toEqual({
      current: 1,
      longest: 1,
    })
  })

  it('treats exactly hitting the target as a hit', () => {
    const reps = new Map([['2026-07-15', 100]])
    expect(streakFromDailyReps(reps, flat(100), '2026-07-15').current).toBe(1)
  })

  it('applies the per-day target rather than one scalar (#362)', () => {
    // 30 clears the old 30 bar on Jul 15 but not the 50 in force from Aug 1.
    const targetFor = (day: string): number => (day < '2026-08-01' ? 30 : 50)
    const reps = new Map([
      ['2026-07-15', 30],
      ['2026-08-15', 30],
    ])
    const result = streakFromDailyReps(reps, targetFor, '2026-08-15')
    expect(result.longest).toBe(1)
    expect(result.current).toBe(0)
  })

  it('returns zeroes when nothing clears the bar', () => {
    const reps = new Map([['2026-07-15', 10]])
    expect(streakFromDailyReps(reps, flat(100), '2026-07-15')).toEqual({
      current: 0,
      longest: 0,
    })
  })

  it('returns zeroes for an empty map', () => {
    expect(streakFromDailyReps(new Map(), flat(100), '2026-07-15')).toEqual({
      current: 0,
      longest: 0,
    })
  })
})
