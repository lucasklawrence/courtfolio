/**
 * Supabase read/write helpers for the OTF booking feed (#453).
 *
 * Three responsibilities, deliberately separate from `otbeat-supabase.mjs`
 * (which owns the *email* path):
 *
 * 1. {@link upsertOtfBookings} — mirror calendar events into `otf_bookings`.
 * 2. {@link reconcileOtfBookings} — match sessions to bookings and resolve
 *    `class_format`.
 * 3. The data-quality gates ({@link findSessionsMissingClassFormat},
 *    {@link findBookingFeedSilence}) that make a broken feed loud.
 *
 * WHY RECONCILE IS ITS OWN PASS, not a join at ingest: `upsertOtfSessions` is
 * insert-if-absent with exactly one narrow write-back, and it avoids a full-row
 * upsert on purpose — supabase-js `upsert` with `ignoreDuplicates: false` emits
 * `DO UPDATE SET` on every column, which would clobber manual edits. That's the
 * guarantee #268 and #271 both rest on. Bookings and sessions also arrive from
 * independent pulls in either order: a class booked after this morning's run,
 * or a session ingested before its booking appears, are both normal. So
 * resolution is a separate pass that writes only what is currently null and
 * never touches a manual label.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 */

import { createServiceRoleClient, loadEnv } from './cardio-supabase.mjs'
import {
  isOtfBookingTitle,
  normalizeStudio,
  parseBookingTitle,
  studiosMatch,
} from './otf-booking-parser.mjs'

export { createServiceRoleClient, loadEnv }

/**
 * Rows per page when reading tables in full. Below Supabase's default
 * `max_rows` of 1000 so a page is never server-truncated — the same reason
 * `otbeat-supabase.mjs` pages its session read.
 */
const READ_PAGE_SIZE = 500

/**
 * How far apart a session's `started_at` and a booking's `starts_at` may be and
 * still be the same class, in minutes.
 *
 * Observed booking times match the OTbeat report exactly in every case checked
 * (2026-08-05 calendar 18:45 / email 6:45 PM; 2026-08-08 calendar 09:30 / email
 * 9:30 AM), so this is slack against clock skew rather than a necessity.
 *
 * The window can still overlap two bookings at one studio if classes are
 * scheduled closer together than 30 minutes; {@link findMatchingBooking}
 * resolves that by taking the nearest in time, so widening this degrades
 * gracefully instead of matching arbitrarily.
 */
export const DEFAULT_MATCH_TOLERANCE_MIN = 15

/**
 * Lookback for {@link findBookingFeedSilence}, in days. Long enough that a
 * normal gap in attendance (travel, a light week) still contains sessions to
 * compare against, short enough that a genuinely broken feed surfaces inside a
 * fortnight rather than a quarter.
 */
export const DEFAULT_SILENCE_WINDOW_DAYS = 14

/**
 * Read every row of a table, paging until a short page ends it.
 *
 * Pagination is not optional: PostgREST caps an unbounded `select` at
 * `max_rows` and returns the first page with no error, so a single unranged
 * read would silently look like the whole table — and a reconcile that can't
 * see a booking reports it as unmatched, which is exactly the false alarm the
 * gates exist to avoid.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {string} table Table name.
 * @param {string} columns PostgREST select list.
 * @param {string} orderBy Column to order by. Must be **unique**, not merely
 *   sorted: `.range()` issues one query per page, and Postgres may order a
 *   tied group differently between them, so a row on a page boundary can come
 *   back twice while a sibling is never returned at all.
 * @returns {Promise<Array<Record<string, unknown>>>} Every row, ascending.
 * @throws {Error} on any Supabase read failure.
 */
async function readAll(supabase, table, columns, orderBy) {
  const all = []
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1)
    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`)
    }
    const page = data ?? []
    all.push(...page)
    if (page.length < READ_PAGE_SIZE) return all
  }
}

/**
 * Map a {@link import('./otf-calendar.mjs').CalendarEvent} to an
 * `otf_bookings` row.
 *
 * `title_raw` and `studio_raw` are always written verbatim. The parsed columns
 * are best-effort: a title that doesn't match the grammar yields nulls and the
 * row is still stored, because the booking existed even if we can't name its
 * template, and `title_raw` keeps the evidence for a later re-parse.
 *
 * @param {import('./otf-calendar.mjs').CalendarEvent} event Normalized event.
 * @returns {Record<string, unknown>} Row payload for `otf_bookings`.
 */
export function eventToBookingRow(event) {
  const { program, durationMin, format } = parseBookingTitle(event.titleRaw)
  return {
    external_event_id: event.externalEventId,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    title_raw: event.titleRaw,
    studio_raw: event.locationRaw,
    studio: normalizeStudio(event.locationRaw),
    program,
    duration_min: durationMin,
    format: composeClassFormat(program, format),
    // Refreshed on every upsert, unlike `ingested_at` which records only the
    // first sighting. This is the feed's liveness signal — see
    // {@link findBookingFeedSilence}, which cannot use `starts_at` because
    // already-stored *future* bookings would keep a dead feed looking healthy.
    last_seen_at: new Date().toISOString(),
  }
}

/**
 * Combine the parsed program variant and template into the stored class format.
 *
 * `parseBookingTitle('Orange HYROX 60 Min 2G')` splits into
 * `program: 'HYROX'` and `format: '2G'`. Storing the bare `'2G'` would render
 * the HYROX class identically to an ordinary 2G and make one filter chip cover
 * both — template mixing under a single label, which is the exact defect #453
 * exists to remove. `'HYROX 2G'` is also the value the migration comment,
 * `types/otf.ts`, and `lib/training-facility/otf.ts` all document.
 *
 * The `program` column keeps the part separately for anyone who wants to group
 * across variants; this is the display/grouping key.
 *
 * @param {string|null} program Parsed program variant, or null.
 * @param {string|null} format Parsed template, or null.
 * @returns {string|null} Combined format, or null when the title didn't parse.
 */
export function composeClassFormat(program, format) {
  if (format == null) return null
  return program ? `${program} ${format}` : format
}

/**
 * Upsert calendar events into `otf_bookings`, keyed on `external_event_id`.
 *
 * Unlike the session import this *is* a full upsert: a booking row has no
 * hand-edited columns, so re-reading a corrected calendar event should update
 * the stored row rather than be ignored. `external_event_id` makes that
 * idempotent — re-running over the same feed rewrites identical values.
 *
 * Non-OTF events are filtered out by {@link isOtfBookingTitle} and counted, not
 * silently dropped: the source is the shared "Home" calendar, so other events
 * are expected, but a sudden jump in the skipped count is how a title-format
 * change would announce itself.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {import('./otf-calendar.mjs').CalendarEvent[]} events Normalized events.
 * @returns {Promise<{ written: number, notOtf: number, unparsedTitles: string[] }>}
 *   `written` = OTF booking rows upserted, `notOtf` = events skipped as
 *   belonging to something else, `unparsedTitles` = OTF titles stored with null
 *   parsed columns (worth logging; not an error).
 * @throws {Error} on any Supabase write failure.
 */
export async function upsertOtfBookings(supabase, events) {
  const otfEvents = events.filter(e => isOtfBookingTitle(e.titleRaw))
  const notOtf = events.length - otfEvents.length

  // Dedupe within the batch — a feed shouldn't carry two copies of one UID,
  // but Postgres rejects an upsert whose payload conflicts with itself.
  const byId = new Map()
  for (const event of otfEvents) {
    byId.set(event.externalEventId, eventToBookingRow(event))
  }
  const rows = [...byId.values()]
  const unparsedTitles = rows.filter(r => r.format == null).map(r => String(r.title_raw))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('otf_bookings')
      .upsert(rows, { onConflict: 'external_event_id' })
    if (error) {
      throw new Error(`Failed to upsert otf_bookings: ${error.message}`)
    }
  }

  return { written: rows.length, notOtf, unparsedTitles }
}

/**
 * Pick the booking that best matches a session, or null.
 *
 * Studio is part of the key, not an afterthought: at least three locations are
 * in play (Marina Del Rey, Playa Vista, Mar Vista) and two studios can run a
 * class at the same clock time. When several bookings fall inside the tolerance
 * window the nearest in time wins, so a widened window degrades gracefully
 * instead of picking arbitrarily.
 *
 * A session with no studio matches nothing — guessing across locations is
 * exactly the kind of plausible-but-wrong labelling #453 exists to eliminate.
 *
 * Known and accepted: nothing stops two sessions from claiming the same
 * booking, since candidates aren't consumed as they're matched. That needs two
 * sessions within the tolerance window at one studio, i.e. two classes under
 * half an hour apart at the same location — not a schedule OTF runs. Guarding
 * it would cost more complexity than the case is worth; revisit if a session
 * ever turns up sharing a `booking_id`.
 *
 * @param {{ started_at: string, studio: string|null }} session Session row.
 * @param {Array<{ id: string, starts_at: string, studio: string|null, format: string|null }>} bookings Candidate bookings.
 * @param {number} toleranceMs Half-width of the match window, milliseconds.
 * @returns {{ id: string, starts_at: string, studio: string|null, format: string|null }|null} Best match, or null.
 */
export function findMatchingBooking(session, bookings, toleranceMs) {
  if (session.studio == null) return null
  const at = new Date(session.started_at).getTime()

  let best = null
  let bestDelta = Infinity
  for (const booking of bookings) {
    if (!studiosMatch(session.studio, booking.studio)) continue
    const delta = Math.abs(new Date(booking.starts_at).getTime() - at)
    if (delta > toleranceMs) continue
    // Strict `<` keeps the first of an exact tie, which would otherwise be
    // decided by PostgREST's physical row order. Ties are far less reachable
    // now that cancelled events are dropped at the reader, but when one does
    // happen this at least makes the outcome depend on the read's ordering
    // rather than on nothing at all.
    if (delta < bestDelta) {
      best = booking
      bestDelta = delta
    }
  }
  return best
}

/**
 * Match sessions to bookings and resolve `class_format`.
 *
 * Write discipline, mirroring the narrow backfill in `upsertOtfSessions`:
 * - **Never** touches a row whose `class_format_source` is `'manual'`. A
 *   hand-entered label for a drop-in outranks anything this pass could infer.
 * - Sets `booking_id` only where it is currently null.
 * - Keeps `class_format` in sync with the matched booking whenever the booking
 *   owns it (`class_format_source` is `'booking'`, or the format is still
 *   null) — including *correcting* a value that has since changed. A booking
 *   whose title didn't parse still links (`booking_id`) but leaves the format
 *   null rather than writing a placeholder.
 * - Targeted per-row `update` of just those columns — never a full-row upsert,
 *   which would `DO UPDATE SET` every column and undo the guarantee above.
 *
 * Re-syncing rather than writing once matters because `upsertOtfBookings`
 * refreshes `otf_bookings.format` from the calendar on every run: a write-once
 * guard would let the booking and the session disagree permanently after a
 * title is corrected in place. Writes are still skipped when the value already
 * matches, so re-running remains a no-op.
 *
 * That also gives the pass a self-heal: a booking stored before its title could
 * be parsed picks up its format on a later run once the grammar handles it,
 * with no migration. Append-only writes alone cannot self-heal — that is what
 * left three sessions with a null `class_type` for 20 days (#334).
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {{ toleranceMinutes?: number }} [opts] Match window override.
 * @returns {Promise<{ linked: number, formatted: number, unmatched: number, manual: number }>}
 *   `linked` = sessions newly given a `booking_id`, `formatted` = sessions newly
 *   given a `class_format`, `unmatched` = unresolved sessions with no booking in
 *   range, `manual` = sessions left alone because a human owns them.
 * @throws {Error} on any Supabase read/write failure.
 */
export async function reconcileOtfBookings(supabase, opts = {}) {
  const toleranceMs = (opts.toleranceMinutes ?? DEFAULT_MATCH_TOLERANCE_MIN) * 60_000

  // Ordered on the unique keys, not on time: `starts_at` is not unique (two
  // studios can run a class at the same instant) and would make paging drop
  // rows. `otf_sessions.started_at` is the table's primary key, so it already
  // qualifies.
  const bookings = await readAll(
    supabase,
    'otf_bookings',
    'id, starts_at, studio, format',
    'external_event_id'
  )
  const sessions = await readAll(
    supabase,
    'otf_sessions',
    'started_at, studio, booking_id, class_format, class_format_source',
    'started_at'
  )
  const bookingsById = new Map(bookings.map(b => [b.id, b]))

  let linked = 0
  let formatted = 0
  let unmatched = 0
  let manual = 0

  for (const session of sessions) {
    if (session.class_format_source === 'manual') {
      manual += 1
      continue
    }

    // Already linked: the only thing left to do is pick up a format that the
    // booking has since acquired.
    const booking =
      session.booking_id != null
        ? (bookingsById.get(session.booking_id) ?? null)
        : findMatchingBooking(session, bookings, toleranceMs)

    if (!booking) {
      if (session.booking_id == null) unmatched += 1
      continue
    }

    /** @type {Record<string, unknown>} */
    const patch = {}
    if (session.booking_id == null) patch.booking_id = booking.id

    // Re-sync, not write-once. `upsertOtfBookings` deliberately refreshes
    // `otf_bookings.format` from the calendar on every run, so a write-once
    // guard here would let the two tables disagree forever: correct a title in
    // place (same UID) from 3G to 2G and the session would keep rendering '3G'
    // with a tooltip claiming the booking says so. Manual rows never reach this
    // point — they `continue` above — and the equality check keeps re-runs
    // idempotent.
    const bookingOwnsFormat =
      session.class_format == null || session.class_format_source === 'booking'
    if (bookingOwnsFormat && booking.format != null && session.class_format !== booking.format) {
      patch.class_format = booking.format
      patch.class_format_source = 'booking'
    }
    if (Object.keys(patch).length === 0) continue

    const { error } = await supabase
      .from('otf_sessions')
      .update(patch)
      .eq('started_at', session.started_at)
    if (error) {
      throw new Error(
        `Failed to reconcile otf_session ${session.started_at}: ${error.message}`
      )
    }
    if (patch.booking_id !== undefined) linked += 1
    if (patch.class_format !== undefined) formatted += 1
  }

  return { linked, formatted, unmatched, manual }
}

/**
 * Counted sessions carrying no `class_format` — the *reportable* coverage gap.
 *
 * Deliberately NOT a gate. Roughly 9% of sessions are legitimate drop-ins
 * booked outside the app flow (2026-08-06 at Mar Vista is one), and #453 leaves
 * those null on purpose rather than guessing once recall has faded. Failing the
 * job on them would keep it permanently red, which trains everyone to ignore
 * the gate that *does* mean something — the same way a real problem went
 * unnoticed for 20 days (#334). Print these; never exit non-zero for them.
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @returns {Promise<Array<{ started_at: string, studio: string|null }>>}
 *   Offending rows, oldest first.
 * @throws {Error} on any Supabase read failure.
 */
export async function findSessionsMissingClassFormat(supabase) {
  const { data, error } = await supabase
    .from('otf_sessions')
    .select('started_at, studio')
    .eq('excluded', false)
    .is('class_format', null)
    .order('started_at', { ascending: true })
  if (error) {
    throw new Error(`Failed to check otf_sessions class_format coverage: ${error.message}`)
  }
  return data ?? []
}

/**
 * Detect a silent booking feed: sessions are still arriving, but no booking has
 * been ingested in the same window.
 *
 * This is the gate that catches a *working* pull reading the wrong or an empty
 * calendar — the case an auth check alone misses entirely, because auth can
 * succeed and return zero events. Cross-referencing against sessions is what
 * separates "the feed is broken" from "no classes were booked", which are
 * indistinguishable from the booking count alone.
 *
 * Motivating failure: resetting the Apple Account password revokes every
 * app-specific password automatically. CalDAV then fails while the OTbeat email
 * pull keeps working, so sessions keep arriving and quietly stop getting a
 * `class_format`.
 *
 * **Liveness is measured on `last_seen_at`, not `starts_at`.** Counting by class
 * time would include future bookings a healthy earlier run already stored, so
 * the gate would report green for as long as the calendar reaches ahead — which
 * is precisely the window it exists to cover, since a password reset typically
 * follows a successful pull. `last_seen_at` is rewritten by every upsert (unlike
 * `ingested_at`, which records only the first sighting), so it answers "did the
 * feed produce anything recently" rather than "do we hold any future classes".
 *
 * @param {ReturnType<createServiceRoleClient>} supabase Service-role client.
 * @param {{ windowDays?: number, now?: Date }} [opts] Window override; `now` is
 *   injectable so tests don't depend on the wall clock.
 * @returns {Promise<{ silent: boolean, sessionCount: number, bookingCount: number, since: string }>}
 *   `silent` is true only when sessions arrived and no booking was seen.
 * @throws {Error} on any Supabase read failure.
 */
export async function findBookingFeedSilence(supabase, opts = {}) {
  const windowDays = opts.windowDays ?? DEFAULT_SILENCE_WINDOW_DAYS
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString()

  const { count: sessionCount, error: sessionErr } = await supabase
    .from('otf_sessions')
    .select('started_at', { count: 'exact', head: true })
    .gte('started_at', since)
  if (sessionErr) {
    throw new Error(`Failed to count recent otf_sessions: ${sessionErr.message}`)
  }

  const { count: bookingCount, error: bookingErr } = await supabase
    .from('otf_bookings')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen_at', since)
  if (bookingErr) {
    throw new Error(`Failed to count recent otf_bookings: ${bookingErr.message}`)
  }

  const sessions = sessionCount ?? 0
  const bookings = bookingCount ?? 0
  return { silent: sessions > 0 && bookings === 0, sessionCount: sessions, bookingCount: bookings, since }
}
