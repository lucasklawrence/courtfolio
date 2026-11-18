/**
 * Supabase write path for the events importer (#502).
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

import { eventMatchKey, inferCategory } from './events-parser.mjs'
import { createServiceRoleClient, loadEnv, wallTimeToISO } from './otbeat-supabase.mjs'

export { createServiceRoleClient, loadEnv }

/** Zone for a wall-clock time when the email names no state, and for states not listed. */
export const DEFAULT_EVENT_TZ = 'America/Los_Angeles'

const STATE_TZ = {
  AZ: 'America/Phoenix',
  CO: 'America/Denver',
  ID: 'America/Boise',
  MT: 'America/Denver',
  NM: 'America/Denver',
  UT: 'America/Denver',
  WY: 'America/Denver',
  TX: 'America/Chicago',
  IL: 'America/Chicago',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  LA: 'America/New_Orleans',
  TN: 'America/Chicago',
  WI: 'America/Chicago',
  NY: 'America/New_York',
  NJ: 'America/New_York',
  MA: 'America/New_York',
  PA: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  DC: 'America/New_York',
  HI: 'Pacific/Honolulu',
  AK: 'America/Anchorage',
}

/**
 * The IANA zone a venue's wall-clock times are in, from its state. Pacific
 * states and anything unlisted fall back to {@link DEFAULT_EVENT_TZ}.
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
 */

/**
 * A new `events` row as the importer writes it.
 * @typedef {Object} EventInsertRow
 * @property {string} match_key See `eventMatchKey`.
 * @property {string} title
 * @property {'sports'|'other'} category Inferred; the owner refines it by override.
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
 * @property {Array<{ id: string, changes: Record<string, string> }>} updates
 *   Existing events to fill in (empty fields only) or re-key.
 * @property {Array<{ row: EventEmailRow, eventKey: string|null }>} emails One
 *   `event_emails` row per item; `eventKey` is the match key of its event, or
 *   null for an email that matches none.
 */

/** Kinds that never attach to an event: no reliable event details. */
const UNMATCHABLE = new Set(['notice', 'unrecognized'])

/**
 * Decide which event each email belongs to.
 *
 * An email joins the event with its match key (local date + venue). Two
 * fallbacks bridge emails that name no venue: a title-keyed email joins the
 * only event already on its date, and a venue-keyed email adopts a lone
 * title-keyed event on its date (re-keying it), whichever arrived first.
 * Anything else that has a key starts a new event; an email with no key is
 * stored unmatched for review.
 *
 * @param {EventEmailItem[]} items
 * @param {StoredEvent[]} existing Events already stored near these dates.
 * @returns {EventLinkPlan}
 */
export function planEventLinks(items, existing) {
  const byKey = new Map()
  const byDate = new Map()
  const index = ev => {
    byKey.set(ev.match_key, ev)
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
    const key = UNMATCHABLE.has(p.kind) ? null : eventMatchKey(p)
    if (!key) {
      emails.push({ row: emailRow(item), event: null })
      continue
    }
    const date = key.slice(0, 10)
    const sameDay = byDate.get(date) ?? []
    let ev = byKey.get(key)
    if (!ev && sameDay.length === 1) {
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
    if (!ev) {
      ev = newEvent(p, key)
      inserts.set(key, ev)
      index(ev)
    }
    const fill = {}
    for (const field of ['title', 'venue', 'city', 'state']) {
      if (ev[field] == null && p[field] != null) {
        ev[field] = p[field]
        fill[field] = p[field]
      }
    }
    if (Object.keys(fill).length && !inserts.has(ev.match_key)) recordUpdate(updates, ev, fill)
    // The event, not its key: a later email may re-key it.
    emails.push({ row: emailRow(item), event: ev })
  }

  return {
    inserts: [...inserts.values()],
    updates: [...updates.values()],
    emails: emails.map(({ row, event }) => ({ row, eventKey: event?.match_key ?? null })),
  }
}

function recordUpdate(updates, ev, changes) {
  if (!ev.id) return
  const prior = updates.get(ev.id) ?? { id: ev.id, changes: {} }
  prior.changes = { ...prior.changes, ...changes }
  updates.set(ev.id, prior)
}

/** A new `events` row from the first email that names it. */
function newEvent(p, key) {
  const { category, teams } = inferCategory(p.title)
  const { year, month, day, hour, minute } = p.when
  return {
    match_key: key,
    title: p.title ?? '(untitled event)',
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
    ticket_count: p.ticketCount,
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
  const plan = planEventLinks(items, existing)

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

  const rows = plan.emails.map(({ row, eventKey }) => ({
    ...row,
    event_id: eventKey ? (idByKey.get(eventKey) ?? null) : null,
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

/** Events whose start is within two days of any email's event date, for the planner's same-day fallbacks. */
async function loadEventsNear(supabase, items) {
  const times = items
    .map(i => i.parsed.when)
    .filter(Boolean)
    .map(w => Date.UTC(w.year, w.month - 1, w.day))
  if (times.length === 0) return []
  const day = 24 * 3600 * 1000
  const from = new Date(Math.min(...times) - 2 * day).toISOString()
  const to = new Date(Math.max(...times) + 3 * day).toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('id, match_key, title, venue, city, state')
    .gte('starts_at', from)
    .lt('starts_at', to)
  if (error) throw new Error(`events read failed: ${error.message}`)
  return data ?? []
}

async function countReview(supabase) {
  const { count, error } = await supabase
    .from('event_emails_review')
    .select('gmail_message_id', { count: 'exact', head: true })
  if (error) throw new Error(`review count failed: ${error.message}`)
  return count ?? 0
}
