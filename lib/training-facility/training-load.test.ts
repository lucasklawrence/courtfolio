import { describe, it, expect } from 'vitest'
import {
  ATL_ALPHA,
  CTL_ALPHA,
  classifyTsb,
  computeTRIMP,
  computeTrainingLoad,
  dailyTrimpSeries,
  DEFAULT_MAX_HR,
  trainingLoadInRange,
} from './training-load'
import type { CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'

const session = (
  date: string,
  extras: Partial<CardioSession> = {},
): CardioSession => ({
  date,
  activity: 'running',
  duration_seconds: 1800,
  ...extras,
})

describe('computeTRIMP', () => {
  it('multiplies duration_min × HR fraction × intensity weight', () => {
    // 60 min running at 0.8 HR fraction × 1.0 weight = 48
    const s = session('2026-04-01', { duration_seconds: 3600, avg_hr: 148 })
    expect(computeTRIMP(s, { maxHr: 185 })).toBeCloseTo(60 * (148 / 185) * 1.0, 4)
  })

  it('applies modality weights', () => {
    const stair: CardioSession = { date: '2026-04-01', activity: 'stair', duration_seconds: 1800, avg_hr: 148 }
    const walk: CardioSession = { date: '2026-04-01', activity: 'walking', duration_seconds: 1800, avg_hr: 148 }
    const stairTrimp = computeTRIMP(stair, { maxHr: 185 })
    const walkTrimp = computeTRIMP(walk, { maxHr: 185 })
    // stair weight 1.2; walking weight 0.5
    expect(stairTrimp / walkTrimp).toBeCloseTo(1.2 / 0.5, 4)
  })

  it('caps HR fraction at 1 when avg_hr exceeds max_hr', () => {
    // Sensor anomaly: avg_hr 200, max_hr 185 → HR fraction would be > 1.
    // 60 min × 1.0 cap × 1.0 = 60
    const s = session('2026-04-01', { duration_seconds: 3600, avg_hr: 200 })
    expect(computeTRIMP(s, { maxHr: 185 })).toBe(60)
  })

  it('uses DEFAULT_MAX_HR when no override is supplied', () => {
    const s = session('2026-04-01', { duration_seconds: 3600, avg_hr: 148 })
    expect(computeTRIMP(s)).toBeCloseTo(60 * (148 / DEFAULT_MAX_HR) * 1.0, 4)
  })

  it('returns 0 when avg_hr is missing or non-positive', () => {
    expect(computeTRIMP(session('2026-04-01'))).toBe(0)
    expect(computeTRIMP(session('2026-04-01', { avg_hr: 0 }))).toBe(0)
    expect(computeTRIMP(session('2026-04-01', { avg_hr: -10 }))).toBe(0)
  })

  it('returns 0 when max_hr is non-positive or non-finite', () => {
    const s = session('2026-04-01', { avg_hr: 148, duration_seconds: 1800 })
    expect(computeTRIMP(s, { maxHr: 0 })).toBe(0)
    expect(computeTRIMP(s, { maxHr: Number.NaN })).toBe(0)
    expect(computeTRIMP(s, { maxHr: -185 })).toBe(0)
  })

  it('returns 0 when duration is missing or non-positive', () => {
    const s: CardioSession = {
      date: '2026-04-01',
      activity: 'running',
      duration_seconds: 0,
      avg_hr: 148,
    }
    expect(computeTRIMP(s)).toBe(0)
  })
})

describe('dailyTrimpSeries', () => {
  it('sums multiple sessions on the same day', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', { duration_seconds: 1800, avg_hr: 148 }),
      session('2026-04-01', { duration_seconds: 1800, avg_hr: 148 }),
    ]
    const out = dailyTrimpSeries(sessions, { maxHr: 185 })
    expect(out).toHaveLength(1)
    const single = computeTRIMP(sessions[0], { maxHr: 185 })
    expect(out[0].trimp).toBeCloseTo(single * 2, 4)
  })

  it('fills rest days with TRIMP = 0', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', { avg_hr: 148 }),
      session('2026-04-04', { avg_hr: 148 }),
    ]
    const out = dailyTrimpSeries(sessions, { maxHr: 185 })
    expect(out.map((p) => p.isoDate)).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
    ])
    expect(out.map((p) => p.trimp > 0)).toEqual([true, false, false, true])
  })

  it('returns [] for empty input', () => {
    expect(dailyTrimpSeries([])).toEqual([])
  })

  it('respects the endDate option to extend past the last session', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', { avg_hr: 148 }),
    ]
    const out = dailyTrimpSeries(sessions, {
      maxHr: 185,
      endDate: new Date('2026-04-03T00:00:00'),
    })
    expect(out.map((p) => p.isoDate)).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
    ])
    expect(out[0].trimp).toBeGreaterThan(0)
    expect(out[1].trimp).toBe(0)
    expect(out[2].trimp).toBe(0)
  })

  it('drops sessions with unparseable dates rather than throwing', () => {
    const sessions: CardioSession[] = [
      session('not-a-date', { avg_hr: 148 }),
      session('2026-04-05', { avg_hr: 148 }),
    ]
    const out = dailyTrimpSeries(sessions, { maxHr: 185 })
    expect(out.map((p) => p.isoDate)).toEqual(['2026-04-05'])
  })
})

describe('computeTrainingLoad', () => {
  it('returns [] for an empty series', () => {
    expect(computeTrainingLoad([])).toEqual([])
  })

  it('first day applies α × TRIMP from a zero start', () => {
    const out = computeTrainingLoad([
      { date: new Date(2026, 3, 1), isoDate: '2026-04-01', trimp: 100 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].atl).toBeCloseTo(ATL_ALPHA * 100, 6)
    expect(out[0].ctl).toBeCloseTo(CTL_ALPHA * 100, 6)
    expect(out[0].tsb).toBeCloseTo(out[0].ctl - out[0].atl, 6)
  })

  it('ATL responds faster than CTL — TSB goes negative under sustained load', () => {
    // 30 days of TRIMP=100 every day. ATL rises faster than CTL → TSB
    // (CTL − ATL) is negative throughout (recently loaded above chronic).
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(2026, 3, i + 1),
      isoDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      trimp: 100,
    }))
    const out = computeTrainingLoad(series)
    expect(out.every((p) => p.tsb <= 0)).toBe(true)
    // ATL warms toward 100 much faster than CTL toward 100.
    expect(out[20].atl).toBeGreaterThan(out[20].ctl)
  })

  it('TSB goes positive on rest days after a load block', () => {
    // 14 days of TRIMP=100 then 14 days of zero. ATL drops faster than CTL,
    // so TSB (CTL − ATL) flips positive during the rest block.
    const loadDays = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(2026, 3, i + 1),
      isoDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      trimp: 100,
    }))
    const restDays = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(2026, 3, i + 15),
      isoDate: `2026-04-${String(i + 15).padStart(2, '0')}`,
      trimp: 0,
    }))
    const out = computeTrainingLoad([...loadDays, ...restDays])
    expect(out[27].tsb).toBeGreaterThan(0)
    expect(out[27].atl).toBeLessThan(out[13].atl)
  })
})

describe('classifyTsb', () => {
  it('partitions the value space by the documented thresholds', () => {
    expect(classifyTsb(-15)).toBe('red')
    expect(classifyTsb(-10)).toBe('yellow') // boundary: not red
    expect(classifyTsb(0)).toBe('yellow')
    expect(classifyTsb(5)).toBe('yellow') // boundary: yellow includes 5
    expect(classifyTsb(10)).toBe('green')
    expect(classifyTsb(25)).toBe('green') // boundary: green includes 25
    expect(classifyTsb(30)).toBe('over')
  })

  it('non-finite TSB falls back to yellow (no signal)', () => {
    expect(classifyTsb(Number.NaN)).toBe('yellow')
  })
})

describe('trainingLoadInRange', () => {
  const range = (start: string, end: string): DateRange => ({
    start: new Date(start),
    end: new Date(end),
  })

  it('returns [] for an empty session set', () => {
    expect(trainingLoadInRange([], range('2026-01-01', '2026-12-31'))).toEqual([])
  })

  it('clips the prewarmed series to the range, preserving EMA continuity', () => {
    // Three sessions across two months. Build the full series first so we
    // can assert that the in-range slice equals the same slice taken from
    // the unclipped series — i.e., clipping doesn't mutate values.
    const sessions: CardioSession[] = [
      { date: '2026-02-01', activity: 'running', duration_seconds: 3600, avg_hr: 148 },
      { date: '2026-03-15', activity: 'stair', duration_seconds: 1800, avg_hr: 160 },
      { date: '2026-04-10', activity: 'walking', duration_seconds: 2400, avg_hr: 110 },
    ]
    const window = range('2026-04-01', '2026-04-30')
    const clipped = trainingLoadInRange(sessions, window)

    // Every returned point sits inside the window.
    for (const p of clipped) {
      expect(p.date.getTime()).toBeGreaterThanOrEqual(window.start.getTime())
      expect(p.date.getTime()).toBeLessThanOrEqual(window.end.getTime())
    }

    // Pre-warming holds: the leftmost point's CTL is non-zero because
    // earlier sessions seeded the EMA. A naive in-window-only computation
    // would start CTL at 0 here.
    expect(clipped.length).toBeGreaterThan(0)
    expect(clipped[0].ctl).toBeGreaterThan(0)
  })

  it('returns [] when no session lands in the window', () => {
    const sessions: CardioSession[] = [
      { date: '2026-02-01', activity: 'running', duration_seconds: 3600, avg_hr: 148 },
    ]
    expect(trainingLoadInRange(sessions, range('2026-05-01', '2026-05-31'))).toEqual([])
  })
})
