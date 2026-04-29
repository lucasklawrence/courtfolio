import { describe, it, expect } from 'vitest'
import { filterWalkingSessions } from './walking'
import type { CardioSession } from '@/types/cardio'

const range = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
})

const walk = (date: string, extras: Partial<CardioSession> = {}): CardioSession => ({
  date,
  activity: 'walking',
  duration_seconds: 2400,
  ...extras,
})

describe('filterWalkingSessions', () => {
  it('keeps only walking-activity sessions inside the range, sorted oldest → newest', () => {
    const sessions: CardioSession[] = [
      walk('2026-04-10'),
      walk('2026-04-01'),
      { date: '2026-04-05', activity: 'stair', duration_seconds: 1500 },
      { date: '2026-04-12', activity: 'running', duration_seconds: 1800 },
      walk('2026-03-15'),
      walk('2026-04-20'),
    ]
    const out = filterWalkingSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-15T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-01', '2026-04-10'])
  })

  it('drops sessions whose date is unparseable', () => {
    const sessions: CardioSession[] = [
      walk('garbage'),
      walk('2026-04-05'),
    ]
    const out = filterWalkingSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-30T23:59:59.999'),
    )
    expect(out.map((s) => s.date)).toEqual(['2026-04-05'])
  })

  it('returns an empty array when no walking sessions exist', () => {
    const sessions: CardioSession[] = [
      { date: '2026-04-05', activity: 'stair', duration_seconds: 1500 },
      { date: '2026-04-12', activity: 'running', duration_seconds: 1800 },
    ]
    const out = filterWalkingSessions(
      sessions,
      range('2026-04-01T00:00:00', '2026-04-30T23:59:59.999'),
    )
    expect(out).toEqual([])
  })
})
