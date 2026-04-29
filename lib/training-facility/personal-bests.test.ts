import { describe, it, expect } from 'vitest'
import {
  bestSession,
  computePersonalBests,
  pbInRange,
} from './personal-bests'
import type { CardioData, CardioSession } from '@/types/cardio'

const session = (
  date: string,
  activity: CardioSession['activity'],
  extras: Partial<CardioSession> = {},
): CardioSession => ({
  date,
  activity,
  duration_seconds: 1800,
  ...extras,
})

const range = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
})

const baseData = (): CardioData => ({
  imported_at: '2026-04-15T00:00:00Z',
  sessions: [],
  resting_hr_trend: [],
  vo2max_trend: [],
})

describe('computePersonalBests — pace per activity', () => {
  it('keeps the lowest pace per activity (lower = faster)', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [
        session('2026-01-15', 'running', { pace_seconds_per_km: 360 }),
        session('2026-02-15', 'running', { pace_seconds_per_km: 330 }), // running PB
        session('2026-03-15', 'walking', { pace_seconds_per_km: 540 }),
        session('2026-04-15', 'walking', { pace_seconds_per_km: 510 }), // walking PB
      ],
    }
    const pbs = computePersonalBests(data)
    expect(pbs.pace.running).toEqual({ value: 330, date: '2026-02-15' })
    expect(pbs.pace.walking).toEqual({ value: 510, date: '2026-04-15' })
    expect(pbs.pace.stair).toBeUndefined()
  })

  it('ignores sessions without a usable pace', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [
        session('2026-01-15', 'running'), // no pace
        session('2026-02-15', 'running', { pace_seconds_per_km: 0 }), // sentinel
        session('2026-03-15', 'running', { pace_seconds_per_km: -1 }), // negative
        session('2026-04-15', 'running', { pace_seconds_per_km: Number.NaN }),
        session('2026-05-15', 'running', { pace_seconds_per_km: 360 }),
      ],
    }
    expect(computePersonalBests(data).pace.running).toEqual({
      value: 360,
      date: '2026-05-15',
    })
  })

  it('returns an empty pace map when no session has a pace', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [session('2026-01-15', 'stair')],
    }
    expect(computePersonalBests(data).pace).toEqual({})
  })
})

describe('computePersonalBests — duration per activity', () => {
  it('keeps the longest session per activity (higher = better)', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [
        session('2026-01-15', 'stair', { duration_seconds: 1800 }),
        session('2026-02-15', 'stair', { duration_seconds: 2700 }), // stair PB
        session('2026-03-15', 'running', { duration_seconds: 3000 }), // running PB
        session('2026-04-15', 'running', { duration_seconds: 2400 }),
      ],
    }
    const pbs = computePersonalBests(data)
    expect(pbs.duration.stair).toEqual({ value: 2700, date: '2026-02-15' })
    expect(pbs.duration.running).toEqual({ value: 3000, date: '2026-03-15' })
  })

  it('ignores zero or negative durations', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [
        session('2026-01-15', 'walking', { duration_seconds: 0 }),
        session('2026-02-15', 'walking', { duration_seconds: 1800 }),
      ],
    }
    expect(computePersonalBests(data).duration.walking).toEqual({
      value: 1800,
      date: '2026-02-15',
    })
  })
})

describe('computePersonalBests — distance per activity', () => {
  it('keeps the longest distance per activity', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [
        session('2026-01-15', 'running', { distance_meters: 5000 }),
        session('2026-02-15', 'running', { distance_meters: 8000 }),
        session('2026-03-15', 'walking', { distance_meters: 4500 }),
      ],
    }
    const pbs = computePersonalBests(data)
    expect(pbs.distance.running).toEqual({ value: 8000, date: '2026-02-15' })
    expect(pbs.distance.walking).toEqual({ value: 4500, date: '2026-03-15' })
  })

  it('omits activities with no distance data', () => {
    const data: CardioData = {
      ...baseData(),
      sessions: [session('2026-01-15', 'stair')], // no distance_meters
    }
    expect(computePersonalBests(data).distance.stair).toBeUndefined()
  })
})

describe('computePersonalBests — resting HR + VO2max trends', () => {
  it('keeps the lowest resting HR (lower = better)', () => {
    const data: CardioData = {
      ...baseData(),
      resting_hr_trend: [
        { date: '2026-01-15', value: 64 },
        { date: '2026-02-15', value: 60 }, // PB
        { date: '2026-03-15', value: 62 },
      ],
    }
    expect(computePersonalBests(data).restingHr).toEqual({
      value: 60,
      date: '2026-02-15',
    })
  })

  it('keeps the highest VO2max (higher = better)', () => {
    const data: CardioData = {
      ...baseData(),
      vo2max_trend: [
        { date: '2026-01-15', value: 41.2 },
        { date: '2026-02-15', value: 42.5 },
        { date: '2026-03-15', value: 44.1 }, // PB
        { date: '2026-04-15', value: 43.8 },
      ],
    }
    expect(computePersonalBests(data).vo2max).toEqual({
      value: 44.1,
      date: '2026-03-15',
    })
  })

  it('returns undefined for an empty trend series', () => {
    const pbs = computePersonalBests(baseData())
    expect(pbs.restingHr).toBeUndefined()
    expect(pbs.vo2max).toBeUndefined()
  })

  it('skips non-finite or non-positive trend points', () => {
    const data: CardioData = {
      ...baseData(),
      resting_hr_trend: [
        { date: '2026-01-15', value: 0 },
        { date: '2026-02-15', value: -5 },
        { date: '2026-03-15', value: Number.NaN },
        { date: '2026-04-15', value: 60 },
      ],
    }
    expect(computePersonalBests(data).restingHr).toEqual({
      value: 60,
      date: '2026-04-15',
    })
  })
})

describe('bestSession', () => {
  const sessions = [
    session('2026-01-15', 'running', { pace_seconds_per_km: 360 }),
    session('2026-02-15', 'running', { pace_seconds_per_km: 330 }),
    session('2026-03-15', 'running', { pace_seconds_per_km: 345 }),
  ]

  it('returns the lowest-pace session in min mode', () => {
    expect(bestSession(sessions, 'pace_seconds_per_km', 'min')).toEqual({
      value: 330,
      date: '2026-02-15',
    })
  })

  it('returns the highest-distance session in max mode', () => {
    const dist: CardioSession[] = [
      session('2026-01-15', 'running', { distance_meters: 5000 }),
      session('2026-02-15', 'running', { distance_meters: 8000 }),
    ]
    expect(bestSession(dist, 'distance_meters', 'max')).toEqual({
      value: 8000,
      date: '2026-02-15',
    })
  })

  it('returns undefined for an empty list', () => {
    expect(bestSession([], 'pace_seconds_per_km', 'min')).toBeUndefined()
  })

  it('returns undefined when no session has a usable value', () => {
    const empty: CardioSession[] = [
      session('2026-01-15', 'stair'), // no pace
    ]
    expect(bestSession(empty, 'pace_seconds_per_km', 'min')).toBeUndefined()
  })
})

describe('pbInRange', () => {
  it('returns true when the PB date falls within the range (inclusive)', () => {
    expect(
      pbInRange(
        { value: 330, date: '2026-02-15' },
        range('2026-02-01T00:00:00', '2026-02-28T23:59:59.999'),
      ),
    ).toBe(true)
  })

  it('returns false when the PB falls outside the range', () => {
    expect(
      pbInRange(
        { value: 330, date: '2026-01-10' },
        range('2026-02-01T00:00:00', '2026-02-28T23:59:59.999'),
      ),
    ).toBe(false)
  })

  it('returns false for an undefined PB', () => {
    expect(
      pbInRange(undefined, range('2026-02-01T00:00:00', '2026-02-28T23:59:59.999')),
    ).toBe(false)
  })

  it('returns false for an unparseable PB date', () => {
    expect(
      pbInRange(
        { value: 330, date: 'not-a-date' },
        range('2026-02-01T00:00:00', '2026-02-28T23:59:59.999'),
      ),
    ).toBe(false)
  })

  it('parses YYYY-MM-DD as local midnight so range bounds align with DateFilter', () => {
    // PB date is the same calendar day as range.start — should be inside.
    expect(
      pbInRange(
        { value: 60, date: '2026-02-01' },
        range('2026-02-01T00:00:00', '2026-02-28T23:59:59.999'),
      ),
    ).toBe(true)
  })
})
