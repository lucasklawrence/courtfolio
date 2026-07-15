import { describe, it, expect } from 'vitest'
import {
  avgHrGranularityForSpanDays,
  bucketAvgHr,
  rangeSpanDays,
  type SessionAvgHrPoint,
} from './cardio-shared'

const pt = (date: string, avgHr: number): SessionAvgHrPoint => ({
  date,
  label: '',
  avgHr,
})

describe('rangeSpanDays', () => {
  it('measures the whole-day span between range bounds', () => {
    const span = rangeSpanDays({
      start: new Date('2026-04-01T00:00:00'),
      end: new Date('2026-04-11T00:00:00'),
    })
    expect(span).toBe(10)
  })
})

describe('avgHrGranularityForSpanDays', () => {
  it('keeps per-session bars for short windows (1M / 3M)', () => {
    expect(avgHrGranularityForSpanDays(0)).toBe('session')
    expect(avgHrGranularityForSpanDays(30)).toBe('session')
    expect(avgHrGranularityForSpanDays(100)).toBe('session')
  })

  it('rolls up to weekly for mid windows (6M / 1Y)', () => {
    expect(avgHrGranularityForSpanDays(101)).toBe('week')
    expect(avgHrGranularityForSpanDays(182)).toBe('week')
    expect(avgHrGranularityForSpanDays(365)).toBe('week')
    expect(avgHrGranularityForSpanDays(400)).toBe('week')
  })

  it('rolls up to monthly for multi-year windows (All)', () => {
    expect(avgHrGranularityForSpanDays(401)).toBe('month')
    expect(avgHrGranularityForSpanDays(1200)).toBe('month')
  })
})

describe('bucketAvgHr', () => {
  it('returns a fresh copy unchanged at session granularity', () => {
    const input = [pt('2026-04-06', 140), pt('2026-04-08', 160)]
    const out = bucketAvgHr(input, 'session')
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
  })

  it('returns [] for empty input regardless of granularity', () => {
    expect(bucketAvgHr([], 'month')).toEqual([])
  })

  it('averages sessions that fall in the same Mon–Sun week', () => {
    // 2026-04-06 is a Monday; 04-08 is the same week; 04-13 is the next Monday.
    const out = bucketAvgHr(
      [pt('2026-04-06', 140), pt('2026-04-08', 160), pt('2026-04-13', 150)],
      'week',
    )
    expect(out).toEqual([
      { date: '2026-04-06', label: '4/6', avgHr: 150 },
      { date: '2026-04-13', label: '4/13', avgHr: 150 },
    ])
  })

  it('anchors a Sunday session to the preceding Monday', () => {
    // 2026-04-12 is a Sunday → same week as Monday 2026-04-06.
    const out = bucketAvgHr([pt('2026-04-12', 130)], 'week')
    expect(out).toEqual([{ date: '2026-04-12', label: '4/6', avgHr: 130 }])
  })

  it("averages sessions in the same month and labels them Mon 'YY", () => {
    const out = bucketAvgHr(
      [pt('2026-04-06', 140), pt('2026-04-20', 160), pt('2026-05-02', 150)],
      'month',
    )
    expect(out).toEqual([
      { date: '2026-04-06', label: "Apr '26", avgHr: 150 },
      { date: '2026-05-02', label: "May '26", avgHr: 150 },
    ])
  })

  it('preserves chronological bucket order and keeps each bucket first date', () => {
    const out = bucketAvgHr(
      [pt('2026-01-05', 120), pt('2026-01-19', 130), pt('2026-03-02', 140)],
      'month',
    )
    expect(out.map((b) => b.date)).toEqual(['2026-01-05', '2026-03-02'])
  })

  it('skips points whose date string cannot be parsed', () => {
    const out = bucketAvgHr([pt('garbage', 999), pt('2026-04-06', 150)], 'month')
    expect(out).toEqual([{ date: '2026-04-06', label: "Apr '26", avgHr: 150 }])
  })
})
