import { describe, it, expect, vi, afterEach } from 'vitest'

import type { CardioSession } from '@/types/cardio'

import { computeStreaks } from './streaks'

/**
 * Local helper — build a minimal CardioSession for a given local date so test
 * cases can read as date-only without restating the whole session shape.
 */
function session(dateStr: string, activity: CardioSession['activity'] = 'stair'): CardioSession {
  return {
    date: `${dateStr}T08:00:00`,
    activity,
    duration_seconds: 1800,
  }
}

describe('computeStreaks', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0/0 for no sessions', () => {
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 })
  })

  it('returns 1-day streak when only today has a session', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    expect(computeStreaks([session('2026-04-16')])).toEqual({ current: 1, longest: 1 })
  })

  it('counts consecutive calendar days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [
      session('2026-04-13'),
      session('2026-04-14'),
      session('2026-04-15'),
      session('2026-04-16'),
    ]
    expect(computeStreaks(sessions)).toEqual({ current: 4, longest: 4 })
  })

  it('resets current streak on a gap', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [
      session('2026-04-10'),
      session('2026-04-11'),
      session('2026-04-12'),
      // gap on 04-13, 04-14
      session('2026-04-15'),
      session('2026-04-16'),
    ]
    const result = computeStreaks(sessions)
    expect(result.current).toBe(2)
    expect(result.longest).toBe(3)
  })

  it('current streak is 0 when last session was 2+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [
      session('2026-04-10'),
      session('2026-04-11'),
      session('2026-04-12'),
    ]
    const result = computeStreaks(sessions)
    expect(result.current).toBe(0)
    expect(result.longest).toBe(3)
  })

  it('counts yesterday as current if no session today yet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [session('2026-04-13'), session('2026-04-14'), session('2026-04-15')]
    const result = computeStreaks(sessions)
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3)
  })

  it('deduplicates multiple sessions on the same day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [
      session('2026-04-15', 'stair'),
      session('2026-04-15', 'running'),
      session('2026-04-16', 'stair'),
      session('2026-04-16', 'walking'),
    ]
    expect(computeStreaks(sessions)).toEqual({ current: 2, longest: 2 })
  })

  it('skips sessions with unparseable date strings', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00'))
    const sessions = [
      { date: 'not-a-date', activity: 'stair' as const, duration_seconds: 60 },
      session('2026-04-16'),
    ]
    expect(computeStreaks(sessions)).toEqual({ current: 1, longest: 1 })
  })
})
