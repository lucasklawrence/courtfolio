import { describe, it, expect } from 'vitest'
import {
  cardiacEfficiencyPoints,
  filterRunningSessions,
  formatDistanceMiles,
  formatPaceCellFromSecPerKm,
  formatPacePerMile,
  paceAtHrPoints,
  paceTrendPoints,
  secPerKmToSecPerMile,
} from './running'
import type { CardioSession } from '@/types/cardio'

const range = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
})

const run = (date: string, extras: Partial<CardioSession> = {}): CardioSession => ({
  date,
  activity: 'running',
  duration_seconds: 1800,
  ...extras,
})

describe('filterRunningSessions', () => {
  it('keeps only running-activity sessions inside the range, sorted oldest → newest', () => {
    const sessions: CardioSession[] = [
      run('2026-04-10'),
      run('2026-04-01'),
      { date: '2026-04-05', activity: 'stair', duration_seconds: 1500 },
      { date: '2026-04-12', activity: 'walking', duration_seconds: 2400 },
      run('2026-03-15'),
      run('2026-04-20'),
    ]
    const out = filterRunningSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-10'])
  })
})

describe('paceTrendPoints', () => {
  it('converts pace from sec/km to sec/mi and preserves order', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01', { pace_seconds_per_km: 360 }),
      run('2026-04-08', { pace_seconds_per_km: 330 }),
    ]
    const out = paceTrendPoints(sessions)
    expect(out).toHaveLength(2)
    // 360 sec/km × 1.609344 ≈ 579.36 sec/mi
    expect(out[0].paceSecondsPerMile).toBeCloseTo(579.36, 1)
    expect(out[0].rawDate).toBe('2026-04-01')
    // 330 sec/km × 1.609344 ≈ 531.08 sec/mi
    expect(out[1].paceSecondsPerMile).toBeCloseTo(531.08, 1)
  })

  it('drops sessions without a usable pace', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01'), // no pace
      run('2026-04-02', { pace_seconds_per_km: 0 }), // sentinel
      run('2026-04-03', { pace_seconds_per_km: -1 }), // negative
      run('2026-04-04', { pace_seconds_per_km: Number.NaN }),
      run('2026-04-05', { pace_seconds_per_km: 360 }),
    ]
    const out = paceTrendPoints(sessions)
    expect(out.map((p) => p.rawDate)).toEqual(['2026-04-05'])
  })

  it('drops sessions whose date is unparseable', () => {
    const sessions: CardioSession[] = [
      run('garbage', { pace_seconds_per_km: 360 }),
      run('2026-04-05', { pace_seconds_per_km: 360 }),
    ]
    const out = paceTrendPoints(sessions)
    expect(out.map((p) => p.rawDate)).toEqual(['2026-04-05'])
  })
})

describe('cardiacEfficiencyPoints', () => {
  it('keeps sessions with positive m/heartbeat, in input order', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01', { meters_per_heartbeat: 1.42 }),
      run('2026-04-08', { meters_per_heartbeat: 1.51 }),
    ]
    const out = cardiacEfficiencyPoints(sessions)
    expect(out.map((p) => p.metersPerHeartbeat)).toEqual([1.42, 1.51])
  })

  it('drops sessions missing the field or non-positive', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01'),
      run('2026-04-02', { meters_per_heartbeat: 0 }),
      run('2026-04-03', { meters_per_heartbeat: -0.5 }),
      run('2026-04-04', { meters_per_heartbeat: 1.6 }),
    ]
    const out = cardiacEfficiencyPoints(sessions)
    expect(out.map((p) => p.rawDate)).toEqual(['2026-04-04'])
  })

  it('drops sessions whose date is unparseable', () => {
    const sessions: CardioSession[] = [
      run('garbage', { meters_per_heartbeat: 1.4 }),
      run('2026-04-05', { meters_per_heartbeat: 1.5 }),
    ]
    const out = cardiacEfficiencyPoints(sessions)
    expect(out.map((p) => p.rawDate)).toEqual(['2026-04-05'])
  })
})

describe('secPerKmToSecPerMile', () => {
  it('multiplies by miles-per-meter then re-scales km → m', () => {
    // 360 sec/km × 1.609344 ≈ 579.36 sec/mi
    expect(secPerKmToSecPerMile(360)).toBeCloseTo(579.36, 1)
    // 0 stays 0 — caller filters but the math is still well-defined.
    expect(secPerKmToSecPerMile(0)).toBe(0)
  })
})

describe('formatPaceCellFromSecPerKm', () => {
  it('converts and formats with /mi suffix', () => {
    // 360 sec/km ≈ 579 sec/mi → 9:39 /mi
    expect(formatPaceCellFromSecPerKm(360)).toBe('9:39 /mi')
  })

  it('returns em dash when input is missing or non-positive', () => {
    expect(formatPaceCellFromSecPerKm(undefined)).toBe('—')
    expect(formatPaceCellFromSecPerKm(0)).toBe('—')
    expect(formatPaceCellFromSecPerKm(-30)).toBe('—')
    expect(formatPaceCellFromSecPerKm(Number.NaN)).toBe('—')
  })
})

describe('paceAtHrPoints', () => {
  it('keeps sessions with both avg_hr and pace, converting to sec/mi', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01', { avg_hr: 152, pace_seconds_per_km: 360 }),
      run('2026-04-08', { avg_hr: 148, pace_seconds_per_km: 348 }),
    ]
    const out = paceAtHrPoints(sessions)
    expect(out).toHaveLength(2)
    expect(out[0].avgHr).toBe(152)
    expect(out[0].paceSecondsPerMile).toBeCloseTo(579.36, 1)
  })

  it('drops sessions missing either coordinate', () => {
    const sessions: CardioSession[] = [
      run('2026-04-01', { avg_hr: 152 }), // no pace
      run('2026-04-02', { pace_seconds_per_km: 360 }), // no HR
      run('2026-04-03', { avg_hr: 0, pace_seconds_per_km: 360 }),
      run('2026-04-04', { avg_hr: 152, pace_seconds_per_km: 0 }),
      run('2026-04-05', { avg_hr: 150, pace_seconds_per_km: 350 }),
    ]
    const out = paceAtHrPoints(sessions)
    expect(out.map((p) => p.rawDate)).toEqual(['2026-04-05'])
  })
})

describe('formatPacePerMile', () => {
  it('formats whole minutes', () => {
    expect(formatPacePerMile(540)).toBe('9:00 /mi')
  })

  it('zero-pads seconds', () => {
    expect(formatPacePerMile(545)).toBe('9:05 /mi')
  })

  it('handles sub-minute paces', () => {
    expect(formatPacePerMile(45)).toBe('0:45 /mi')
  })

  it('omits the unit when includeUnit is false (chart tick form)', () => {
    expect(formatPacePerMile(545, false)).toBe('9:05')
  })

  it('returns an em dash for invalid input', () => {
    expect(formatPacePerMile(Number.NaN)).toBe('—')
    expect(formatPacePerMile(0)).toBe('—')
    expect(formatPacePerMile(-30)).toBe('—')
  })
})

describe('formatDistanceMiles', () => {
  it('converts meters to miles with one decimal', () => {
    // 5000 m / 1609.344 ≈ 3.1 mi
    expect(formatDistanceMiles(5000)).toBe('3.1 mi')
    // 1609.344 m → 1.0 mi exactly
    expect(formatDistanceMiles(1609.344)).toBe('1.0 mi')
  })

  it('returns em dash when distance is missing or zero', () => {
    expect(formatDistanceMiles(undefined)).toBe('—')
    expect(formatDistanceMiles(0)).toBe('—')
    expect(formatDistanceMiles(-100)).toBe('—')
    expect(formatDistanceMiles(Number.NaN)).toBe('—')
  })
})
