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

// Reused rather than reimplemented: DST-correct wall-clock → UTC conversion is
// exactly the arithmetic this module needs for a floating DTSTART, and it is
// already written and tested there. The import direction (calendar → supabase
// helper) is unfortunate; the function is a pure date utility that would sit
// better in a shared module, but moving it is a wider refactor than this change.
import { DEFAULT_STUDIO_TZ, wallTimeToISO } from './otbeat-supabase.mjs'

/**
 * One calendar event, normalized across transports. Field names are transport-
 * neutral; mapping to `otf_bookings` columns happens at the ingest layer.
 * @typedef {Object} CalendarEvent
 * @property {string} externalEventId Stable idempotency key for upserts — the event UID, suffixed with the RECURRENCE-ID when this is a detached instance.
 * @property {string} startsAt Event start as a UTC ISO 8601 string.
 * @property {string|null} endsAt Event end as a UTC ISO 8601 string, or null when the event carries no DTEND or DURATION.
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
 * An event that *was* converted, but with a caveat the operator should see —
 * data that is present but incomplete or assumed. Distinct from
 * {@link SkippedEvent}: the event is in `events`, it just isn't the whole story.
 * @typedef {Object} EventWarning
 * @property {string|null} uid The event UID.
 * @property {string|null} titleRaw The SUMMARY.
 * @property {string} reason What was assumed or left undone.
 */

/**
 * The result of reading a calendar: what parsed, what didn't, and what parsed
 * with a caveat.
 * @typedef {Object} CalendarEventBatch
 * @property {CalendarEvent[]} events Usable events, in file order.
 * @property {SkippedEvent[]} skipped Unusable or deliberately-ignored events, with reasons.
 * @property {EventWarning[]} warnings Events that converted but carry a caveat.
 */

/**
 * Strip a leading UTF-8 BOM.
 *
 * Node's `readFile(…, 'utf8')` leaves U+FEFF in the string and `ICAL.parse`
 * then fails on `﻿BEGIN:VCALENDAR` with an error naming neither the BOM
 * nor the file. Very reachable here: PowerShell's `Out-File` and `>` default to
 * UTF-8 *with* BOM on this platform, so re-saving an iCloud export through any
 * PowerShell step produces exactly that.
 *
 * @param {string} text Raw document text.
 * @returns {string} The text without a leading BOM.
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Normalize `ICAL.parse` output into a list of VCALENDAR components.
 *
 * `ICAL.parse` ends with `return root.length == 1 ? root[0] : root`, so a
 * document with several top-level VCALENDARs yields a raw *array* of jCal
 * rather than one component. Passing that straight to `ICAL.Component`
 * succeeds (the constructor only assigns `jCal`) and then blows up on the next
 * property access with an opaque TypeError. Multi-root is not exotic — it's how
 * two concatenated exports look, and how many CalDAV multiget responses are
 * assembled, which Phase A must already tolerate so Phase B doesn't inherit it.
 *
 * @param {unknown} jcal Parsed jCal, one component or an array of them.
 * @returns {ICAL.Component[]} One component per VCALENDAR root.
 */
function toRootComponents(jcal) {
  const isComponentArray = Array.isArray(jcal) && Array.isArray(jcal[0])
  return isComponentArray
    ? jcal.map(one => new ICAL.Component(one))
    : [new ICAL.Component(/** @type {never} */ (jcal))]
}

/**
 * Convert a VEVENT's start/end to a UTC ISO string, resolving an ambiguous
 * timezone against the studio zone rather than the host's.
 *
 * ical.js ships no timezone database. `ICAL.Time` falls back to
 * `Timezone.localTimezone` both for a floating DTSTART (no TZID, no trailing
 * `Z`) and for a TZID with no matching VTIMEZONE in the document — and
 * `toJSDate()` then builds the instant with `new Date(y, m-1, d, …)`, i.e. in
 * whatever zone the *machine* is in. The same `.ics` would therefore produce
 * one instant on a Pacific laptop and another on the UTC CI runner Phase B
 * will use, shifting every booking by seven hours so the ±15-minute match
 * window finds nothing — while looking exactly like a calendar with no
 * relevant classes.
 *
 * Registering the document's VTIMEZONEs does not prevent this: those are the
 * zones ical.js can already resolve. So an unresolved zone is reinterpreted
 * here as {@link DEFAULT_STUDIO_TZ} wall-clock, which is what a floating time
 * on a gym booking actually means, and the caller is warned that an assumption
 * was made.
 *
 * @param {ICAL.Time} time The DTSTART/DTEND value.
 * @param {string} timeZone IANA zone to assume when the event's own is unresolved.
 * @returns {{ iso: string, assumedZone: boolean }} UTC ISO string, and whether the zone had to be assumed.
 */
function toUtcIso(time, timeZone) {
  if (time.zone !== ICAL.Timezone.localTimezone) {
    return { iso: time.toJSDate().toISOString(), assumedZone: false }
  }
  return {
    iso: wallTimeToISO(time.year, time.month, time.day, time.hour, time.minute, timeZone),
    assumedZone: true,
  }
}

/**
 * Parse an ICS document into normalized events.
 *
 * VTIMEZONE components are registered with ical.js before any conversion so a
 * `TZID` the document defines resolves correctly; {@link toUtcIso} handles the
 * cases registration cannot cover.
 *
 * Events are reported in three buckets rather than silently dropped, because
 * every quiet loss here degrades into "0 linked, N unmatched" — indistinguishable
 * from a healthy run over a calendar of genuine drop-ins:
 * - **skipped**: no UID (nothing to upsert on), no DTSTART (nothing to match),
 *   or `STATUS:CANCELLED` (a cancelled slot must never label a session).
 * - **warnings**: converted, but with an assumed timezone or an unexpanded
 *   recurrence rule.
 * - **events**: everything else.
 *
 * A title that merely fails the *grammar* is not skipped here; that's the
 * ingest layer's business and such rows are stored with `title_raw` intact.
 *
 * @param {string} icsText Raw ICS document.
 * @param {{ timeZone?: string }} [opts] Zone to assume for a floating/unresolved DTSTART.
 * @returns {CalendarEventBatch} Usable events, skip reasons, and caveats.
 * @throws {Error} when the document isn't parseable ICS at all.
 */
export function parseIcsEvents(icsText, opts = {}) {
  const timeZone = opts.timeZone ?? DEFAULT_STUDIO_TZ

  let roots
  try {
    roots = toRootComponents(ICAL.parse(stripBom(icsText)))
  } catch (err) {
    throw new Error(`Failed to parse ICS document: ${err.message ?? err}`)
  }

  for (const root of roots) {
    for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
      const tzid = vtimezone.getFirstPropertyValue('tzid')
      if (tzid && !ICAL.TimezoneService.has(tzid)) {
        ICAL.TimezoneService.register(vtimezone)
      }
    }
  }

  const events = []
  const skipped = []
  const warnings = []

  for (const root of roots) {
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
        // A cancelled slot still sits in the export. Left in, it competes for
        // the match window against the class actually attended — cancel a 2G
        // and rebook the slot as a 3G and the session could be stamped '2G'
        // with a provenance dot claiming the calendar said so.
        if (String(vevent.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') {
          skipped.push({ uid, titleRaw, reason: 'STATUS:CANCELLED' })
          continue
        }

        // A detached instance carries its master's UID, so keying on UID alone
        // makes the two collide — the last one wins the in-batch dedupe and the
        // other can never be stored, since external_event_id is UNIQUE.
        const recurrenceId = vevent.getFirstPropertyValue('recurrence-id')
        const externalEventId = recurrenceId ? `${uid}#${recurrenceId.toICALString()}` : uid

        const start = toUtcIso(event.startDate, timeZone)
        // `event.endDate` is never falsy: RFC 5545 gives an event with neither
        // DTEND nor DURATION a zero duration, and ical.js faithfully returns
        // startDate for it. Storing that would assert a zero-length class the
        // calendar never claimed.
        const hasEnd = vevent.hasProperty('dtend') || vevent.hasProperty('duration')
        const end = hasEnd ? toUtcIso(event.endDate, timeZone) : null

        if (start.assumedZone) {
          warnings.push({
            uid,
            titleRaw,
            reason: `DTSTART had no resolvable timezone; read as ${timeZone} wall-clock`,
          })
        }
        // Expanding an RRULE needs a bounded window and occurrence-level ids;
        // not built, because every observed booking is a one-off. Warn rather
        // than under-collect in silence: a standing weekly entry would yield
        // one row and leave later weeks looking like ordinary drop-ins.
        if (event.isRecurring()) {
          warnings.push({
            uid,
            titleRaw,
            reason: 'recurring series (RRULE) — only the first occurrence is read',
          })
        }

        events.push({
          externalEventId,
          startsAt: start.iso,
          endsAt: end ? end.iso : null,
          titleRaw: titleRaw ?? '',
          locationRaw: event.location ?? null,
        })
      } catch (err) {
        skipped.push({ uid, titleRaw, reason: `unreadable VEVENT: ${err.message ?? err}` })
      }
    }
  }

  return { events, skipped, warnings }
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
 * @param {{ timeZone?: string }} [opts] Zone to assume for a floating/unresolved DTSTART.
 * @returns {CalendarSource} A source reading that file.
 */
export function createIcsFileSource(filePath, opts = {}) {
  return {
    describe: `ics file ${filePath}`,
    async read() {
      let text
      try {
        text = await readFile(filePath, 'utf8')
      } catch (err) {
        throw new Error(`Failed to read calendar file ${filePath}: ${err.message ?? err}`)
      }
      return parseIcsEvents(text, opts)
    },
  }
}
