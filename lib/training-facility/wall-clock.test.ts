import { afterEach, describe, expect, it } from 'vitest'

import type { CardioSession, HrSample } from '@/types/cardio'
import { sessionHrCurve } from './cardio-shared'
import { fromWallClockMs, wallClockMs } from './clock'
import { parseSessionDate, pacificWallClock } from './day-keys'
import { dailyTrimpSeries } from './training-load'

/** Behaviour that must hold in any runtime zone, checked by switching zones. */

const ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Pago_Pago'] as const
const DAY_MS = 86_400_000
const ORIGINAL_TZ = process.env.TZ

function session(date: string): CardioSession {
  return { date, activity: 'running', duration_seconds: 1800, avg_hr: 150 } as CardioSession
}

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe.each(ZONES)('in %s', zone => {
  it('measures whole days across a clock change', () => {
    process.env.TZ = zone
    const before = new Date(2026, 9, 31)
    const after = new Date(2026, 10, 2)
    expect(wallClockMs(after) - wallClockMs(before)).toBe(2 * DAY_MS)
  })

  it('round-trips a wall clock', () => {
    process.env.TZ = zone
    const date = new Date(2026, 5, 15, 18, 30, 5)
    expect(fromWallClockMs(wallClockMs(date)).getTime()).toBe(date.getTime())
  })

  it('reads an evening session on its Pacific day and time', () => {
    process.env.TZ = zone
    const date = parseSessionDate('2022-05-28T03:14:05Z')
    expect([date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([5, 27, 20])
  })

  it('measures an HR curve from real instants, not the wall clock', () => {
    process.env.TZ = zone
    const samples: HrSample[] = [
      { ts: '2022-05-28T03:14:05Z', bpm: 120 },
      { ts: '2022-05-28T03:14:10Z', bpm: 125 },
    ]
    expect(sessionHrCurve('2022-05-28T03:14:05Z', samples)).toEqual([
      { tSeconds: 0, bpm: 120 },
      { tSeconds: 5, bpm: 125 },
    ])
  })

  it('buckets training load on the Pacific day', () => {
    process.env.TZ = zone
    const series = dailyTrimpSeries([session('2022-05-28T03:14:05Z')], { maxHr: 185 })
    expect(series.map(p => p.isoDate)).toEqual(['2022-05-27'])
  })

  it('walks every calendar day across a clock change', () => {
    process.env.TZ = zone
    const series = dailyTrimpSeries(
      [session('2026-03-07T23:30:00'), session('2026-03-09T07:00:00')],
      { maxHr: 185 }
    )
    expect(series.map(p => p.isoDate)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09'])
    expect(series.map(p => p.trimp > 0)).toEqual([true, false, true])
  })
})

describe('sessionHrCurve', () => {
  it('returns nothing for an unparseable session date', () => {
    expect(sessionHrCurve('not-a-date', [{ ts: '2022-05-28T03:14:05Z', bpm: 120 }])).toEqual([])
  })

  it('reads an unparseable sample as the session start', () => {
    expect(sessionHrCurve('2022-05-28T03:14:05Z', [{ ts: 'nope', bpm: 120 }])).toEqual([
      { tSeconds: 0, bpm: 120 },
    ])
  })
})

describe('pacificWallClock', () => {
  it('keeps an invalid date invalid', () => {
    expect(Number.isNaN(pacificWallClock(new Date(NaN)).getTime())).toBe(true)
  })
})
