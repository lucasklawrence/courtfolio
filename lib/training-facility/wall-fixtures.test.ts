import { describe, it, expect } from 'vitest'

import type { CardioData, CardioSession, CardioTimePoint } from '@/types/cardio'

import {
  deriveWeeklyCardioTotals,
  pickLatestRestingHr,
  pickLatestVo2max,
  takeLatestPoints,
} from './wall-fixtures'

/**
 * Pure-function coverage for the wall-fixture derivation helpers. Each
 * function has a happy path (real data) and a null path (missing /
 * empty trend) so the fixture render branches both stay honest as the
 * cardio shape evolves.
 */

const baseData = (overrides: Partial<CardioData> = {}): CardioData => ({
  imported_at: '2026-04-25T12:00:00Z',
  sessions: [],
  resting_hr_trend: [],
  vo2max_trend: [],
  ...overrides,
})

describe('takeLatestPoints', () => {
  it('returns up to N most-recent points in oldest → newest order', () => {
    const series: CardioTimePoint[] = [
      { date: '2026-04-10', value: 60 },
      { date: '2026-04-05', value: 58 },
      { date: '2026-04-20', value: 62 },
      { date: '2026-04-15', value: 61 },
    ]
    const out = takeLatestPoints(series, 3)
    expect(out.map((p) => p.date)).toEqual([
      '2026-04-10',
      '2026-04-15',
      '2026-04-20',
    ])
  })

  it('returns the full series when fewer than `limit` points exist', () => {
    const series: CardioTimePoint[] = [
      { date: '2026-04-10', value: 60 },
      { date: '2026-04-15', value: 61 },
    ]
    expect(takeLatestPoints(series, 9)).toHaveLength(2)
  })

  it('returns an empty array for undefined / empty input', () => {
    expect(takeLatestPoints(undefined, 5)).toEqual([])
    expect(takeLatestPoints([], 5)).toEqual([])
  })

  it('returns an empty array when limit ≤ 0', () => {
    const series: CardioTimePoint[] = [{ date: '2026-04-10', value: 60 }]
    expect(takeLatestPoints(series, 0)).toEqual([])
    expect(takeLatestPoints(series, -1)).toEqual([])
  })
})

describe('pickLatestRestingHr', () => {
  it('picks the latest value rounded to a whole BPM', () => {
    const data = baseData({
      resting_hr_trend: [
        { date: '2026-04-10', value: 58.4 },
        { date: '2026-04-20', value: 60.6 },
      ],
    })
    const snap = pickLatestRestingHr(data, 9)
    expect(snap?.bpm).toBe(61)
    expect(snap?.series).toHaveLength(2)
  })

  it('returns null when data is null (cardio.json missing)', () => {
    expect(pickLatestRestingHr(null, 9)).toBeNull()
  })

  it('returns null when the trend is empty', () => {
    expect(pickLatestRestingHr(baseData(), 9)).toBeNull()
  })
})

describe('pickLatestVo2max', () => {
  it('picks the latest value rounded to one decimal', () => {
    const data = baseData({
      vo2max_trend: [
        { date: '2026-04-10', value: 47.83 },
        { date: '2026-04-20', value: 48.27 },
      ],
    })
    const snap = pickLatestVo2max(data, 7)
    expect(snap?.value).toBe(48.3)
    expect(snap?.series).toHaveLength(2)
  })

  it('returns null when data is null', () => {
    expect(pickLatestVo2max(null, 7)).toBeNull()
  })

  it('returns null when the trend is empty', () => {
    expect(pickLatestVo2max(baseData(), 7)).toBeNull()
  })
})

describe('deriveWeeklyCardioTotals', () => {
  // All tests anchor "now" to 2026-04-30T12:00:00 local — a deterministic
  // reference so the rolling 7-day window covers 2026-04-23T12:00:00 →
  // 2026-04-30T12:00:00 inclusive.
  const NOW = new Date('2026-04-30T12:00:00')

  const session = (
    overrides: Partial<CardioSession> & Pick<CardioSession, 'date'>,
  ): CardioSession => ({
    activity: 'stair',
    duration_seconds: 1800,
    ...overrides,
  })

  it('aggregates sessions, duration, and distance inside the rolling 7-day window', () => {
    const data = baseData({
      sessions: [
        session({ date: '2026-04-25', duration_seconds: 1500, distance_meters: 1609.344 }), // 25 min, 1 mi
        session({ date: '2026-04-27', duration_seconds: 1800 }), // 30 min, no distance (stair)
        session({ date: '2026-04-29', duration_seconds: 2700, distance_meters: 4828.032 }), // 45 min, 3 mi
      ],
    })
    const totals = deriveWeeklyCardioTotals(data, NOW)
    expect(totals).toEqual({
      sessions: 3,
      durationLabel: '1:40', // 25 + 30 + 45 = 100 min = 1h 40m
      milesLabel: '4.0',
    })
  })

  it('excludes sessions outside the rolling window (before window start)', () => {
    const data = baseData({
      sessions: [
        session({ date: '2026-04-15', duration_seconds: 1800, distance_meters: 5000 }), // outside
        session({ date: '2026-04-26', duration_seconds: 1200, distance_meters: 1000 }), // inside
      ],
    })
    const totals = deriveWeeklyCardioTotals(data, NOW)
    expect(totals?.sessions).toBe(1)
    expect(totals?.durationLabel).toBe('0:20')
    expect(totals?.milesLabel).toBe('0.6')
  })

  it('excludes sessions in the future relative to now', () => {
    const data = baseData({
      sessions: [
        session({ date: '2026-05-15', duration_seconds: 1800 }), // future
      ],
    })
    expect(deriveWeeklyCardioTotals(data, NOW)).toBeNull()
  })

  it('returns null when data is null', () => {
    expect(deriveWeeklyCardioTotals(null, NOW)).toBeNull()
  })

  it('returns null when the sessions list is empty', () => {
    expect(deriveWeeklyCardioTotals(baseData(), NOW)).toBeNull()
  })

  it('returns null when no sessions fall inside the window', () => {
    const data = baseData({
      sessions: [session({ date: '2026-01-01', duration_seconds: 1800 })],
    })
    expect(deriveWeeklyCardioTotals(data, NOW)).toBeNull()
  })

  it('drops sessions with unparseable dates rather than throwing', () => {
    const data = baseData({
      sessions: [
        session({ date: 'not-a-date', duration_seconds: 1800 }),
        session({ date: '2026-04-28', duration_seconds: 1200 }),
      ],
    })
    expect(deriveWeeklyCardioTotals(data, NOW)?.sessions).toBe(1)
  })

  it('formats hours / minutes with a zero-padded minute', () => {
    const data = baseData({
      sessions: [
        // 60 + 5 = 65 min total → "1:05" (not "1:5")
        session({ date: '2026-04-28', duration_seconds: 60 * 60 + 5 * 60 }),
      ],
    })
    expect(deriveWeeklyCardioTotals(data, NOW)?.durationLabel).toBe('1:05')
  })
})
