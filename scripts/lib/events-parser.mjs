/**
 * Parser for ticket-platform emails: Gametime, Ticketmaster and
 * Eventbrite. Turns one email (sender, subject, HTML body) into a
 * {@link ParsedEventEmail} — what kind of email it is and what it says about
 * the event — for `scripts/import-events.mjs` to store.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step, the same
 * constraint as `otbeat-parser.mjs`.
 *
 * Design notes:
 * - **One email is evidence, not an event.** A single outing can produce a
 *   Gametime receipt, a Ticketmaster transfer (Gametime delivers
 *   venue-restricted tickets that way) and a reminder. The parser reports what
 *   each email says; matching emails to one event is the importer's job
 *   ({@link eventMatchKey}), and the event's status is derived when read, in
 *   the `events_with_status` view.
 * - **HTML only.** Ticketmaster's text/plain part is the single word
 *   "Ticketmaster", so every platform is parsed from its HTML, flattened by
 *   {@link cleanEmailText}. Block boundaries survive as `¶` because Gametime
 *   puts the venue and the city in separate cells with nothing between them.
 * - **No guessing.** A field the email doesn't carry stays null, and an email
 *   the parser can't read is still returned (kind `unrecognized`, confidence
 *   0) so the importer can store it for review instead of dropping it.
 * - **Dates are wall-clock, in the venue's zone.** Several layouts omit the
 *   year ("Sat, Mar 14 @ 6:40 PM"); {@link resolveEventDate} supplies it from
 *   the email's own date.
 */

/** Block separator {@link cleanEmailText} leaves between HTML blocks. */
export const BLOCK = '¶'

const NAMED_ENTITIES = {
  amp: '&',
  nbsp: ' ',
  bull: '•',
  middot: '·',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  hellip: '…',
  zwnj: '',
  zwj: '',
}

/**
 * Flatten an email's HTML to one line of text, keeping block boundaries.
 *
 * Drops `<head>`, `<style>`, `<script>` and comments; turns block-level tags
 * (cells, rows, paragraphs, divs, headings, `<br>`) into ` ¶ ` and every other
 * tag into a space; decodes numeric and the common named entities; strips the
 * invisible characters preheaders are padded with; and collapses repeated
 * separators.
 *
 * @param {string} html Raw email HTML.
 * @returns {string} Text with ` ¶ ` between blocks.
 */
export function cleanEmailText(html) {
  return (
    String(html ?? '')
      .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(
        /<\/?(td|th|tr|table|p|div|li|ul|ol|h[1-6]|br|hr|center|section)\b[^>]*>/gi,
        ` ${BLOCK} `
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
      .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
      // Preheader padding: soft hyphen, combining grapheme joiner, zero-widths,
      // figure space, word joiner, BOM.
      .replace(/[­͏​-‏ ⁠﻿]/g, '')
      .replace(CURLY_APOSTROPHES, "'")
      .replace(/\s+/g, ' ')
      .replace(new RegExp(`(?:\\s*${BLOCK}\\s*)+`, 'g'), ` ${BLOCK} `)
      .trim()
  )
}

/**
 * Typographic apostrophes (‘ ’ ʼ). Subjects and bodies write "You’re" as often
 * as "You're", and every rule below is written with the straight one, so both
 * are folded to `'` before any rule runs.
 */
const CURLY_APOSTROPHES = /[‘’ʼ]/g

/** `String.fromCodePoint` that returns '' for an out-of-range code point instead of throwing. */
function safeCodePoint(n) {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
}

/**
 * The kinds of email the importer understands.
 *
 * - `purchase`: an order confirmation (cost and ticket count when shown).
 * - `transfer_in`: someone sent me tickets — a friend, or a reseller's seller
 *   delivering an order bought elsewhere.
 * - `transfer_out`: I sent or assigned tickets to someone.
 * - `fulfilment`: tickets for an order are ready (a reseller's delivery notice).
 * - `reminder`: an event reminder; one received on the event's own day is an
 *   attendance signal.
 * - `post_event`: an after-the-event email ("How was it?") — attendance signal.
 * - `notice`: an order notice with no reliable event details (e.g. a failed
 *   fulfilment); stored for review, never matched to an event.
 * - `unrecognized`: from a transactional sender, but no rule matched.
 * @typedef {'purchase'|'transfer_in'|'transfer_out'|'fulfilment'|'reminder'|'post_event'|'notice'|'unrecognized'} EventEmailKind
 */

/**
 * A ticket platform the importer reads, with the senders it queries and the
 * subject rules that classify its email.
 * @typedef {Object} EventPlatform
 * @property {string} id Stable platform id stored on each row.
 * @property {string[]} senders Sender addresses whose mail is transactional.
 *   Marketing senders on the same domain are deliberately absent.
 * @property {string} [extraQuery] An extra Gmail clause for mail from a
 *   marketing sender that is still useful (e.g. Ticketmaster's reminders).
 * @property {Array<[RegExp, EventEmailKind]>} rules Subject rules, first match wins.
 */

/** @type {EventPlatform[]} */
export const PLATFORMS = [
  {
    id: 'gametime',
    senders: ['receipts@e.gametime.co'],
    rules: [
      [/^your ticket order\b/i, 'purchase'],
      [/your ticket transfer\b/i, 'fulfilment'],
      [/replacement options|couldn'?t be fulfilled/i, 'notice'],
    ],
  },
  {
    id: 'ticketmaster',
    senders: ['customer_support@email.ticketmaster.com', 'noreply@ticketmaster.com'],
    extraQuery: 'from:newsletter@email.ticketmaster.com subject:"Event Reminder"',
    rules: [
      [/^you got tickets to\b/i, 'purchase'],
      [/\byou(?:'ve| have) (?:transferred|assigned|sent)\b/i, 'transfer_out'],
      [/\bsent you\b.*\bticket/i, 'transfer_in'],
      [/^you'?re all set to see\b/i, 'transfer_in'],
      [/^event reminder\b|\btoday:|^reminder\b/i, 'reminder'],
      [/view and save your tickets/i, 'fulfilment'],
    ],
  },
  {
    id: 'eventbrite',
    senders: ['noreply@order.eventbrite.com'],
    extraQuery: 'from:eventbrite.com subject:"how was"',
    rules: [
      [/^order confirmation for\b/i, 'purchase'],
      [/\bhow was\b/i, 'post_event'],
      [/\breminder\b|\bstarts (?:soon|tomorrow|today)\b/i, 'reminder'],
    ],
  },
]

/**
 * The Gmail query for one platform: its transactional senders, plus its extra
 * clause (e.g. reminders from a newsletter sender), inside the lookback window.
 *
 * @param {EventPlatform} platform
 * @param {number} lookbackDays
 * @returns {string}
 */
export function platformQuery(platform, lookbackDays) {
  const clauses = platform.senders.map(s => `from:${s}`)
  if (platform.extraQuery) clauses.push(`(${platform.extraQuery})`)
  return `(${clauses.join(' OR ')}) newer_than:${lookbackDays}d`
}

/**
 * The platform a sender belongs to, or null. Matches the exact transactional
 * address first, then any address on the platform's domain (so the
 * `extraQuery` mail — a reminder from a newsletter sender — is still placed).
 *
 * @param {string} from The sender address, bare or as `Name <addr>`.
 * @returns {EventPlatform|null}
 */
export function platformForSender(from) {
  const addr = (String(from ?? '').match(/<([^>]+)>/)?.[1] ?? String(from ?? ''))
    .trim()
    .toLowerCase()
  if (!addr) return null
  const exact = PLATFORMS.find(p => p.senders.includes(addr))
  if (exact) return exact
  const domain = addr.split('@')[1] ?? ''
  return PLATFORMS.find(p => p.senders.some(s => domainOf(s) === registrable(domain))) ?? null
}

/** The registrable domain of an address's host, e.g. `e.gametime.co` → `gametime.co`. */
function domainOf(addr) {
  return registrable(addr.split('@')[1] ?? '')
}

function registrable(host) {
  return host.split('.').slice(-2).join('.')
}

/**
 * Classify an email by its platform's subject rules.
 *
 * @param {EventPlatform} platform
 * @param {string} subject
 * @returns {EventEmailKind}
 */
export function classifyEmail(platform, subject) {
  for (const [re, kind] of platform.rules) {
    if (re.test(subject ?? '')) return kind
  }
  return 'unrecognized'
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAY = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?'
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?'
const SEP = `\\s*(?:[,·•@|\\-–—]|${BLOCK})?\\s*`
/**
 * A weekday-led date with a start time, in every layout seen:
 * "Sat · Jun 6, 2026 · 11:00 AM", "Sat, Mar 14 @ 6:40 PM",
 * "Saturday, March 14, 6:40pm", "Wednesday, November 18, 2026 from 7:00 PM".
 */
const DATE_RE = new RegExp(
  `\\b${WEEKDAY}${SEP}${MONTH}\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?${SEP}(?:from\\s+)?(\\d{1,2}):(\\d{2})\\s*([ap])\\.?m\\b\\.?`,
  'gi'
)

/**
 * A wall-clock event start as the email states it. `year` is null when the
 * layout omits it — see {@link resolveEventDate}.
 * @typedef {Object} WallTime
 * @property {number|null} year Four-digit year, or null when not shown.
 * @property {number} month 1–12.
 * @property {number} day 1–31.
 * @property {number} hour 0–23.
 * @property {number} minute 0–59.
 */

/**
 * The first event date in `text`, skipping deadlines ("Accept by Thu • Sep 3,
 * 2026 • 09:00 PM" precedes the event date in Ticketmaster transfers).
 *
 * @param {string} text Output of {@link cleanEmailText}.
 * @returns {{ when: WallTime, end: number } | null} The date and the index
 *   just past it, so the venue can be read from what follows.
 */
export function findEventDate(text) {
  return findEventDates(text)[0] ?? null
}

/**
 * Text ending in "by" right before a date marks a deadline ("Accept by Thu …"),
 * whether the date follows in the same block, after a colon, or in the next
 * cell.
 */
const DEADLINE_BEFORE = new RegExp(`\\bby\\b[\\s:${BLOCK}]*$`, 'i')

/**
 * Every event date in `text`, in order, deadlines skipped. Layouts repeat the
 * event card (one copy for phones, one for desktop), so the venue may follow
 * the second copy of the date rather than the first.
 *
 * @param {string} text Output of {@link cleanEmailText}.
 * @returns {Array<{ when: WallTime, end: number }>}
 */
export function findEventDates(text) {
  const found = []
  const re = new RegExp(DATE_RE.source, DATE_RE.flags)
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 24), m.index)
    if (DEADLINE_BEFORE.test(before)) continue
    const [, mon, day, year, h, min, ap] = m
    let hour = Number(h) % 12
    if (ap.toLowerCase() === 'p') hour += 12
    const when = {
      year: year ? Number(year) : null,
      month: MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1,
      day: Number(day),
      hour,
      minute: Number(min),
    }
    if (when.day < 1 || when.day > 31 || when.hour > 23 || when.minute > 59) continue
    found.push({ when, end: m.index + m[0].length })
  }
  return found
}

/**
 * Fill in a missing year: the event is the first occurrence of that month and
 * day on or after the day before the email was sent (a ticket email is never
 * about an event more than a day in the past — a same-day purchase can land
 * after a late-evening start in UTC).
 *
 * @param {WallTime} when
 * @param {Date} receivedAt When Gmail received the email.
 * @returns {WallTime} `when` with `year` set.
 */
export function resolveEventDate(when, receivedAt) {
  if (when.year != null) return when
  const floor = new Date(receivedAt.getTime() - 36 * 3600 * 1000)
  let year = floor.getUTCFullYear()
  const asDay = y => Date.UTC(y, when.month - 1, when.day)
  const floorDay = Date.UTC(floor.getUTCFullYear(), floor.getUTCMonth(), floor.getUTCDate())
  if (asDay(year) < floorDay) year += 1
  return { ...when, year }
}

/** US state names, so "Bayside, California" reads as a state like "Bayside, CA". */
const STATE =
  '(?:[A-Z]{2}|District of Columbia|Rhode Island|(?:New |North |South |West )?[A-Z][a-z]+)'
/**
 * "Venue <sep> City, ST" right after the date, with the separators seen:
 * " — ", " - ", ", ", " | ", " • " and a bare block boundary.
 */
const VENUE_RE = new RegExp(
  `^[\\s${BLOCK}]*([^${BLOCK}|•—–]{2,80}?)\\s*(?:[—–|•,-]|${BLOCK})[\\s${BLOCK}]*` +
    `([A-Z][A-Za-z.' -]{1,40}?)\\s*,[\\s${BLOCK}]*(${STATE})\\b`
)

/**
 * The venue, city and state that follow an event date, or nulls.
 *
 * @param {string} after Text after the date.
 * @returns {{ venue: string|null, city: string|null, state: string|null }}
 */
export function findVenue(after) {
  const m = String(after ?? '')
    .slice(0, 220)
    .match(VENUE_RE)
  if (!m) return { venue: null, city: null, state: null }
  const venue = m[1].trim().replace(/[,\s]+$/, '')
  // A venue that is itself a date is the repeated event card, not a venue.
  if (!venue || findEventDate(venue)) return { venue: null, city: null, state: null }
  return { venue, city: m[2].trim(), state: stateCode(m[3]) }
}

const STATE_CODES = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'district of columbia': 'DC',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
}

/** "California" → "CA"; a two-letter code or an unknown name passes through. */
function stateCode(s) {
  const t = String(s ?? '').trim()
  return STATE_CODES[t.toLowerCase()] ?? t
}

/**
 * The venue for an email: the first event date that is followed by a
 * "Venue, City, ST" block.
 *
 * @param {string} text Output of {@link cleanEmailText}.
 * @returns {{ venue: string|null, city: string|null, state: string|null }}
 */
function venueAfterAnyDate(text) {
  for (const d of findEventDates(text)) {
    const place = findVenue(text.slice(d.end))
    if (place.venue) return place
  }
  return { venue: null, city: null, state: null }
}

/** Parse a money string like "1,234.50" to a number, or null. */
function money(s) {
  if (s == null) return null
  const n = Number(String(s).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * A parsed ticket email. Everything but `platform`, `kind` and `confidence`
 * can be null when the email doesn't say.
 * @typedef {Object} ParsedEventEmail
 * @property {string} platform {@link EventPlatform.id}.
 * @property {EventEmailKind} kind
 * @property {string|null} title Event title as the email names it.
 * @property {WallTime|null} when Event start, year resolved.
 * @property {string|null} venue
 * @property {string|null} city
 * @property {string|null} state Two-letter code or a spelled-out state name.
 * @property {string|null} orderRef The platform's order number.
 * @property {number|null} ticketCount Tickets bought, sent or received.
 * @property {number|null} costTotal Total paid, in `costCurrency`; purchases only.
 * @property {string|null} costCurrency ISO currency code.
 * @property {string|null} counterpart Who sent me tickets (transfer in) or whom
 *   I sent them to (transfer out). Null when the platform hides the sender.
 * @property {number} confidence 0–1: how much of the email was read.
 * @property {string|null} note Why confidence is low, for the review list.
 */

/**
 * Parse one ticket email.
 *
 * @param {{ from: string, subject: string, html: string, receivedAt: Date }} email
 * @returns {ParsedEventEmail|null} Null when the sender is not a known platform.
 */
export function parseEventEmail({ from, subject: rawSubject, html, receivedAt }) {
  const platform = platformForSender(from)
  if (!platform) return null
  const subject = String(rawSubject ?? '').replace(CURLY_APOSTROPHES, "'")
  const kind = classifyEmail(platform, subject)
  const text = cleanEmailText(html)
  const base = {
    platform: platform.id,
    kind,
    title: null,
    when: null,
    venue: null,
    city: null,
    state: null,
    orderRef: null,
    ticketCount: null,
    costTotal: null,
    costCurrency: null,
    counterpart: null,
    confidence: 0,
    note: null,
  }
  if (kind === 'unrecognized' || kind === 'notice') {
    return {
      ...base,
      note: kind === 'notice' ? 'order notice, no event details' : 'no subject rule matched',
    }
  }
  const date = findEventDate(text)
  const when = date ? resolveEventDate(date.when, receivedAt) : null
  const parsed = { ...base, ...venueAfterAnyDate(text), when }
  // A platform extractor's non-null fields win; its nulls never erase what the
  // generic readers found.
  for (const [k, v] of Object.entries(EXTRACTORS[platform.id](text, subject, kind))) {
    if (v != null) parsed[k] = v
  }
  return { ...parsed, ...score(parsed) }
}

/**
 * Confidence from what was found: the event's date and title are what make an
 * email matchable, the venue is what makes the match safe.
 */
function score(p) {
  // An after-the-event email names the event and nothing else by design: it
  // is matched by title to a recent event, and an unmatched one is listed for
  // review by its missing event_id, so a missing date is not low confidence.
  if (p.kind === 'post_event') {
    return p.title ? { confidence: 1, note: null } : { confidence: 0.2, note: 'missing title' }
  }
  const missing = []
  if (!p.when) missing.push('date')
  if (!p.title) missing.push('title')
  if (!p.venue) missing.push('venue')
  const confidence = !p.when ? 0.2 : !p.title ? 0.5 : !p.venue ? 0.7 : 1
  return { confidence, note: missing.length ? `missing ${missing.join(', ')}` : null }
}

/** Strip a subject prefix and trailing " on 3/14", leaving the event title. */
function titleFromSubject(subject, prefix) {
  const m = String(subject ?? '').match(prefix)
  if (!m) return null
  const t = m[1].replace(/\s+on\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, '').trim()
  return t || null
}

/** The sender in "X just sent you", "transfer from X", "Transfer From X Is Ready"; null for "-". */
function senderName(text, subject) {
  const m =
    String(subject ?? '').match(/^(.+?)\s+(?:just\s+)?sent you\b/i) ??
    text.match(/\btransfer from\s+(.+?)\s+(?:is ready|and you)/i) ??
    text.match(/\b(\S.{0,40}?)\s+just sent you\b/i)
  const name = m?.[1]?.trim()
  return name && name !== '-' ? name : null
}

/** "You've assigned NAME a ticket", "transferred ... to NAME". */
function recipientName(text, subject) {
  const m =
    String(subject ?? '').match(/\byou(?:'ve| have) assigned\s+(.+?)\s+an? ticket/i) ??
    text.match(/\b(?:transferred|sent|assigned)\b.{0,60}?\bto\s+([A-Z][\w.'-]*(?: [A-Z][\w.'-]*)?)/)
  return m?.[1]?.trim() ?? null
}

/** Count distinct "Seat N" lines (layouts repeat each seat for mobile and desktop). */
function seatCount(text) {
  const seats = new Set(
    text.match(/\b(?:Sec(?:tion)?\s+\S+,?\s+)?Row\s+\S+,?\s+Seat\s+\S+/gi) ?? []
  )
  return seats.size || null
}

const EXTRACTORS = {
  gametime(text, subject, kind) {
    // Order receipts and delivery notices share one block:
    // "Order # ¶ ABC123 ¶ <title> ¶ <date> ¶ <venue> ¶ <city>, ¶ <ST> ¶ … N ¶ Ticket(s) … Total Paid $X"
    const order = text.match(/Order\s*#\s*(?:¶\s*)?([A-Z0-9]{6,})\b\s*¶?\s*([^¶]+?)\s*¶/)
    const tickets = text.match(/\b(\d{1,2})\s*¶?\s*Tickets?\b/)
    const paid = text.match(/Total Paid[\s¶]*\$\s?([\d,]+(?:\.\d{2})?)/i)
    return {
      orderRef: order?.[1] ?? null,
      title: order?.[2]?.trim() ?? titleFromSubject(subject, /-\s*(.+)$/),
      ticketCount: tickets ? Number(tickets[1]) : null,
      costTotal: kind === 'purchase' ? money(paid?.[1]) : null,
      costCurrency: kind === 'purchase' && paid ? 'USD' : null,
    }
  },

  ticketmaster(text, subject, kind) {
    const order = text.match(/Order\s*#\s*([0-9]+-[0-9]+\/[A-Z0-9]+)/i)
    const total = text.match(/\bTotal:?[\s¶]*\$\s?([\d,]+(?:\.\d{2})?)/i)
    const count =
      text.match(/\b(\d{1,2})x\s/)?.[1] ??
      text.match(/\byou got (\d{1,2}) ticket/i)?.[1] ??
      text.match(/\bsent you (\d{1,2})\b/i)?.[1] ??
      String(subject ?? '').match(/\bsent you (\d{1,2})\b/i)?.[1] ??
      text.match(/Transferred Tickets \((\d{1,2})\)/i)?.[1] ??
      `${subject ?? ''} ${text}`.match(/\btransferred (\d{1,2})\b/i)?.[1] ??
      (kind === 'transfer_out' &&
      /\bassigned\b.{0,60}?\ban? ticket\b/i.test(`${subject ?? ''} ${text}`)
        ? '1'
        : undefined)
    const title =
      titleFromSubject(subject, /^you got tickets to\s+(.+)$/i) ??
      titleFromSubject(subject, /\bticket\(s\) for\s+(.+)$/i) ??
      titleFromSubject(subject, /^you'?re all set to see\s+(.+)$/i) ??
      titleFromSubject(subject, /^event reminder:\s*(.+)$/i) ??
      // "Jordan Just Sent You 2 Harbor City Hawks Tickets" names a team, not
      // the event; the body's event block does: "<title> ¶ <date>".
      titleBeforeDate(text)
    return {
      orderRef: order?.[1] ?? null,
      title,
      ticketCount: count ? Number(count) : seatCount(text),
      costTotal: kind === 'purchase' ? money(total?.[1]) : null,
      costCurrency: kind === 'purchase' && total ? 'USD' : null,
      counterpart:
        kind === 'transfer_in'
          ? senderName(text, subject)
          : kind === 'transfer_out'
            ? recipientName(text, subject)
            : null,
    }
  },

  eventbrite(text, subject, kind) {
    const order = text.match(/Order\s*#\s*(\d{6,})/i)
    const total = text.match(/Order total:\s*([\d,]+(?:\.\d{2})?)\s*([A-Z]{3})/i)
    const count = text.match(/\b(\d{1,2})\s*x\s+(?:Ticket|[A-Z])/)
    // "… (PT) ¶ Add to Google · Outlook · iCal · Yahoo ¶ <venue> ¶ <street> ¶ <City>, ST <zip>"
    const place = text.match(
      /\bYahoo\s*¶\s*([^¶]{2,80}?)\s*¶(?:\s*[^¶]{0,80}?\s*¶){0,2}?\s*([A-Z][A-Za-z.' ]{1,40}?),\s*([A-Z]{2})\s+\d{5}\b/
    )
    return {
      venue: place?.[1]?.trim() ?? null,
      city: place?.[2]?.trim() ?? null,
      state: place?.[3] ?? null,
      orderRef: order?.[1] ?? null,
      title:
        titleFromSubject(subject, /^order confirmation for\s+(.+)$/i) ??
        titleFromSubject(subject, /\bhow was\s+(.+?)\??$/i),
      ticketCount: count ? Number(count[1]) : null,
      costTotal: kind === 'purchase' ? money(total?.[1]) : null,
      costCurrency: kind === 'purchase' ? (total?.[2] ?? null) : null,
    }
  },
}

/** The block just before the first event date — Ticketmaster's event-card title. */
function titleBeforeDate(text) {
  const date = findEventDate(text)
  if (!date) return null
  const blocks = text
    .slice(0, date.end)
    .split(BLOCK)
    .map(s => s.trim())
    .filter(Boolean)
  // The last block holds the date itself; the one before it is the title.
  const t = blocks.length >= 2 ? blocks[blocks.length - 2] : null
  return t && t.length <= 120 ? t : null
}

/**
 * Normalize a venue or title for matching: lowercase, ASCII letters and digits
 * only, and leading "the" dropped. "The Field" and "field " match.
 *
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function normalizeForMatch(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/^\s*the\s+/, '')
    .replace(/\s+/g, '')
}

/**
 * The key that makes two emails one event: the event's local date and its
 * venue. Titles can't be the key — the same game is "Rockets @ Hawks" on Gametime
 * and "Harbor City Hawks vs. Riverside Rockets" on Ticketmaster — but the date and
 * the building agree, and one venue rarely holds two of my events on one day.
 * Falls back to the title when the email names no venue.
 *
 * @param {ParsedEventEmail} p A parsed email with `when` set.
 * @returns {string|null} Null when the email can't be matched (no date).
 */
export function eventMatchKey(p) {
  if (!p?.when) return null
  const { year, month, day } = p.when
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (p.venue) return `${date}|v:${normalizeForMatch(p.venue)}`
  if (p.title) return `${date}|t:${normalizeForMatch(p.title)}`
  return null
}

/**
 * Infer a coarse category from the title. Sports are recognisable ("vs.",
 * "@", a team-at-team " at ", a team or league word); anything else stays
 * `other` for a manual override rather than being guessed at.
 *
 * " at " is also how shows are named ("Night at the Museum", "Live at the
 * Bowl"), so it reads as a matchup only when both sides are full team names
 * of two words or more and the second doesn't start with "the".
 *
 * @param {string|null} title
 * @returns {{ category: 'sports'|'other', teams: string[]|null }}
 */
export function inferCategory(title) {
  const t = String(title ?? '')
  const pair = t.match(/^(.+?)\s+(vs\.?|v\.?|at|@)\s+(.+)$/i)
  const sportsWord =
    /\b(football|basketball|baseball|hockey|soccer|training camp|play-?in|nfl|nba|mlb|nhl|wnba|ncaa)\b/i.test(
      t
    )
  if (pair) {
    const [, a, sep, b] = pair
    const words = s => s.trim().split(/\s+/).length
    const teamAtTeam = words(a) >= 2 && words(b) >= 2 && !/^the\b/i.test(b)
    if (sep.toLowerCase() !== 'at' || teamAtTeam) {
      return { category: 'sports', teams: [a.trim(), b.trim()] }
    }
  }
  return { category: sportsWord ? 'sports' : 'other', teams: null }
}
