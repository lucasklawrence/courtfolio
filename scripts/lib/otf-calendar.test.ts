/**
 * Tests for the ICS calendar reader (#453).
 *
 * The load-bearing assertion here is the timezone one. ical.js ships no
 * timezone database, so a `DTSTART;TZID=America/Los_Angeles` is treated as
 * floating local time unless the file's VTIMEZONE is registered first. On a UTC
 * CI runner that silently shifts every booking by seven hours — the reconcile
 * pass would then match nothing while looking exactly like a calendar with no
 * relevant events.
 */
import { describe, expect, it } from 'vitest'

import { parseIcsEvents } from './otf-calendar.mjs'

/**
 * Minimal but real America/Los_Angeles VTIMEZONE. Present in iCloud exports and
 * required for the TZID on each DTSTART to resolve.
 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Los_Angeles',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/** Wrap VEVENT lines in a complete VCALENDAR, CRLF-joined as RFC 5545 requires. */
function ics(...eventLines: string[][]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    ...VTIMEZONE,
    ...eventLines.flat(),
    'END:VCALENDAR',
  ].join('\r\n')
}

/** A well-formed booking event. */
function vevent({
  uid = 'evt-1',
  start = 'DTSTART;TZID=America/Los_Angeles:20260808T093000',
  end = 'DTEND;TZID=America/Los_Angeles:20260808T103000',
  summary = 'SUMMARY:Orange 60 Min 3G',
  location = 'LOCATION:Marina Del Rey',
}: Partial<Record<'uid' | 'start' | 'end' | 'summary' | 'location', string>> = {}): string[] {
  return [
    'BEGIN:VEVENT',
    ...(uid ? [`UID:${uid}`] : []),
    ...(start ? [start] : []),
    ...(end ? [end] : []),
    ...(summary ? [summary] : []),
    ...(location ? [location] : []),
    'END:VEVENT',
  ]
}

describe('parseIcsEvents', () => {
  it('resolves a TZID-qualified start to the correct UTC instant', () => {
    const { events } = parseIcsEvents(ics(vevent()))
    expect(events).toHaveLength(1)
    // 09:30 PDT on 2026-08-08 is 16:30 UTC — the exact instant the matching
    // session carries in production.
    expect(events[0].startsAt).toBe('2026-08-08T16:30:00.000Z')
    expect(events[0].endsAt).toBe('2026-08-08T17:30:00.000Z')
  })

  it('carries UID, summary and location through verbatim', () => {
    const { events } = parseIcsEvents(
      ics(vevent({ uid: 'abc-123', summary: 'SUMMARY:Orange HYROX 60 Min 2G' }))
    )
    expect(events[0]).toMatchObject({
      externalEventId: 'abc-123',
      titleRaw: 'Orange HYROX 60 Min 2G',
      locationRaw: 'Marina Del Rey',
    })
  })

  it('unfolds a folded SUMMARY line', () => {
    // RFC 5545 folding: a CRLF followed by a space continues the previous line.
    // Hand-rolled parsers routinely miss this and truncate the title.
    const folded = [
      'BEGIN:VEVENT',
      'UID:folded-1',
      'DTSTART;TZID=America/Los_Angeles:20260805T184500',
      'SUMMARY:Orange HYROX 60 M',
      ' in 2G',
      'LOCATION:Marina Del Rey',
      'END:VEVENT',
    ]
    const { events } = parseIcsEvents(ics(folded))
    expect(events[0].titleRaw).toBe('Orange HYROX 60 Min 2G')
  })

  it('reports a missing DTEND as null rather than a zero-length class', () => {
    // ical.js follows RFC 5545 and returns startDate as endDate when the event
    // has neither DTEND nor DURATION, so `event.endDate` is never falsy.
    // Passing that through would assert an end time the calendar never gave.
    const { events } = parseIcsEvents(ics(vevent({ end: '' })))
    expect(events[0].endsAt).toBeNull()
    expect(events[0].startsAt).toBe('2026-08-08T16:30:00.000Z')
  })

  it('derives the end from DURATION when there is no DTEND', () => {
    const { events } = parseIcsEvents(ics(vevent({ end: 'DURATION:PT1H' })))
    expect(events[0].endsAt).toBe('2026-08-08T17:30:00.000Z')
  })

  it('reports an event with no UID as skipped instead of storing it', () => {
    // Without a UID there is no idempotency key, so an upsert would duplicate
    // the row on every pull.
    const { events, skipped } = parseIcsEvents(ics(vevent({ uid: '' })))
    expect(events).toHaveLength(0)
    expect(skipped).toEqual([{ uid: null, titleRaw: 'Orange 60 Min 3G', reason: 'missing UID' }])
  })

  it('reports an event with no DTSTART as skipped', () => {
    const { events, skipped } = parseIcsEvents(ics(vevent({ uid: 'no-start', start: '' })))
    expect(events).toHaveLength(0)
    expect(skipped[0]).toMatchObject({ uid: 'no-start', reason: 'missing DTSTART' })
  })

  it('keeps good events when a sibling event is unusable', () => {
    // One malformed event must not abort a whole pull.
    const { events, skipped } = parseIcsEvents(ics(vevent({ uid: 'good-1' }), vevent({ uid: '' })))
    expect(events.map(e => e.externalEventId)).toEqual(['good-1'])
    expect(skipped).toHaveLength(1)
  })

  it("does not filter non-OTF events — that is the ingest layer's call", () => {
    // The reader is a dumb transport; deciding what counts as an OTF booking
    // lives with isOtfBookingTitle so the two skip reasons stay distinguishable.
    const { events } = parseIcsEvents(
      ics(vevent({ uid: 'dentist', summary: 'SUMMARY:Dentist appointment' }))
    )
    expect(events).toHaveLength(1)
    expect(events[0].titleRaw).toBe('Dentist appointment')
  })

  it('returns empty for a calendar with no events', () => {
    expect(parseIcsEvents(ics())).toEqual({ events: [], skipped: [], warnings: [] })
  })

  it('throws on a document that is not ICS at all', () => {
    expect(() => parseIcsEvents('not an ics file')).toThrow(/Failed to parse ICS/)
  })

  it('tolerates a UTF-8 BOM', () => {
    // PowerShell's Out-File and `>` default to UTF-8 *with* BOM on this
    // platform, so any re-save of the iCloud export produces one. Left in, it
    // aborts the entire import with an error naming neither the BOM nor the file.
    const { events } = parseIcsEvents('﻿' + ics(vevent()))
    expect(events).toHaveLength(1)
  })

  it('reads every VCALENDAR of a multi-root document', () => {
    // ICAL.parse returns `root.length == 1 ? root[0] : root`, so several
    // top-level VCALENDARs come back as a bare array. That is how concatenated
    // exports look, and how CalDAV multiget responses are assembled for Phase B.
    const doc = ics(vevent({ uid: 'a' })) + '\r\n' + ics(vevent({ uid: 'b' }))
    const { events } = parseIcsEvents(doc)
    expect(events.map(e => e.externalEventId).sort()).toEqual(['a', 'b'])
  })

  describe('ambiguous timezones', () => {
    // ical.js ships no timezone database and silently falls back to the *host*
    // zone, so without this the same file yields different instants on a
    // Pacific laptop and the UTC runner Phase B will use — shifting every
    // booking by seven hours so nothing matches.
    it('reads a floating DTSTART as studio wall-clock, not host-local', () => {
      const floating = [
        'BEGIN:VEVENT',
        'UID:floating-1',
        'DTSTART:20260808T093000',
        'SUMMARY:Orange 60 Min 3G',
        'END:VEVENT',
      ]
      const { events, warnings } = parseIcsEvents(ics(floating))
      expect(events[0].startsAt).toBe('2026-08-08T16:30:00.000Z')
      expect(warnings[0].reason).toMatch(/no resolvable timezone/)
    })

    it('reads a TZID with no VTIMEZONE as studio wall-clock', () => {
      const unresolved = [
        'BEGIN:VEVENT',
        'UID:unresolved-1',
        'DTSTART;TZID=Antarctica/Troll:20260808T093000',
        'SUMMARY:Orange 60 Min 3G',
        'END:VEVENT',
      ]
      const { events, warnings } = parseIcsEvents(ics(unresolved))
      expect(events[0].startsAt).toBe('2026-08-08T16:30:00.000Z')
      expect(warnings).toHaveLength(1)
    })

    it('leaves a resolvable zone alone and warns about nothing', () => {
      const { warnings } = parseIcsEvents(ics(vevent()))
      expect(warnings).toEqual([])
    })

    it('honours an explicit timeZone override', () => {
      const floating = [
        'BEGIN:VEVENT',
        'UID:floating-2',
        'DTSTART:20260808T093000',
        'SUMMARY:Orange 60 Min 3G',
        'END:VEVENT',
      ]
      const { events } = parseIcsEvents(ics(floating), { timeZone: 'UTC' })
      expect(events[0].startsAt).toBe('2026-08-08T09:30:00.000Z')
    })
  })

  it('drops a cancelled booking instead of letting it compete for the match', () => {
    // Cancel a 2G and rebook the slot as a 3G: left in, the cancelled row can
    // win the exact-time tie and stamp the session with the template that was
    // never actually attended.
    const cancelled = [
      'BEGIN:VEVENT',
      'UID:cancelled-1',
      'DTSTART;TZID=America/Los_Angeles:20260808T093000',
      'SUMMARY:Orange 60 Min 2G',
      'STATUS:CANCELLED',
      'END:VEVENT',
    ]
    const { events, skipped } = parseIcsEvents(ics(cancelled, vevent({ uid: 'attended' })))
    expect(events.map(e => e.externalEventId)).toEqual(['attended'])
    expect(skipped[0]).toMatchObject({ uid: 'cancelled-1', reason: 'STATUS:CANCELLED' })
  })

  it('keeps a detached recurrence instance distinct from its master', () => {
    // A detached instance carries its master's UID. Keyed on UID alone the two
    // collide, and since external_event_id is UNIQUE one could never be stored.
    const master = [
      'BEGIN:VEVENT',
      'UID:series-1',
      'DTSTART;TZID=America/Los_Angeles:20260803T184500',
      'SUMMARY:Orange 60 Min 2G',
      'END:VEVENT',
    ]
    const instance = [
      'BEGIN:VEVENT',
      'UID:series-1',
      'RECURRENCE-ID;TZID=America/Los_Angeles:20260810T184500',
      'DTSTART;TZID=America/Los_Angeles:20260810T184500',
      'SUMMARY:Orange 60 Min 3G',
      'END:VEVENT',
    ]
    const { events } = parseIcsEvents(ics(master, instance))
    const ids = events.map(e => e.externalEventId)
    expect(new Set(ids).size).toBe(2)
    expect(ids[0]).toBe('series-1')
    expect(ids[1]).toMatch(/^series-1#/)
  })

  it('warns that a recurring series was only read as its first occurrence', () => {
    // Expansion isn't implemented; under-collecting in silence would leave
    // later weeks looking like ordinary drop-ins.
    const recurring = [
      'BEGIN:VEVENT',
      'UID:weekly-1',
      'DTSTART;TZID=America/Los_Angeles:20260803T184500',
      'RRULE:FREQ=WEEKLY;COUNT=4',
      'SUMMARY:Orange 60 Min 2G',
      'END:VEVENT',
    ]
    const { events, warnings } = parseIcsEvents(ics(recurring))
    expect(events).toHaveLength(1)
    expect(warnings[0].reason).toMatch(/only the first occurrence/)
  })
})
