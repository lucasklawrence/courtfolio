import { describe, it, expect } from 'vitest'

import type { StrengthSet } from '@/types/weight-room'

import { buildMovementLoads, pacificDayKey } from './load-management'

/**
 * Minimal {@link StrengthSet} stamped at noon Pacific on `dayKey` (noon so
 * the set lands safely mid-day regardless of PST/PDT). Pass `weight` for a
 * loaded set; omit it for bodyweight.
 */
function set(dayKey: string, exercise: string, reps: number, weight?: number): StrengthSet {
  return {
    id: `${dayKey}-${exercise}-${reps}-${weight ?? 'bw'}`,
    logged_at: `${dayKey}T12:00:00-07:00`,
    exercise,
    reps,
    ...(weight != null ? { weight_lbs: weight } : {}),
  }
}

/** Fixed "today" anchor — noon PDT on Wed 2026-07-15. */
const NOW = new Date('2026-07-15T12:00:00-07:00')

/** Index the result by movement name for terse per-movement assertions. */
function byName(loads: ReturnType<typeof buildMovementLoads>) {
  return Object.fromEntries(loads.map(l => [l.movement, l]))
}

describe('pacificDayKey', () => {
  it('buckets to the Pacific calendar day, not the UTC one', () => {
    // 05:00 UTC = 22:00 PDT the previous day.
    expect(pacificDayKey(new Date('2026-07-12T05:00:00Z'))).toBe('2026-07-11')
    // 07:00 UTC = 00:00 PDT — the day flips.
    expect(pacificDayKey(new Date('2026-07-12T07:00:00Z'))).toBe('2026-07-12')
  })

  it('tracks the DST offset (PST is UTC-8 in winter)', () => {
    // 07:00 UTC in January = 23:00 PST the previous day.
    expect(pacificDayKey(new Date('2026-01-12T07:00:00Z'))).toBe('2026-01-11')
    expect(pacificDayKey(new Date('2026-01-12T08:00:00Z'))).toBe('2026-01-12')
  })
})

describe('buildMovementLoads', () => {
  it('returns nothing for no sets', () => {
    expect(buildMovementLoads([], [], NOW)).toEqual([])
  })

  it('computes acute/prior/chronic volume, WoW %, and ACWR for a bodyweight movement', () => {
    const sets = [
      set('2026-05-01', 'pushups', 50), // history anchor — predates the chronic window
      set('2026-07-05', 'pushups', 100), // prior week
      set('2026-07-10', 'pushups', 60), // acute
      set('2026-07-14', 'pushups', 60), // acute
      set('2026-06-20', 'pushups', 50), // chronic-only (before prior week)
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).pushups

    expect(load.metric).toBe('reps')
    expect(load.unitLabel).toBe('reps')
    expect(load.acute7d).toBe(120)
    expect(load.prior7d).toBe(100)
    expect(load.chronic28d).toBe(270) // in-window only; the May anchor is excluded
    expect(load.chronicWeekly).toBeCloseTo(67.5)
    expect(load.wowPct).toBe(0.2)
    expect(load.acwr).toBe(1.78) // 120 / 67.5 = 1.777…, rounded to display precision
    expect(load.wowFlag).toBe('yellow') // +20% > +10%
    expect(load.acwrFlag).toBe('red') // ~1.78 > 1.5
    expect(load.flag).toBe('red') // worst of the two
  })

  it('drives loaded movements off load-volume (Σ reps × weight)', () => {
    const sets = [
      set('2026-05-15', 'shrugs', 30, 100), // history anchor
      set('2026-06-23', 'shrugs', 30, 100),
      set('2026-06-30', 'shrugs', 30, 100),
      set('2026-07-07', 'shrugs', 30, 100),
      set('2026-07-14', 'shrugs', 30, 100),
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).shrugs

    expect(load.metric).toBe('load')
    expect(load.unitLabel).toBe('lb')
    expect(load.acute7d).toBe(3000) // 30 × 100
    expect(load.chronic28d).toBe(12000) // four in-window weeks
    expect(load.acwr).toBe(1) // 3000 / (12000 / 4)
    expect(load.wowPct).toBe(0)
    expect(load.flag).toBe('green')
  })

  it('keeps a mostly-bodyweight movement rep-based despite an occasional weighted set', () => {
    const sets = [
      set('2026-07-11', 'pullups', 10, 25), // 1 of 4 weighted → still bodyweight
      set('2026-07-12', 'pullups', 10),
      set('2026-07-13', 'pullups', 10),
      set('2026-07-14', 'pullups', 10),
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).pullups

    expect(load.metric).toBe('reps')
    expect(load.acute7d).toBe(40) // rep count, not load-volume
  })

  it('scores a movement on its current regime, not its history', () => {
    // Weighted for months, then switched to bodyweight three weeks ago.
    // The historical weighted sets fall outside the window; only the recent
    // bodyweight ones count, so it must read as a rep-based movement rather
    // than collapse to zero tonnage and drop off the panel.
    const sets = [
      set('2026-04-01', 'curls', 30, 100),
      set('2026-04-15', 'curls', 30, 100),
      set('2026-05-01', 'curls', 30, 100),
      set('2026-07-01', 'curls', 20),
      set('2026-07-08', 'curls', 20),
      set('2026-07-14', 'curls', 20),
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).curls

    expect(load.metric).toBe('reps') // in-window sets are all bodyweight
    expect(load.acute7d).toBe(20) // rep volume, not the historical tonnage
  })

  it('withholds ACWR until the movement has a full chronic window of history', () => {
    // Two weeks of steady training — a real chronic baseline needs four, so
    // dividing by 4 here would raise a false ACWR alarm. Show no ratio.
    const sets = [
      set('2026-07-05', 'newmove', 100), // prior week
      set('2026-07-14', 'newmove', 100), // acute
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).newmove

    expect(load.chronic28d).toBe(200) // still rendered
    expect(load.acwr).toBeNull()
    expect(load.acwrFlag).toBe('green') // no false alarm on thin history
    expect(load.wowPct).toBe(0)
    expect(load.flag).toBe('green')
  })

  it('rounds WoW to whole percent so the shown number and the flag agree', () => {
    const sets = [
      // +10.4% actual → rounds to +10% and stays green (at the ceiling).
      set('2026-07-05', 'edge', 1000),
      set('2026-07-14', 'edge', 1104),
      // +10.6% actual → rounds to +11% and flags yellow.
      set('2026-07-05', 'over', 1000),
      set('2026-07-14', 'over', 1106),
    ]
    const map = byName(buildMovementLoads(sets, [], NOW))

    expect(map.edge.wowPct).toBe(0.1)
    expect(map.edge.wowFlag).toBe('green')
    expect(map.over.wowPct).toBe(0.11)
    expect(map.over.wowFlag).toBe('yellow')
  })

  it('reports WoW as null when there is no prior week to compare', () => {
    const sets = [
      set('2026-05-01', 'squats', 50), // history anchor so ACWR is defined
      set('2026-07-14', 'squats', 100), // acute only, nothing the week before
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).squats

    expect(load.wowPct).toBeNull()
    expect(load.wowFlag).toBe('green') // nothing to flag
    expect(load.acwr).toBe(4) // 100 / (100 / 4)
    expect(load.acwrFlag).toBe('red')
  })

  it('drops movements dormant across the trailing 28 days', () => {
    const loads = buildMovementLoads([set('2026-06-01', 'dips', 50)], [], NOW)
    expect(loads).toEqual([])
  })

  it('sorts worst-flag-first, then alphabetically', () => {
    const sets = [
      // pushups → red (spike over an established base)
      set('2026-05-01', 'pushups', 50),
      set('2026-07-05', 'pushups', 100),
      set('2026-07-14', 'pushups', 200),
      // squats → red (spike over an established base)
      set('2026-05-01', 'squats', 50),
      set('2026-07-14', 'squats', 100),
      // shrugs → green (steady four weeks)
      set('2026-05-15', 'shrugs', 30, 100),
      set('2026-06-23', 'shrugs', 30, 100),
      set('2026-06-30', 'shrugs', 30, 100),
      set('2026-07-07', 'shrugs', 30, 100),
      set('2026-07-14', 'shrugs', 30, 100),
    ]
    const order = buildMovementLoads(sets, [], NOW).map(l => l.movement)
    expect(order).toEqual(['pushups', 'squats', 'shrugs'])
  })

  it('emits a 28-day sparkline whose volume sums to the chronic total', () => {
    const sets = [
      set('2026-07-05', 'pushups', 100),
      set('2026-07-10', 'pushups', 60),
      set('2026-07-14', 'pushups', 60),
      set('2026-06-20', 'pushups', 50),
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).pushups

    expect(load.sparkline).toHaveLength(28)
    expect(load.sparkline[27].dayKey).toBe('2026-07-15') // ends today
    expect(load.sparkline[0].dayKey).toBe('2026-06-18') // 28-day window start
    const sum = load.sparkline.reduce((acc, p) => acc + p.volume, 0)
    expect(sum).toBe(load.chronic28d)
  })

  it('uses the matching goal color, falling back to a default', () => {
    const goals = [{ exercise: 'pushups', daily_target: 100, color: '#123456' }]
    const loads = buildMovementLoads(
      [set('2026-07-14', 'pushups', 100), set('2026-07-14', 'squats', 100)],
      goals,
      NOW,
    )
    const map = byName(loads)
    expect(map.pushups.color).toBe('#123456')
    expect(map.squats.color).toBe('#EA580C') // default
  })

  it('ignores sets with an unparseable timestamp', () => {
    const sets = [
      set('2026-07-14', 'pushups', 60),
      { id: 'bad', logged_at: 'not-a-date', exercise: 'pushups', reps: 999 },
    ]
    const load = byName(buildMovementLoads(sets, [], NOW)).pushups
    expect(load.acute7d).toBe(60) // the garbage row contributes nothing
  })
})
