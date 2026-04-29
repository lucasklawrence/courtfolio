import { describe, it, expect } from 'vitest'
import {
  aggregateHrZoneSeconds,
  filterStairSessions,
  formatDuration,
  perSessionAvgHr,
} from './stair'
import type { CardioSession } from '@/types/cardio'

const range = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
})

const stair = (
  date: string,
  extras: Partial<CardioSession> = {},
): CardioSession => ({
  date,
  activity: 'stair',
  duration_seconds: 1800,
  ...extras,
})

describe('filterStairSessions', () => {
  it('keeps only stair-activity sessions inside the range, sorted oldest → newest', () => {
    const sessions: CardioSession[] = [
      stair('2026-04-10'),
      stair('2026-04-01'),
      { date: '2026-04-05', activity: 'running', duration_seconds: 1500 },
      stair('2026-03-15'),
      stair('2026-04-20'),
    ]
    const out = filterStairSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-10'])
  })

  it('is inclusive on both ends', () => {
    const sessions: CardioSession[] = [
      stair('2026-04-01'),
      stair('2026-04-15'),
      stair('2026-03-31'),
      stair('2026-04-16'),
    ]
    const out = filterStairSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-15'])
  })

  it('drops sessions with unparseable date strings rather than throwing', () => {
    const sessions: CardioSession[] = [
      stair('not-a-date'),
      stair('2026-04-10'),
    ]
    const out = filterStairSessions(
      sessions,
      range('2026-01-01T00:00:00', '2026-12-31T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-10'])
  })
})

describe('aggregateHrZoneSeconds', () => {
  it('sums time-in-zone across sessions in canonical Z1–Z5 order', () => {
    const sessions: CardioSession[] = [
      stair('2026-04-01', {
        hr_seconds_in_zone: { 1: 30, 2: 400, 3: 600, 4: 400, 5: 100 },
      }),
      stair('2026-04-08', {
        hr_seconds_in_zone: { 1: 20, 2: 380, 3: 720, 4: 540, 5: 140 },
      }),
    ]
    const out = aggregateHrZoneSeconds(sessions)
    expect(out.map((b) => b.seconds)).toEqual([50, 780, 1320, 940, 240])
    expect(out.map((b) => b.zone)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
  })

  it('returns five zero buckets when no session carries a zone breakdown', () => {
    const sessions: CardioSession[] = [stair('2026-04-01'), stair('2026-04-08')]
    const out = aggregateHrZoneSeconds(sessions)
    expect(out).toHaveLength(5)
    expect(out.every((b) => b.seconds === 0)).toBe(true)
  })

  it('returns five zero buckets when given no sessions', () => {
    const out = aggregateHrZoneSeconds([])
    expect(out.map((b) => b.zone)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
    expect(out.every((b) => b.seconds === 0)).toBe(true)
  })
})

describe('perSessionAvgHr', () => {
  it('keeps avg-HR-bearing sessions and projects M/D labels', () => {
    const sessions: CardioSession[] = [
      stair('2026-04-01', { avg_hr: 142 }),
      stair('2026-04-08'), // no avg_hr
      stair('2026-04-15', { avg_hr: 156 }),
    ]
    const out = perSessionAvgHr(sessions)
    expect(out).toEqual([
      { date: '2026-04-01', label: '4/1', avgHr: 142 },
      { date: '2026-04-15', label: '4/15', avgHr: 156 },
    ])
  })

  it('skips sessions whose date string cannot be parsed', () => {
    const sessions: CardioSession[] = [
      stair('garbage', { avg_hr: 140 }),
      stair('2026-04-10', { avg_hr: 150 }),
    ]
    const out = perSessionAvgHr(sessions)
    expect(out.map((p) => p.avgHr)).toEqual([150])
  })
})

describe('formatDuration', () => {
  it('formats whole minutes', () => {
    expect(formatDuration(1800)).toBe('30m 00s')
  })

  it('zero-pads seconds', () => {
    expect(formatDuration(1505)).toBe('25m 05s')
  })

  it('handles sub-minute durations', () => {
    expect(formatDuration(45)).toBe('0m 45s')
  })

  it('returns an em dash for invalid input', () => {
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(-12)).toBe('—')
  })
})
