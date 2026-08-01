import { describe, expect, it } from 'vitest'

import {
  STALE_WORKOUT_HOURS,
  autoEndTimestamp,
  isStaleOpenWorkout,
  workoutDayKey,
  workoutDurationMinutes,
} from './workout-sessions'

/**
 * Coverage for the pure workout-session rules (#374): which day a session
 * belongs to, when an in-progress one counts as abandoned, and what timestamp
 * closing it should carry.
 */

describe('workoutDayKey', () => {
  it('buckets to the Pacific day the session started', () => {
    // 02:00 UTC = 19:00 PDT the previous day.
    expect(workoutDayKey({ started_at: '2026-07-16T02:00:00Z' })).toBe('2026-07-15')
  })

  it('keeps a session that crosses midnight on its start day', () => {
    // Starts 23:30 PDT on the 15th; whatever time it ends, it is the 15th's
    // workout. Splitting it across two days would be wrong in every rollup.
    expect(
      workoutDayKey({ started_at: '2026-07-16T06:30:00Z' }),
    ).toBe('2026-07-15')
  })

  it('tracks the winter offset', () => {
    // 07:30 UTC in January = 23:30 PST on the 11th.
    expect(workoutDayKey({ started_at: '2026-01-12T07:30:00Z' })).toBe('2026-01-11')
  })

  it('returns null for an unparseable timestamp rather than a bogus day', () => {
    expect(workoutDayKey({ started_at: 'not-a-date' })).toBeNull()
  })
})

describe('isStaleOpenWorkout', () => {
  const now = new Date('2026-07-15T20:00:00Z')

  it('is false for a session that started moments ago', () => {
    expect(isStaleOpenWorkout('2026-07-15T19:30:00Z', now)).toBe(false)
  })

  it('is false for a long-but-plausible session just inside the horizon', () => {
    const justInside = new Date(now.getTime() - (STALE_WORKOUT_HOURS - 1) * 3600_000)
    expect(isStaleOpenWorkout(justInside.toISOString(), now)).toBe(false)
  })

  it('is true once the session is older than the horizon', () => {
    const justOutside = new Date(now.getTime() - (STALE_WORKOUT_HOURS + 1) * 3600_000)
    expect(isStaleOpenWorkout(justOutside.toISOString(), now)).toBe(true)
  })

  it('is false for an unparseable timestamp', () => {
    // A bug in the stored value must not be read as licence to auto-end a
    // session the user may still be in.
    expect(isStaleOpenWorkout('garbage', now)).toBe(false)
  })
})

describe('autoEndTimestamp', () => {
  const started = '2026-07-13T18:00:00Z'

  it('closes at the last set logged into the session', () => {
    // The last real evidence of activity — not "now", which would invent two
    // days of session that never happened.
    expect(autoEndTimestamp(started, '2026-07-13T19:12:00Z')).toBe('2026-07-13T19:12:00Z')
  })

  it('collapses a session with no sets to zero duration', () => {
    expect(autoEndTimestamp(started, null)).toBe(started)
  })

  it('never ends before it started, even if a set is stamped earlier', () => {
    // Backdating slop would otherwise violate the table's
    // `ended_at >= started_at` check and fail the write.
    expect(autoEndTimestamp(started, '2026-07-13T17:00:00Z')).toBe(started)
  })

  it('falls back to started_at when the set timestamp is unparseable', () => {
    expect(autoEndTimestamp(started, 'not-a-date')).toBe(started)
  })
})

describe('workoutDurationMinutes', () => {
  it('measures a completed session', () => {
    expect(
      workoutDurationMinutes({
        started_at: '2026-07-15T18:00:00Z',
        ended_at: '2026-07-15T18:52:00Z',
      }),
    ).toBe(52)
  })

  it('returns null while the session is still open', () => {
    expect(workoutDurationMinutes({ started_at: '2026-07-15T18:00:00Z' })).toBeNull()
  })

  it('returns null rather than NaN on an unparseable timestamp', () => {
    expect(
      workoutDurationMinutes({ started_at: 'nope', ended_at: '2026-07-15T18:52:00Z' }),
    ).toBeNull()
  })
})
