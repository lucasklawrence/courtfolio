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
    expect(parseIcsEvents(ics())).toEqual({ events: [], skipped: [] })
  })

  it('throws on a document that is not ICS at all', () => {
    expect(() => parseIcsEvents('not an ics file')).toThrow(/Failed to parse ICS/)
  })
})
