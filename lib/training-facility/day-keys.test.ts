import { describe, expect, it } from 'vitest'

import {
  dayKeyToPacificNoon,
  dayKeyToPacificNoonIso,
  firstDayOfMonth,
  formatDayKey,
  inclusiveDaySpan,
  isDayKey,
  isoWeekdayOfDayKey,
  lastDayOfMonth,
  mondayOfDayKey,
  monthIndexOfDayKey,
  pacificDayKey,
  safePacificDayKey,
  shiftDayKey,
  todayDayKey,
} from './day-keys'

/**
 * Unit tests for the shared Pacific day-key toolkit (#319).
 *
 * The cases that matter are the ones the old server-local implementation got
 * wrong: an evening Pacific timestamp that is already tomorrow in UTC, and day
 * arithmetic across a DST transition.
 */

describe('pacificDayKey', () => {
  it('buckets an evening Pacific timestamp to that Pacific day, not the UTC one', () => {
    // 05:00Z on the 12th is 10pm PDT on the 11th. The server-local reading
    // this replaces would have said 2026-07-12 — the whole bug in one case.
    expect(pacificDayKey(new Date('2026-07-12T05:00:00Z'))).toBe('2026-07-11')
  })

  it('buckets a midday Pacific timestamp to the same day in both zones', () => {
    expect(pacificDayKey(new Date('2026-07-11T19:00:00Z'))).toBe('2026-07-11')
  })

  it('handles the PST side of the year', () => {
    // 07:00Z on Jan 2 is 11pm PST on Jan 1.
    expect(pacificDayKey(new Date('2026-01-02T07:00:00Z'))).toBe('2026-01-01')
  })

  it('zero-pads so keys sort lexicographically', () => {
    expect(pacificDayKey(new Date('2026-03-05T20:00:00Z'))).toBe('2026-03-05')
    expect('2026-03-05' < '2026-03-12').toBe(true)
  })
})

describe('safePacificDayKey', () => {
  it('accepts an ISO string', () => {
    expect(safePacificDayKey('2026-07-12T05:00:00Z')).toBe('2026-07-11')
  })

  it('accepts a Date', () => {
    expect(safePacificDayKey(new Date('2026-07-12T05:00:00Z'))).toBe('2026-07-11')
  })

  it('returns an empty string for an unparseable timestamp', () => {
    expect(safePacificDayKey('not-a-timestamp')).toBe('')
    expect(safePacificDayKey(new Date(NaN))).toBe('')
  })

  it('returns a key that sorts before every real one, so bad rows drop out', () => {
    expect('' < '1970-01-01').toBe(true)
  })
})

describe('isDayKey', () => {
  it('accepts a bare YYYY-MM-DD', () => {
    expect(isDayKey('2026-07-11')).toBe(true)
  })

  it('rejects a timestamp or a partial date', () => {
    expect(isDayKey('2026-07-11T05:00:00Z')).toBe(false)
    expect(isDayKey('2026-7-11')).toBe(false)
    expect(isDayKey('2026-07')).toBe(false)
    expect(isDayKey('')).toBe(false)
  })
})

describe('shiftDayKey', () => {
  it('adds and subtracts days', () => {
    expect(shiftDayKey('2026-07-11', 1)).toBe('2026-07-12')
    expect(shiftDayKey('2026-07-11', -1)).toBe('2026-07-10')
    expect(shiftDayKey('2026-07-11', 0)).toBe('2026-07-11')
  })

  it('crosses month and year boundaries', () => {
    expect(shiftDayKey('2026-07-31', 1)).toBe('2026-08-01')
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(shiftDayKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('is unaffected by the spring-forward DST transition', () => {
    // 2026-03-08 is a 23-hour day in Pacific. Millisecond arithmetic on a
    // zoned Date lands on the wrong side of it; calendar arithmetic doesn't.
    expect(shiftDayKey('2026-03-07', 1)).toBe('2026-03-08')
    expect(shiftDayKey('2026-03-08', 1)).toBe('2026-03-09')
  })

  it('is unaffected by the fall-back DST transition', () => {
    // 2026-11-01 is a 25-hour day in Pacific.
    expect(shiftDayKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDayKey('2026-11-01', 1)).toBe('2026-11-02')
  })
})

describe('isoWeekdayOfDayKey', () => {
  it('numbers Monday as 1 through Sunday as 7', () => {
    expect(isoWeekdayOfDayKey('2026-07-06')).toBe(1) // Monday
    expect(isoWeekdayOfDayKey('2026-07-11')).toBe(6) // Saturday
    expect(isoWeekdayOfDayKey('2026-07-12')).toBe(7) // Sunday
  })
})

describe('mondayOfDayKey', () => {
  it('returns the same day for a Monday', () => {
    expect(mondayOfDayKey('2026-07-06')).toBe('2026-07-06')
  })

  it('walks back to Monday from mid-week', () => {
    expect(mondayOfDayKey('2026-07-09')).toBe('2026-07-06')
  })

  it('treats Sunday as the end of its week, not the start', () => {
    expect(mondayOfDayKey('2026-07-12')).toBe('2026-07-06')
  })

  it('crosses a month boundary', () => {
    expect(mondayOfDayKey('2026-08-01')).toBe('2026-07-27')
  })
})

describe('inclusiveDaySpan', () => {
  it('counts a single day as 1', () => {
    expect(inclusiveDaySpan('2026-07-11', '2026-07-11')).toBe(1)
  })

  it('counts both endpoints', () => {
    expect(inclusiveDaySpan('2026-07-01', '2026-07-31')).toBe(31)
  })

  it('returns 0 when the range is inverted', () => {
    expect(inclusiveDaySpan('2026-07-31', '2026-07-01')).toBe(0)
  })

  it('is exact across a DST transition', () => {
    // March 2026 has both a 23-hour day and 31 calendar days.
    expect(inclusiveDaySpan('2026-03-01', '2026-03-31')).toBe(31)
    expect(inclusiveDaySpan('2026-11-01', '2026-11-30')).toBe(30)
  })
})

describe('month helpers', () => {
  it('finds the first and last day of a month', () => {
    expect(firstDayOfMonth('2026-07-15')).toBe('2026-07-01')
    expect(lastDayOfMonth('2026-07-15')).toBe('2026-07-31')
  })

  it('handles a 30-day month and February', () => {
    expect(lastDayOfMonth('2026-06-10')).toBe('2026-06-30')
    expect(lastDayOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('reports a zero-based month index', () => {
    expect(monthIndexOfDayKey('2026-01-15')).toBe(0)
    expect(monthIndexOfDayKey('2026-12-15')).toBe(11)
  })
})

describe('dayKeyToPacificNoon', () => {
  it('round-trips back to the same key', () => {
    for (const key of ['2026-01-01', '2026-03-08', '2026-07-11', '2026-11-01', '2026-12-31']) {
      expect(pacificDayKey(dayKeyToPacificNoon(key)!)).toBe(key)
    }
  })

  it('lands midday so a viewer in another zone still reads the right day', () => {
    const d = dayKeyToPacificNoon('2026-07-11')!
    // 19:00Z = noon PDT. Far enough from either midnight that no real UTC
    // offset renders it as an adjacent day.
    expect(d.toISOString()).toBe('2026-07-11T19:00:00.000Z')
  })

  it('rejects a malformed key', () => {
    expect(dayKeyToPacificNoon('2026-7-11')).toBeNull()
    expect(dayKeyToPacificNoon('')).toBeNull()
  })

  it('rejects a calendar-invalid date rather than rolling it forward', () => {
    // `new Date('2026-02-31…')` silently becomes March 3.
    expect(dayKeyToPacificNoon('2026-02-31')).toBeNull()
  })
})

describe('dayKeyToPacificNoonIso', () => {
  it('stamps a backdated set at Pacific noon on the chosen day', () => {
    const iso = dayKeyToPacificNoonIso('2026-07-11')
    expect(safePacificDayKey(iso)).toBe('2026-07-11')
  })

  it('returns an empty string for an invalid key', () => {
    expect(dayKeyToPacificNoonIso('nope')).toBe('')
  })
})

describe('todayDayKey', () => {
  it('uses the supplied clock', () => {
    expect(todayDayKey(new Date('2026-07-12T05:00:00Z'))).toBe('2026-07-11')
  })
})

describe('formatDayKey', () => {
  it('names the Pacific day regardless of the viewer timezone', () => {
    // The underlying instant is 19:00Z, which is already the *next* local day
    // in Asia/Tokyo (UTC+9). Formatting it viewer-local would render "Jul 12"
    // for a 2026-07-11 key and contradict the key it came from.
    expect(formatDayKey('2026-07-11', { month: 'short', day: 'numeric' }, 'en-US')).toBe('Jul 11')
  })

  it('ignores a caller-supplied timeZone', () => {
    const label = formatDayKey(
      '2026-07-11',
      { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' },
      'en-US'
    )
    expect(label).toBe('Jul 11')
  })

  it('formats a weekday label', () => {
    // 2026-05-25 is a Monday.
    expect(
      formatDayKey('2026-05-25', { weekday: 'short', month: 'short', day: 'numeric' }, 'en-US')
    ).toBe('Mon, May 25')
  })

  it('returns an empty string for an invalid key', () => {
    expect(formatDayKey('nope', { month: 'short' }, 'en-US')).toBe('')
    expect(formatDayKey('2026-02-31', { month: 'short' }, 'en-US')).toBe('')
  })
})
