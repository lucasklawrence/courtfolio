/**
 * Calendar sources for the OTF booking feed (#453).
 *
 * A *source* is anything with an async `read()` returning
 * {@link CalendarEventBatch}. Phase A ships one implementation — read a local
 * `.ics` file — so the schema, parser, and reconcile pass are all testable
 * without a credential. Phase B adds a CalDAV source against
 * `caldav.icloud.com` behind this same interface; CalDAV responses are ICS
 * too, so {@link parseIcsEvents} is shared and only the transport differs.
 *
 * The source is deliberately dumb: it converts calendar events to a normalized
 * shape and reports what it couldn't convert. It does not decide what an OTF
 * booking is, does not parse titles, and does not touch the database.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 */

import { readFile } from 'node:fs/promises'

import ICAL from 'ical.js'

/**
 * One calendar event, normalized across transports. Field names are transport-
 * neutral; mapping to `otf_bookings` columns happens at the ingest layer.
 * @typedef {Object} CalendarEvent
 * @property {string} externalEventId The event UID — the idempotency key for upserts.
 * @property {string} startsAt Event start as a UTC ISO 8601 string.
 * @property {string|null} endsAt Event end as a UTC ISO 8601 string, or null when the event carries no DTEND.
 * @property {string} titleRaw Event SUMMARY verbatim, never parsed or trimmed of meaning.
 * @property {string|null} locationRaw Event LOCATION verbatim, or null when absent.
 */

/**
 * An event the reader could not turn into a {@link CalendarEvent}, kept so the
 * caller can log it rather than silently losing a booking.
 * @typedef {Object} SkippedEvent
 * @property {string|null} uid The event UID when it had one, else null.
 * @property {string|null} titleRaw The SUMMARY when it had one, else null.
 * @property {string} reason Why it couldn't be used, e.g. `'missing UID'`.
 */

/**
 * The result of reading a calendar: what parsed, and what didn't.
 * @typedef {Object} CalendarEventBatch
 * @property {CalendarEvent[]} events Usable events, in file order.
 * @property {SkippedEvent[]} skipped Structurally unusable events, with reasons.
 */

/**
 * Parse an ICS document into normalized events.
 *
 * VTIMEZONE components are registered with ical.js before any conversion.
 * This is not optional: ical.js ships no timezone database, so a `DTSTART`
 * carrying `TZID=America/Los_Angeles` would otherwise be treated as floating
 * local time. On a UTC CI runner that silently shifts every booking by seven
 * hours, which would make the reconcile pass miss every session while looking
 * like the calendar simply had no matches.
 *
 * Structurally unusable events — no UID (nothing to upsert on), no DTSTART
 * (nothing to reconcile against) — are reported in `skipped` rather than
 * thrown on, so one malformed event can't abort a whole pull. A title that
 * merely fails the *grammar* is not skipped here; that's the ingest layer's
 * business and such rows are stored with `title_raw` intact.
 *
 * @param {string} icsText Raw ICS document.
 * @returns {CalendarEventBatch} Usable events plus skip reasons.
 * @throws {Error} when the document isn't parseable ICS at all.
 */
export function parseIcsEvents(icsText) {
  let root
  try {
    root = new ICAL.Component(ICAL.parse(icsText))
  } catch (err) {
    throw new Error(`Failed to parse ICS document: ${err.message ?? err}`)
  }

  for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
    const tzid = vtimezone.getFirstPropertyValue('tzid')
    if (tzid && !ICAL.TimezoneService.has(tzid)) {
      ICAL.TimezoneService.register(vtimezone)
    }
  }

  const events = []
  const skipped = []

  for (const vevent of root.getAllSubcomponents('vevent')) {
    /** @type {string|null} */
    let uid = null
    /** @type {string|null} */
    let titleRaw = null
    try {
      const event = new ICAL.Event(vevent)
      uid = event.uid ?? null
      titleRaw = event.summary ?? null

      if (!uid) {
        skipped.push({ uid: null, titleRaw, reason: 'missing UID' })
        continue
      }
      if (!event.startDate) {
        skipped.push({ uid, titleRaw, reason: 'missing DTSTART' })
        continue
      }

      // `event.endDate` is never falsy: RFC 5545 gives an event with neither
      // DTEND nor DURATION a zero duration, and ical.js faithfully returns
      // startDate for it. Storing that would assert a zero-length class the
      // calendar never claimed, so fall back to null unless the event actually
      // carries one of the two properties.
      const hasEnd = vevent.hasProperty('dtend') || vevent.hasProperty('duration')

      events.push({
        externalEventId: uid,
        startsAt: event.startDate.toJSDate().toISOString(),
        endsAt: hasEnd ? event.endDate.toJSDate().toISOString() : null,
        titleRaw: titleRaw ?? '',
        locationRaw: event.location ?? null,
      })
    } catch (err) {
      skipped.push({ uid, titleRaw, reason: `unreadable VEVENT: ${err.message ?? err}` })
    }
  }

  return { events, skipped }
}

/**
 * A calendar source: something that can produce a batch of events on demand.
 * Phase A implements it over a local file; Phase B implements it over CalDAV.
 * @typedef {Object} CalendarSource
 * @property {string} describe Human-readable identity of the source, for logs.
 * @property {() => Promise<CalendarEventBatch>} read Fetch and parse the calendar.
 */

/**
 * A {@link CalendarSource} backed by an `.ics` file on disk.
 *
 * This is the Phase A producer and the permanent test seam — it keeps the
 * schema, title parser, and reconcile pass exercisable with no network and no
 * credential, which is what lets Phase A ship before the CalDAV work.
 *
 * @param {string} filePath Path to an `.ics` file.
 * @returns {CalendarSource} A source reading that file.
 */
export function createIcsFileSource(filePath) {
  return {
    describe: `ics file ${filePath}`,
    async read() {
      let text
      try {
        text = await readFile(filePath, 'utf8')
      } catch (err) {
        throw new Error(`Failed to read calendar file ${filePath}: ${err.message ?? err}`)
      }
      return parseIcsEvents(text)
    },
  }
}
