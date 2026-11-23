/**
 * Supabase write path for the events importer.
 *
 * Split in two so the matching rules can be tested without a database:
 * {@link planEventLinks} is pure — given parsed emails and the events already
 * stored around their dates, it decides which events to create or fill in and
 * which event each email belongs to — and {@link upsertEventEmails} carries
 * that plan out against Supabase.
 *
 * Upsert-only, never prunes: re-reading mail updates each email's parsed
 * fields (keyed by Gmail message id) and adds nothing. The importer never
 * writes `events.manual_override`, and only fills an event's title or venue
 * when it is still empty, so the owner's corrections survive every run.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 */

import { eventMatchKey, foldAccents, inferCategory, normalizeForMatch } from './events-parser.mjs'
import { createServiceRoleClient, loadEnv, wallTimeToISO } from './otbeat-supabase.mjs'

export { createServiceRoleClient, loadEnv }

/** Zone for a wall-clock time when the email names no state, and for states not listed. */
export const DEFAULT_EVENT_TZ = 'America/Los_Angeles'

const ZONE_STATES = {
  'America/New_York': 'CT DC DE FL GA IN KY MA MD ME MI NC NH NJ NY OH PA RI SC VA VT WV',
  'America/Chicago': 'AL AR IA IL KS LA MN MO MS ND NE OK SD TN TX WI',
  'America/Denver': 'CO MT NM UT WY',
  'America/Boise': 'ID',
  'America/Phoenix': 'AZ',
  'America/Los_Angeles': 'CA NV OR WA',
  'America/Anchorage': 'AK',
  'Pacific/Honolulu': 'HI',
}

/** Every state (and DC) by its principal zone; split states take the zone most of their venues are in. */
const STATE_TZ = Object.fromEntries(
  Object.entries(ZONE_STATES).flatMap(([zone, states]) => states.split(' ').map(s => [s, zone]))
)

/**
 * The IANA zone a venue's wall-clock times are in, from its state. An absent
 * or unrecognized state falls back to {@link DEFAULT_EVENT_TZ}.
 *
 * @param {string|null} state Two-letter code.
 * @returns {string}
 */
export function zoneForState(state) {
  return STATE_TZ[String(state ?? '').toUpperCase()] ?? DEFAULT_EVENT_TZ
}

/**
 * One email to store: its Gmail identity plus what the parser read.
 * @typedef {Object} EventEmailItem
 * @property {string} messageId Gmail message id.
 * @property {string} subject
 * @property {Date} receivedAt
 * @property {import('./events-parser.mjs').ParsedEventEmail} parsed
 */

/**
 * The slice of an `events` row the planner needs.
 * @typedef {Object} StoredEvent
 * @property {string} [id] Present for rows already in the database.
 * @property {string} match_key
 * @property {string|null} title
 * @property {string|null} venue
 * @property {string|null} city
 * @property {string|null} state
 * @property {string} starts_at UTC ISO instant.
 */

/**
 * A new `events` row as the importer writes it.
 * @typedef {Object} EventInsertRow
 * @property {string} match_key See `eventMatchKey`.
 * @property {string} title
 * @property {import('./events-parser.mjs').InferredCategory} category Inferred;
 *   the owner refines it by override.
 * @property {string[]|null} teams
 * @property {string} starts_at UTC ISO instant of the venue's wall-clock start.
 * @property {string|null} venue
 * @property {string|null} city
 * @property {string|null} state
 */

/**
 * An `event_emails` row before its `event_id` is resolved.
 * @typedef {Object} EventEmailRow
 * @property {string} gmail_message_id
 * @property {string} platform
 * @property {string} kind
 * @property {string} subject
 * @property {string} received_at UTC ISO instant.
 * @property {string|null} order_ref
 * @property {number|null} ticket_count
 * @property {number|null} cost_total
 * @property {string|null} cost_currency
 * @property {string|null} counterpart
 * @property {number} confidence
 * @property {string|null} note
 */

/**
 * What {@link upsertEventEmails} should write.
 * @typedef {Object} EventLinkPlan
 * @property {EventInsertRow[]} inserts New `events` rows.
 * @property {Array<{ id: string, changes: Record<string, unknown> }>} updates
 *   Existing events to fill in (empty fields only) or re-key.
 * @property {Array<{ row: EventEmailRow, eventKey: string|null, eventId: string|null }>} emails
 *   One `event_emails` row per item. `eventId` is set for an email already
 *   linked (the link is kept); otherwise `eventKey` is the match key of its
 *   event, or null for an email that matches none.
 */

/** Kinds that never attach to an event: no reliable event details. */
const UNMATCHABLE = new Set(['notice', 'unrecognized'])

/**
 * Title of an event whose first email named none. Treated as empty: the next
 * email that carries a title replaces it.
 */
export const UNTITLED = '(untitled event)'

/** How far back an after-the-event email ("How was it?") looks for its event. */
const POST_EVENT_WINDOW_MS = 4 * 24 * 3600 * 1000

/**
 * Decide which event each email belongs to.
 *
 * An email joins the event with its match key (local date + venue). Two
 * fallbacks bridge emails that name no venue: a title-keyed email joins the
 * only event already on its date, and a venue-keyed email adopts a lone
 * title-keyed event on its date (re-keying it), whichever arrived first. Both
 * apply only when the titles share a significant word (or one is unknown),
 * so two different outings on one day stay two events. A venue-keyed email
 * whose venue is spelled differently from the event's (one contains the
 * other, or the titles are the same) joins the only such event that day. An
 * after-the-event email carries no date at all, so it joins the event that
 * started in the days before it arrived: the one with its title, or the only
 * one. Anything else that has a key starts a new event; an email with no key
 * is stored unmatched for review.
 *
 * An email already linked to an event (`linked`) keeps that link — it may be
 * the owner's fix to a review-list row — and is not re-planned.
 *
 * @param {EventEmailItem[]} items
 * @param {StoredEvent[]} existing Events already stored near these dates.
 * @param {Map<string, string>} [linked] Gmail message id → stored event id,
 *   for emails already linked.
 * @returns {EventLinkPlan}
 */
export function planEventLinks(items, existing, linked = new Map()) {
  const byKey = new Map()
  const byDate = new Map()
  const all = new Set()
  const index = ev => {
    byKey.set(ev.match_key, ev)
    all.add(ev)
    const date = ev.match_key.slice(0, 10)
    byDate.set(date, [...(byDate.get(date) ?? []).filter(e => e !== ev), ev])
  }
  for (const ev of existing) index({ ...ev })

  const inserts = new Map()
  const updates = new Map()
  const emails = []
  const sorted = [...items].sort((a, b) => a.receivedAt - b.receivedAt)

  for (const item of sorted) {
    const p = item.parsed
    if (linked.has(item.messageId)) {
      emails.push({ row: emailRow(item), event: null, eventId: linked.get(item.messageId) })
      continue
    }
    if (p.kind === 'post_event' && !p.when) {
      emails.push({ row: emailRow(item), event: eventBefore(all, item) })
      continue
    }
    const key = UNMATCHABLE.has(p.kind) ? null : eventMatchKey(p)
    if (!key) {
      emails.push({ row: emailRow(item), event: null })
      continue
    }
    const date = key.slice(0, 10)
    const sameDay = byDate.get(date) ?? []
    let ev = byKey.get(key)
    if (!ev && sameDay.length === 1 && titlesMayMatch(sameDay[0].title, p.title)) {
      const only = sameDay[0]
      if (key.includes('|t:')) {
        ev = only
      } else if (only.match_key.includes('|t:')) {
        // A venue-named email adopts the title-keyed event created before any
        // email named the venue: re-key it so later emails match directly.
        byKey.delete(only.match_key)
        if (inserts.has(only.match_key)) {
          inserts.delete(only.match_key)
          only.match_key = key
          inserts.set(key, only)
        } else {
          only.match_key = key
          recordUpdate(updates, only, { match_key: key })
        }
        index(only)
        ev = only
      }
    }
    if (!ev && key.includes('|v:')) ev = venueVariant(sameDay, key, p.title)
    if (!ev) {
      ev = newEvent(p, key)
      inserts.set(key, ev)
      index(ev)
    }
    const fill = fillEmpty(ev, p)
    if (Object.keys(fill).length && !inserts.has(ev.match_key)) recordUpdate(updates, ev, fill)
    // The event, not its key: a later email may re-key it.
    emails.push({ row: emailRow(item), event: ev })
  }

  return {
    inserts: [...inserts.values()],
    updates: [...updates.values()],
    emails: emails.map(({ row, event, eventId }) => ({
      row,
      eventKey: event?.match_key ?? null,
      eventId: eventId ?? null,
    })),
  }
}

/** Shortest normalized venue that may match another by containment. */
const MIN_VENUE_CONTAINMENT = 6

/**
 * The one venue-keyed event on this date that is the same outing under
 * another spelling of the venue: one platform writes "Harbor City Arena", the
 * other "Harbor City Arena - Bayside" or a truncated "Harbor City Are". It
 * matches when one normalized venue contains the other, or when the titles
 * are the same. Null when none or several do — a guess between two events is
 * worse than a duplicate the owner can merge.
 *
 * @param {StoredEvent[]} sameDay Events already on the email's date.
 * @param {string} key The email's venue match key.
 * @param {string|null} title The email's title.
 * @returns {StoredEvent|null}
 */
function venueVariant(sameDay, key, title) {
  const venue = key.split('|v:')[1] ?? ''
  const t = normalizeForMatch(title)
  const hits = sameDay.filter(e => {
    const other = e.match_key.split('|v:')[1]
    if (!other) return false
    const [short, long] = other.length <= venue.length ? [other, venue] : [venue, other]
    const contains = short.length >= MIN_VENUE_CONTAINMENT && long.includes(short)
    const sameTitle = t.length > 0 && normalizeForMatch(e.title) === t
    return contains || sameTitle
  })
  return hits.length === 1 ? hits[0] : null
}

/**
 * Fill an event's empty fields from an email, in place, and return what
 * changed. A placeholder title counts as empty and brings the category and
 * teams with it; a newly known state moves `starts_at` into that state's zone,
 * since it was first computed in the default one.
 */
function fillEmpty(ev, p) {
  const fill = {}
  if ((ev.title == null || ev.title === UNTITLED) && p.title) {
    const { category, teams } = inferCategory(p.title, p.venue ?? ev.venue)
    Object.assign(fill, { title: p.title, category, teams })
  }
  for (const field of ['venue', 'city', 'state']) {
    if (ev[field] == null && p[field] != null) fill[field] = p[field]
  }
  if (fill.state && p.when) {
    const { year, month, day, hour, minute } = p.when
    fill.starts_at = wallTimeToISO(year, month, day, hour, minute, zoneForState(fill.state))
  }
  Object.assign(ev, fill)
  return fill
}

/**
 * The event an after-the-event email is about: started within the few days
 * before the email arrived, and matched by title, or the only candidate whose
 * title could be the same outing. Null rather than a guess between several —
 * and null for an email whose title names something else entirely ("How was
 * your weekend?"), which would otherwise mark that week's only event attended.
 */
function eventBefore(events, item) {
  const received = item.receivedAt.getTime()
  const recent = [...events].filter(e => {
    const start = Date.parse(e.starts_at)
    return start <= received && received - start <= POST_EVENT_WINDOW_MS
  })
  const title = normalizeForMatch(item.parsed.title)
  const byTitle = title ? recent.filter(e => normalizeForMatch(e.title) === title) : []
  if (byTitle.length === 1) return byTitle[0]
  const plausible = recent.filter(e => titlesMayMatch(e.title, item.parsed.title))
  return plausible.length === 1 ? plausible[0] : null
}

/** Words too common in event titles to say two titles name the same outing. */
const TITLE_STOPWORDS = new Set([
  'the',
  'and',
  'at',
  'vs',
  'of',
  'for',
  'with',
  'tickets',
  'ticket',
  'night',
  'live',
  'tour',
  'show',
  'game',
])

function titleWords(title) {
  return foldAccents(title)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !TITLE_STOPWORDS.has(w))
}

/**
 * Whether two titles could name the same outing, for the same-day fallbacks:
 * yes when either is unknown, otherwise only when they share a significant
 * word. Platforms title one game differently ("Rockets @ Hawks", "Harbor City
 * Hawks vs. Riverside Rockets") but never without a word in common, while a
 * concert and a game on one day share none.
 */
function titlesMayMatch(a, b) {
  if (!a || a === UNTITLED || !b) return true
  const left = new Set(titleWords(a))
  return titleWords(b).some(w => left.has(w))
}

function recordUpdate(updates, ev, changes) {
  if (!ev.id) return
  const prior = updates.get(ev.id) ?? { id: ev.id, changes: {} }
  prior.changes = { ...prior.changes, ...changes }
  updates.set(ev.id, prior)
}

/** A new `events` row from the first email that names it. */
function newEvent(p, key) {
  const { category, teams } = inferCategory(p.title, p.venue)
  const { year, month, day, hour, minute } = p.when
  return {
    match_key: key,
    title: p.title ?? UNTITLED,
    category,
    teams,
    starts_at: wallTimeToISO(year, month, day, hour, minute, zoneForState(p.state)),
    venue: p.venue,
    city: p.city,
    state: p.state,
  }
}

/** The `event_emails` row for an item; `event_id` is resolved by the caller. */
function emailRow(item) {
  const p = item.parsed
  return {
    gmail_message_id: item.messageId,
    platform: p.platform,
    kind: p.kind,
    subject: item.subject,
    received_at: item.receivedAt.toISOString(),
    order_ref: p.orderRef,
    // The column only accepts a positive count; a parsed 0 ("0 Tickets") is
    // no count at all, and must not fail the whole chunk's upsert.
    ticket_count: p.ticketCount > 0 ? p.ticketCount : null,
    cost_total: p.costTotal,
    cost_currency: p.costCurrency,
    counterpart: p.counterpart,
    confidence: p.confidence,
    note: p.note,
  }
}

/**
 * Summary of one write, for the run log. Counts only: the Actions log is
 * public, so no titles, names or amounts.
 * @typedef {Object} EventUpsertSummary
 * @property {number} emails Emails written (inserted or refreshed).
 * @property {number} matched Of those, linked to an event.
 * @property {number} newEvents Events created.
 * @property {number} filledEvents Existing events filled in or re-keyed.
 * @property {number} needsReview Rows in `event_emails_review` after the write.
 */

/**
 * Store parsed emails: create and fill in events per {@link planEventLinks},
 * then upsert one `event_emails` row per email.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {EventEmailItem[]} items
 * @returns {Promise<EventUpsertSummary>}
 * @throws {Error} on any Supabase error.
 */
export async function upsertEventEmails(supabase, items) {
  if (items.length === 0) {
    return {
      emails: 0,
      matched: 0,
      newEvents: 0,
      filledEvents: 0,
      needsReview: await countReview(supabase),
    }
  }
  const existing = await loadEventsNear(supabase, items)
  const plan = planEventLinks(items, existing, await loadLinks(supabase, items))

  if (plan.inserts.length) {
    const { error } = await supabase
      .from('events')
      .upsert(plan.inserts, { onConflict: 'match_key', ignoreDuplicates: true })
    if (error) throw new Error(`events insert failed: ${error.message}`)
  }
  for (const { id, changes } of plan.updates) {
    const { error } = await supabase
      .from('events')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(`events update failed: ${error.message}`)
  }

  const keys = [...new Set(plan.emails.map(e => e.eventKey).filter(Boolean))]
  const idByKey = new Map()
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabase
      .from('events')
      .select('id, match_key')
      .in('match_key', keys.slice(i, i + 100))
    if (error) throw new Error(`events lookup failed: ${error.message}`)
    for (const r of data ?? []) idByKey.set(r.match_key, r.id)
  }

  const rows = plan.emails.map(({ row, eventKey, eventId }) => ({
    ...row,
    event_id: eventId ?? (eventKey ? (idByKey.get(eventKey) ?? null) : null),
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('event_emails')
      .upsert(rows.slice(i, i + 200), { onConflict: 'gmail_message_id' })
    if (error) throw new Error(`event_emails upsert failed: ${error.message}`)
  }

  return {
    emails: rows.length,
    matched: rows.filter(r => r.event_id).length,
    newEvents: plan.inserts.length,
    filledEvents: plan.updates.length,
    needsReview: await countReview(supabase),
  }
}

/** Rows per page when reading events; PostgREST caps an unpaged select at 1,000. */
export const EVENTS_PAGE_SIZE = 1000

/**
 * Events near the batch, for the planner's fallbacks: within two days of any
 * email's event date, and within the after-the-event window before any
 * dateless email arrived.
 *
 * Read in pages. A multi-year backfill's window covers every stored event,
 * and one unpaged select stops silently at PostgREST's row cap, after which
 * the planner misses events and creates duplicates.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {EventEmailItem[]} items
 * @param {number} [pageSize]
 * @returns {Promise<StoredEvent[]>}
 * @throws {Error} on any Supabase error.
 */
export async function loadEventsNear(supabase, items, pageSize = EVENTS_PAGE_SIZE) {
  const day = 24 * 3600 * 1000
  const times = items.flatMap(i => {
    const w = i.parsed.when
    if (w) return [Date.UTC(w.year, w.month - 1, w.day)]
    return [i.receivedAt.getTime(), i.receivedAt.getTime() - POST_EVENT_WINDOW_MS]
  })
  if (times.length === 0) return []
  const from = new Date(Math.min(...times) - 2 * day).toISOString()
  const to = new Date(Math.max(...times) + 3 * day).toISOString()
  const events = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('events')
      .select('id, match_key, title, venue, city, state, starts_at')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('id')
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`events read failed: ${error.message}`)
    events.push(...(data ?? []))
    if ((data ?? []).length < pageSize) return events
  }
}

/**
 * Which of these Gmail message ids are already stored in `event_emails`, so a
 * resumed backfill can skip fetching them (`--skip-stored`).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} ids Gmail message ids.
 * @returns {Promise<Set<string>>}
 * @throws {Error} on any Supabase error.
 */
export async function loadStoredMessageIds(supabase, ids) {
  const stored = new Set()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('event_emails')
      .select('gmail_message_id')
      .in('gmail_message_id', ids.slice(i, i + 100))
    if (error) throw new Error(`event_emails read failed: ${error.message}`)
    for (const r of data ?? []) stored.add(r.gmail_message_id)
  }
  return stored
}

/** Emails in the batch already linked to an event, so a re-read keeps the link. */
async function loadLinks(supabase, items) {
  const links = new Map()
  const ids = items.map(i => i.messageId)
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('event_emails')
      .select('gmail_message_id, event_id')
      .in('gmail_message_id', ids.slice(i, i + 100))
      .not('event_id', 'is', null)
    if (error) throw new Error(`event_emails read failed: ${error.message}`)
    for (const r of data ?? []) links.set(r.gmail_message_id, r.event_id)
  }
  return links
}

async function countReview(supabase) {
  const { count, error } = await supabase
    .from('event_emails_review')
    .select('gmail_message_id', { count: 'exact', head: true })
  if (error) throw new Error(`review count failed: ${error.message}`)
  return count ?? 0
}
