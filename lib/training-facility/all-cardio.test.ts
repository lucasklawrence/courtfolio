import { describe, expect, it } from 'vitest'
import type { CardioSession } from '@/types/cardio'
import {
  ACTIVITY_ORDER,
  ACTIVITY_VISUALS,
  countByActivity,
  filterAllCardioSessions,
  perSessionAvgHrByActivity,
  summarizeAllCardio,
} from './all-cardio'

const range = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
})

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

describe('filterAllCardioSessions', () => {
  it('keeps sessions of every activity inside the range, sorted oldest → newest', () => {
    const sessions: CardioSession[] = [
      session('2026-04-10', 'stair'),
      session('2026-04-01', 'running'),
      session('2026-04-05', 'walking'),
      session('2026-03-15', 'stair'),
      session('2026-04-20', 'running'),
    ]
    const out = filterAllCardioSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-05', '2026-04-10'])
    expect(out.map((s) => s.activity)).toEqual(['running', 'walking', 'stair'])
  })

  it('is inclusive on both ends', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', 'stair'),
      session('2026-04-15', 'walking'),
      session('2026-03-31', 'stair'),
      session('2026-04-16', 'running'),
    ]
    const out = filterAllCardioSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-15'])
  })

  it('drops sessions with unparseable date strings rather than throwing', () => {
    const sessions: CardioSession[] = [
      session('not-a-date', 'stair'),
      session('2026-04-10', 'running'),
    ]
    const out = filterAllCardioSessions(
      sessions,
      range('2026-01-01T00:00:00', '2026-12-31T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-10'])
  })
})

describe('summarizeAllCardio', () => {
  it('sums duration and distance across all activities and reports avg duration', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', 'stair', { duration_seconds: 1500 }),
      session('2026-04-02', 'running', { duration_seconds: 1800, distance_meters: 5000 }),
      session('2026-04-03', 'walking', { duration_seconds: 2400, distance_meters: 3200 }),
    ]
    const out = summarizeAllCardio(sessions)
    expect(out.sessionCount).toBe(3)
    expect(out.totalDurationSeconds).toBe(5700)
    expect(out.totalDistanceMeters).toBe(8200)
    expect(out.avgDurationSeconds).toBeCloseTo(1900)
  })

  it('returns zeroed totals and a null avg when given no sessions', () => {
    const out = summarizeAllCardio([])
    expect(out).toEqual({
      sessionCount: 0,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      avgDurationSeconds: null,
    })
  })

  it('treats sessions without distance as zero contribution', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', 'stair'),
      session('2026-04-02', 'running', { distance_meters: 4800 }),
    ]
    const out = summarizeAllCardio(sessions)
    expect(out.totalDistanceMeters).toBe(4800)
  })
})

describe('countByActivity', () => {
  it('groups by activity in canonical order, including zero rows for missing activities', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', 'stair', { duration_seconds: 1800 }),
      session('2026-04-02', 'stair', { duration_seconds: 1500 }),
      session('2026-04-03', 'walking', { duration_seconds: 2400 }),
    ]
    const out = countByActivity(sessions)
    expect(out.map((row) => row.activity)).toEqual(ACTIVITY_ORDER)
    expect(out).toEqual([
      { activity: 'stair', sessionCount: 2, totalDurationSeconds: 3300 },
      { activity: 'running', sessionCount: 0, totalDurationSeconds: 0 },
      { activity: 'walking', sessionCount: 1, totalDurationSeconds: 2400 },
    ])
  })

  it('returns three zero rows for an empty input', () => {
    const out = countByActivity([])
    expect(out.map((r) => r.activity)).toEqual(ACTIVITY_ORDER)
    expect(out.every((r) => r.sessionCount === 0 && r.totalDurationSeconds === 0)).toBe(true)
  })
})

describe('perSessionAvgHrByActivity', () => {
  it('keeps avg-HR-bearing sessions, threads activity through, projects M/D labels', () => {
    const sessions: CardioSession[] = [
      session('2026-04-01', 'stair', { avg_hr: 142 }),
      session('2026-04-08', 'running'), // no avg_hr — dropped
      session('2026-04-15', 'walking', { avg_hr: 118 }),
    ]
    const out = perSessionAvgHrByActivity(sessions)
    expect(out).toEqual([
      { date: '2026-04-01', label: '4/1', avgHr: 142, activity: 'stair' },
      { date: '2026-04-15', label: '4/15', avgHr: 118, activity: 'walking' },
    ])
  })

  it('skips sessions whose date string cannot be parsed', () => {
    const sessions: CardioSession[] = [
      session('garbage', 'stair', { avg_hr: 140 }),
      session('2026-04-10', 'running', { avg_hr: 150 }),
    ]
    const out = perSessionAvgHrByActivity(sessions)
    expect(out.map((p) => p.avgHr)).toEqual([150])
  })
})

describe('ACTIVITY_VISUALS', () => {
  it('defines a visual entry for every CardioActivity', () => {
    for (const a of ACTIVITY_ORDER) {
      expect(ACTIVITY_VISUALS[a]).toBeDefined()
      expect(ACTIVITY_VISUALS[a].activity).toBe(a)
    }
  })
})
