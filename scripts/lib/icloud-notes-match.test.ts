/**
 * Tests for note-to-session attribution (#400).
 *
 * The cases pin the failure this code exists to prevent: a note's sets welded
 * onto the wrong session's heart rate, which nothing downstream would render
 * as suspicious. Anchored on the real 2024-04-16 pair, and on the two ways the
 * naive join breaks — a summer date read at the wrong UTC offset, and one of
 * the eight days in this history that carry two strength sessions.
 */
import { describe, expect, it } from 'vitest'

import {
  localDayKey,
  localToInstant,
  matchNoteToSession,
  overlapMs,
  parseNotesCsvStamp,
  zoneOffsetMs,
} from './icloud-notes-match.mjs'

const LA = 'America/Los_Angeles'

describe('overlapMs', () => {
  it('measures a genuine intersection', () => {
    expect(overlapMs(0, 100, 50, 150)).toBe(50)
  })

  it('is zero for disjoint and for merely touching intervals', () => {
    expect(overlapMs(0, 100, 200, 300)).toBe(0)
    expect(overlapMs(0, 100, 100, 200)).toBe(0)
  })

  it('reports full containment as the contained span', () => {
    expect(overlapMs(50, 80, 0, 100)).toBe(30)
  })
})

describe('zoneOffsetMs', () => {
  it('tracks daylight saving rather than assuming a fixed offset', () => {
    // -08:00 in winter, -07:00 in summer. Assuming either one year-round
    // shifts half the history by an hour.
    expect(zoneOffsetMs(new Date('2024-01-15T20:00:00Z'), LA)).toBe(-8 * 3600_000)
    expect(zoneOffsetMs(new Date('2024-07-15T20:00:00Z'), LA)).toBe(-7 * 3600_000)
  })
})

describe('localToInstant / parseNotesCsvStamp', () => {
  it('reads an unmarked local stamp as local, not UTC', () => {
    // The note manifest stamps wall-clock time with no offset. Read as UTC
    // this lands seven hours early and matches nothing.
    expect(parseNotesCsvStamp('04-16-2024 21:40:38', LA)?.toISOString()).toBe(
      '2024-04-17T04:40:38.000Z'
    )
  })

  it('applies the winter offset to a winter stamp', () => {
    expect(parseNotesCsvStamp('01-22-2024 21:09:05', LA)?.toISOString()).toBe(
      '2024-01-23T05:09:05.000Z'
    )
  })

  it('rejects a cell that is not a stamp', () => {
    expect(parseNotesCsvStamp('', LA)).toBeNull()
    expect(parseNotesCsvStamp('not a date', LA)).toBeNull()
    expect(parseNotesCsvStamp(undefined as unknown as string, LA)).toBeNull()
  })

  it('round-trips through localDayKey', () => {
    const instant = localToInstant({ year: 2024, month: 4, day: 16, hour: 21 }, LA)
    expect(localDayKey(instant, LA)).toBe('2024-04-16')
  })

  it('keeps a late-evening local time on its own local day', () => {
    // 21:40 local is already tomorrow in UTC; bucketing on the UTC date would
    // file this session under the 17th.
    const instant = parseNotesCsvStamp('04-16-2024 21:40:38', LA)!
    expect(instant.toISOString().slice(0, 10)).toBe('2024-04-17')
    expect(localDayKey(instant, LA)).toBe('2024-04-16')
  })
})

describe('matchNoteToSession', () => {
  // The real pair that established the approach: the note was typed during the
  // workout, so its create/modify span sits inside the Health window.
  const sessions = [
    {
      id: 'apr-15',
      started_at: '2024-04-16T04:19:01Z',
      ended_at: '2024-04-16T05:06:10Z',
    },
    {
      id: 'apr-16',
      started_at: '2024-04-17T04:39:00Z',
      ended_at: '2024-04-17T05:10:42Z',
    },
    {
      id: 'apr-17',
      started_at: '2024-04-18T02:05:51Z',
      ended_at: '2024-04-18T02:53:03Z',
    },
  ]

  const noteWindow = {
    start: parseNotesCsvStamp('04-16-2024 21:40:38', LA)!,
    end: parseNotesCsvStamp('04-16-2024 22:07:12', LA)!,
  }

  it('attributes a note to the session it was typed inside', () => {
    const match = matchNoteToSession(noteWindow, sessions, LA)
    expect(match?.id).toBe('apr-16')
    expect(match?.method).toBe('overlap')
    expect(match?.overlapMs).toBe(26 * 60_000 + 34_000)
  })

  it('prefers the larger overlap when two sessions both intersect', () => {
    // One of the 8 two-session days. A same-day join would coin-flip these.
    const twoOnOneDay = [
      { id: 'morning', started_at: '2024-04-17T04:30:00Z', ended_at: '2024-04-17T04:45:00Z' },
      { id: 'evening', started_at: '2024-04-17T04:39:00Z', ended_at: '2024-04-17T05:10:42Z' },
    ]
    expect(matchNoteToSession(noteWindow, twoOnOneDay, LA)?.id).toBe('evening')
  })

  it('falls back to the day when nothing overlaps and the day is unambiguous', () => {
    // Typed up after the fact — still the same session, just not concurrent.
    const written = {
      start: parseNotesCsvStamp('04-16-2024 23:30:00', LA)!,
      end: parseNotesCsvStamp('04-16-2024 23:40:00', LA)!,
    }
    const match = matchNoteToSession(written, sessions, LA)
    expect(match?.id).toBe('apr-16')
    expect(match?.method).toBe('same-day')
  })

  it('refuses to guess when the day holds two sessions and none overlap', () => {
    const written = {
      start: parseNotesCsvStamp('04-16-2024 23:30:00', LA)!,
      end: parseNotesCsvStamp('04-16-2024 23:40:00', LA)!,
    }
    const ambiguous = [
      { id: 'a', started_at: '2024-04-17T01:00:00Z', ended_at: '2024-04-17T01:30:00Z' },
      { id: 'b', started_at: '2024-04-17T04:39:00Z', ended_at: '2024-04-17T05:10:42Z' },
    ]
    expect(matchNoteToSession(written, ambiguous, LA)).toBeNull()
  })

  it('returns null when the day has no session at all', () => {
    const orphan = {
      start: parseNotesCsvStamp('05-01-2024 18:00:00', LA)!,
      end: parseNotesCsvStamp('05-01-2024 18:45:00', LA)!,
    }
    expect(matchNoteToSession(orphan, sessions, LA)).toBeNull()
  })

  it('does not let an unfinished session swallow every note that day', () => {
    // A null `ended_at` treated as open-ended would overlap everything after it.
    const openEnded = [{ id: 'open', started_at: '2024-04-17T00:01:00Z', ended_at: null }]
    expect(matchNoteToSession(noteWindow, openEnded, LA)?.method).toBe('same-day')
  })

  it('returns null for an unparseable note window', () => {
    const bad = { start: new Date('nope'), end: new Date('nope') }
    expect(matchNoteToSession(bad, sessions, LA)).toBeNull()
  })
})
