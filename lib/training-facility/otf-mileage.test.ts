import { describe, expect, it } from 'vitest'

import type { OtfMileageAward, OtfSession } from '@/types/otf'

import {
  METERS_PER_MILE,
  buildOtfMileageView,
  monthKeyOf,
  monthLabelOf,
  monthlyOtfMileage,
  resolveAwards,
  sessionMiles,
} from './otf-mileage'

/**
 * Session factory. `started_at` defaults to a midday-UTC timestamp so the
 * local calendar month is stable across every realistic timezone (noon UTC
 * lands on the same date from UTC-11 to UTC+11).
 */
function mk(started_at: string, extra: Partial<OtfSession> = {}): OtfSession {
  return { started_at, ...extra }
}

/** A session that covers `treadMiles` on the tread and `rowerMeters` on the rower. */
function ride(started_at: string, treadMiles: number, rowerMeters: number): OtfSession {
  return mk(started_at, {
    treadmill: { distance_mi: treadMiles, time: '20:00' },
    rower: { distance_m: rowerMeters, time: '10:00' },
  })
}

/** A representative milestone ladder, intentionally passed out of order. */
const AWARDS: OtfMileageAward[] = [
  { id: 'b', label: 'Marathon', miles: 26.2 },
  { id: 'a', label: 'Half Marathon', miles: 13.1 },
  { id: 'c', label: '50K Ultra', miles: 31.1 },
]

describe('sessionMiles', () => {
  it('is 0 for a session with neither machine', () => {
    expect(sessionMiles(mk('2026-07-15T12:00:00Z'))).toBe(0)
  })

  it('uses treadmill miles directly', () => {
    const session = mk('2026-07-15T12:00:00Z', {
      treadmill: { distance_mi: 2.5, time: '25:00' },
    })
    expect(sessionMiles(session)).toBeCloseTo(2.5, 10)
  })

  it('converts rower meters to miles', () => {
    const session = mk('2026-07-15T12:00:00Z', {
      rower: { distance_m: 2 * METERS_PER_MILE, time: '12:00' },
    })
    expect(sessionMiles(session)).toBeCloseTo(2, 10)
  })

  it('sums treadmill miles and converted rower miles', () => {
    expect(sessionMiles(ride('2026-07-15T12:00:00Z', 1.5, METERS_PER_MILE))).toBeCloseTo(2.5, 10)
  })
})

describe('monthKeyOf / monthLabelOf', () => {
  it('zero-pads the month in the key', () => {
    expect(monthKeyOf(new Date(2026, 0, 5))).toBe('2026-01')
    expect(monthKeyOf(new Date(2026, 11, 31))).toBe('2026-12')
  })

  it('renders a human month label', () => {
    expect(monthLabelOf(2026, 6)).toBe('July 2026')
    expect(monthLabelOf(2026, 0)).toBe('January 2026')
  })
})

describe('monthlyOtfMileage', () => {
  it('returns an empty array for no sessions', () => {
    expect(monthlyOtfMileage([])).toEqual([])
  })

  it('buckets by calendar month, newest first, summing tread + row', () => {
    const sessions = [
      ride('2026-06-10T12:00:00Z', 1, METERS_PER_MILE), // June: 2 mi
      ride('2026-07-05T12:00:00Z', 3, 0), // July: 3 mi
      ride('2026-07-20T12:00:00Z', 0, 2 * METERS_PER_MILE), // July: 2 mi
    ]
    const months = monthlyOtfMileage(sessions)

    expect(months.map(m => m.monthKey)).toEqual(['2026-07', '2026-06'])
    expect(months[0].label).toBe('July 2026')
    expect(months[0].miles).toBeCloseTo(5, 10)
    expect(months[0].classes).toBe(2)
    expect(months[1].miles).toBeCloseTo(2, 10)
    expect(months[1].classes).toBe(1)
  })

  it('drops excluded sessions from the totals and counts', () => {
    const sessions = [
      ride('2026-07-05T12:00:00Z', 3, 0),
      { ...ride('2026-07-06T12:00:00Z', 99, 0), excluded: true },
    ]
    const [july] = monthlyOtfMileage(sessions)
    expect(july.miles).toBeCloseTo(3, 10)
    expect(july.classes).toBe(1)
  })
})

describe('resolveAwards', () => {
  it('earns nothing and points at the first tier when the ladder is untouched', () => {
    const progress = resolveAwards(5, AWARDS)
    expect(progress.earned).toEqual([])
    expect(progress.next?.label).toBe('Half Marathon')
    expect(progress.remainingToNext).toBeCloseTo(13.1 - 5, 10)
  })

  it('earns a tier at exactly its threshold', () => {
    const progress = resolveAwards(13.1, AWARDS)
    expect(progress.earned.map(a => a.label)).toEqual(['Half Marathon'])
    expect(progress.next?.label).toBe('Marathon')
  })

  it('earns every tier at or below the total, sorted low to high', () => {
    const progress = resolveAwards(28, AWARDS)
    expect(progress.earned.map(a => a.label)).toEqual(['Half Marathon', 'Marathon'])
    expect(progress.next?.label).toBe('50K Ultra')
    expect(progress.remainingToNext).toBeCloseTo(31.1 - 28, 10)
  })

  it('has no next tier once every milestone is earned', () => {
    const progress = resolveAwards(40, AWARDS)
    expect(progress.earned).toHaveLength(3)
    expect(progress.next).toBeNull()
    expect(progress.remainingToNext).toBeNull()
  })

  it('handles an empty ladder', () => {
    const progress = resolveAwards(20, [])
    expect(progress.earned).toEqual([])
    expect(progress.next).toBeNull()
    expect(progress.remainingToNext).toBeNull()
  })
})

describe('buildOtfMileageView', () => {
  const now = new Date(2026, 6, 13) // July 13, 2026 (local)

  it('synthesizes a zero current month when nothing is logged yet', () => {
    const view = buildOtfMileageView([ride('2026-05-10T12:00:00Z', 4, 0)], AWARDS, now)
    expect(view.current.monthKey).toBe('2026-07')
    expect(view.current.label).toBe('July 2026')
    expect(view.current.miles).toBe(0)
    expect(view.current.classes).toBe(0)
    expect(view.current.earned).toEqual([])
    expect(view.current.next?.label).toBe('Half Marathon')
    expect(view.history.map(m => m.monthKey)).toEqual(['2026-05'])
  })

  it('reports the real current-month total and keeps it out of history', () => {
    const view = buildOtfMileageView(
      [
        ride('2026-07-02T12:00:00Z', 10, 0),
        ride('2026-07-09T12:00:00Z', 5, 0),
        ride('2026-06-15T12:00:00Z', 3, 0),
      ],
      AWARDS,
      now,
    )
    expect(view.current.monthKey).toBe('2026-07')
    expect(view.current.miles).toBeCloseTo(15, 10)
    expect(view.current.classes).toBe(2)
    expect(view.current.earned.map(a => a.label)).toEqual(['Half Marathon'])
    expect(view.current.next?.label).toBe('Marathon')
    expect(view.history.map(m => m.monthKey)).toEqual(['2026-06'])
    expect(view.history[0].miles).toBeCloseTo(3, 10)
  })

  it('orders history newest first and resolves awards per month', () => {
    const view = buildOtfMileageView(
      [
        ride('2026-04-10T12:00:00Z', 30, 0),
        ride('2026-05-10T12:00:00Z', 13.1, 0),
        ride('2026-06-10T12:00:00Z', 1, 0),
      ],
      AWARDS,
      now,
    )
    expect(view.history.map(m => m.monthKey)).toEqual(['2026-06', '2026-05', '2026-04'])
    expect(view.history[1].earned.map(a => a.label)).toEqual(['Half Marathon'])
    expect(view.history[2].earned.map(a => a.label)).toEqual(['Half Marathon', 'Marathon'])
  })
})
