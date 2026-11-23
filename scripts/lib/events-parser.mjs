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

/**
 * Account mail every platform sends from its transactional sender (a password
 * change, a sign-in code). It says nothing about an event, so it is a `notice`
 * and stays off the review list. First in each platform's rules so a stray
 * word like "reminder" in such a subject can't make it an event email, and
 * anchored to the start of the subject so an event titled "Password Security
 * Workshop" is still read as one.
 * @type {[RegExp, EventEmailKind]}
 */
const ACCOUNT_NOTICE = [
  /^(?:[^:]{1,30}:\s*)?(?:your (?:password|sign[- ]?in|login)\b|(?:reset|change|update) your password\b|password (?:reset|changed|updated|reminder)\b|(?:your )?(?:\w+ )?(?:authentication|verification|security|sign[- ]?in|login|one[- ]time) code\b|verify your (?:email|account)\b)/i,
  'notice',
]

/** @type {EventPlatform[]} */
export const PLATFORMS = [
  {
    id: 'gametime',
    senders: ['receipts@e.gametime.co'],
    rules: [
      ACCOUNT_NOTICE,
      [/^your ticket order\b/i, 'purchase'],
      [/^order confirmation\b/i, 'purchase'],
      [/your ticket transfer\b/i, 'fulfilment'],
      [/replacement options|couldn'?t be fulfilled/i, 'notice'],
    ],
  },
  {
    id: 'ticketmaster',
    senders: ['customer_support@email.ticketmaster.com', 'noreply@ticketmaster.com'],
    extraQuery: 'from:newsletter@email.ticketmaster.com subject:"Event Reminder"',
    rules: [
      ACCOUNT_NOTICE,
      [/^you got tickets to\b/i, 'purchase'],
      [/\byou(?:'ve| have) (?:transferred|assigned|sent)\b/i, 'transfer_out'],
      // Completion notices for a transfer I sent: "Your Ticket Has Been
      // Accepted by <Name>", "Your Ticket Transfer Went Through".
      [/\b(?:has been|have been|was|were) accepted by\b/i, 'transfer_out'],
      [/\btransfer went through\b/i, 'transfer_out'],
      [/\bsent you\b.*\bticket/i, 'transfer_in'],
      // "<Name> has transferred you ticket(s) for <Event>", "<Name> transferred
      // you 2 tickets", "You've received tickets from <Name>", "Your Ticket
      // Transfer From <Name> Is Ready".
      [/\b(?:has |have )?transferred you\b/i, 'transfer_in'],
      [/\byou(?:'ve| have) received\b.*\btickets? from\b/i, 'transfer_in'],
      [/\bticket transfer from\b/i, 'transfer_in'],
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
      ACCOUNT_NOTICE,
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
 * @returns {EventDateMatch | null}
 */
export function findEventDate(text) {
  return findEventDates(text)[0] ?? null
}

/**
 * One event date found in an email's text.
 * @typedef {Object} EventDateMatch
 * @property {WallTime} when The date as stated (year may be null).
 * @property {number} start Index where the date starts, so the event title can
 *   be read from the block before it.
 * @property {number} end Index just past the date, so the venue can be read
 *   from what follows.
 */

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
 * @returns {EventDateMatch[]}
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
    found.push({ when, start: m.index, end: m.index + m[0].length })
  }
  return found
}

/**
 * Kinds that can arrive after the event they name: a transfer completing, a
 * delivery notice, a late reminder. A yearless date in one of these may
 * resolve to a recent past occurrence — see {@link resolveEventDate}.
 */
const MAY_ARRIVE_LATE = new Set(['transfer_in', 'transfer_out', 'fulfilment', 'reminder'])

/**
 * How long after an event a late-arriving email can still be about it. Bounded
 * so a delivery notice sent months *ahead* of an event isn't pulled back to the
 * same date last year.
 */
const LATE_ARRIVAL_DAYS = 60

/**
 * Fill in a missing year.
 *
 * By default the event is the first occurrence of that month and day on or
 * after the day before the email was sent (a purchase is never about an event
 * more than a day in the past — a same-day purchase can land after a
 * late-evening start in UTC).
 *
 * With `mayArriveLate`, for kinds that can land after the event, an occurrence
 * up to {@link LATE_ARRIVAL_DAYS} before the email wins, so a transfer
 * confirmation a week after a March game stays in March rather than moving to
 * next March. Anything older falls back to the default rule.
 *
 * @param {WallTime} when
 * @param {Date} receivedAt When Gmail received the email.
 * @param {{ mayArriveLate?: boolean }} [opts]
 * @returns {WallTime} `when` with `year` set.
 */
export function resolveEventDate(when, receivedAt, { mayArriveLate = false } = {}) {
  if (when.year != null) return when
  const asDay = y => Date.UTC(y, when.month - 1, when.day)
  const floor = new Date(receivedAt.getTime() - 36 * 3600 * 1000)
  let year = floor.getUTCFullYear()
  const floorDay = Date.UTC(floor.getUTCFullYear(), floor.getUTCMonth(), floor.getUTCDate())
  if (asDay(year) < floorDay) year += 1
  if (mayArriveLate) {
    // The occurrence just before the default one: the most recent past date.
    const past = asDay(year - 1)
    const age = receivedAt.getTime() - past
    if (age >= 0 && age <= LATE_ARRIVAL_DAYS * 24 * 3600 * 1000) year -= 1
  }
  return { ...when, year }
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

/** US state codes, for telling a state from another region's code. */
const US_CODES = new Set(Object.values(STATE_CODES))

/** "California" → "CA"; a US code passes through; any other region → null. */
function stateCode(s) {
  const t = String(s ?? '').trim()
  const code = STATE_CODES[t.toLowerCase()] ?? t.toUpperCase()
  return US_CODES.has(code) ? code : null
}

/** "new hampshire" → "New Hampshire", "district of columbia" → "District of Columbia". */
function titleCaseState(name) {
  return name.replace(/\b[a-z]/g, (c, i) => (name.slice(i, i + 3) === 'of ' ? c : c.toUpperCase()))
}

/**
 * The region after a city: a spelled-out US state, or any two-letter code. A
 * code that isn't a US state (a Canadian province, a country) still marks the
 * venue and city, but reads as no state — see {@link stateCode}. A bare
 * capitalised word is not a region.
 */
const STATE = `(?:${Object.keys(STATE_CODES)
  .sort((a, b) => b.length - a.length)
  .map(titleCaseState)
  .join('|')}|[A-Z]{2})`

/**
 * "Venue <sep> City, ST" right after the date, with the separators seen:
 * " — ", " - ", ", ", " | ", " • " and a bare block boundary. A hyphen counts
 * only with spaces around it, so "Example-Name Arena" stays one venue.
 */
const VENUE_RE = new RegExp(
  `^[\\s${BLOCK}]*([^${BLOCK}|•—–]{2,80}?)\\s*(?:[—–|•,]|${BLOCK}|(?<=\\s)-(?=\\s))[\\s${BLOCK}]*` +
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

/**
 * The venue for an email: the first event date that is followed by a
 * "Venue, City, ST" block.
 *
 * @param {string} text Output of {@link cleanEmailText}.
 * @param {EventDateMatch[]} dates `findEventDates(text)`, computed once per email.
 * @returns {{ venue: string|null, city: string|null, state: string|null }}
 */
function venueAfterAnyDate(text, dates) {
  for (const d of dates) {
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
      note: kind === 'notice' ? 'notice, no event details' : 'no subject rule matched',
    }
  }
  // The date regex runs once per email; every reader below shares the result.
  const dates = findEventDates(text)
  const when = dates[0]
    ? resolveEventDate(dates[0].when, receivedAt, { mayArriveLate: MAY_ARRIVE_LATE.has(kind) })
    : null
  const parsed = { ...base, ...venueAfterAnyDate(text, dates), when }
  // A platform extractor's non-null fields win; its nulls never erase what the
  // generic readers found.
  for (const [k, v] of Object.entries(EXTRACTORS[platform.id](text, subject, kind, dates))) {
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

/**
 * A person's name from a phrase that precedes or follows it, kept to one
 * sentence: text from another block or sentence ("Hi Sam, ¶ Great news!
 * Jordan") never joins it, and a greeting before a comma is dropped. Null for
 * Ticketmaster's "-" placeholder or anything that doesn't start with a capital.
 */
function cleanName(raw) {
  const name = String(raw ?? '')
    .split(/[,¶!?:;]/)
    .pop()
    .trim()
    .replace(/\.+$/, '') // a sentence-ending period, not an initial
  if (!name || name === '-' || !/^[A-Z]/.test(name)) return null
  return name.split(/\s+/).length <= 4 ? name : null
}

/** One sentence's worth of text: no block break, no sentence end. */
const IN_SENTENCE = `[^${BLOCK}.!?]`

/** The first pattern whose capture is a usable name, in order. */
function firstName(candidates) {
  for (const [source, re] of candidates) {
    const name = cleanName(source.match(re)?.[1])
    if (name) return name
  }
  return null
}

/** The sender in "X just sent you", "X has transferred you", "transfer from X"; null for "-". */
function senderName(text, subject) {
  const s = String(subject ?? '')
  return firstName([
    [s, /^(.+?)\s+(?:just\s+)?sent you\b/i],
    [s, /^(.+?)\s+(?:has\s+|have\s+)?transferred you\b/i],
    [s, /\btickets? from\s+(.+?)(?:\s+(?:is|are)\b|\s+for\b|$)/i],
    [text, new RegExp(`\\btransfer from\\s+(${IN_SENTENCE}{1,40}?)\\s+(?:is ready|and you)`, 'i')],
    // A run of capitalised words right before the verb: the name, not the
    // greeting or copy earlier in the sentence.
    [
      text,
      /\b((?:[A-Z][\w.'-]*\s+){0,3}[A-Z][\w.'-]*)\s+(?:[Jj]ust [Ss]ent|[Hh]as [Tt]ransferred) [Yy]ou\b/,
    ],
  ])
}

/** "You've assigned NAME a ticket", "accepted by NAME", "transferred ... to NAME". */
function recipientName(text, subject) {
  const s = String(subject ?? '')
  return firstName([
    [s, /\byou(?:'ve| have) assigned\s+(.+?)\s+an? ticket/i],
    [s, /\baccepted by\s+(.+?)(?:\s+for\b|$)/i],
    [
      text,
      new RegExp(
        `\\b(?:transferred|sent|assigned)\\b${IN_SENTENCE}{0,60}?\\bto\\s+(?!(?:My|Your|The|Our)\\b)([A-Z][\\w.'-]*(?: [A-Z][\\w.'-]*){0,3})`
      ),
    ],
  ])
}

/**
 * Count distinct seats. Layouts repeat each seat for mobile and desktop, and
 * one copy may drop the section ("Sec 101, Row 5, Seat 3" beside "Row 5,
 * Seat 3"), so seats are keyed on row and seat; a row and seat seen in two
 * different sections are two seats.
 */
function seatCount(text) {
  const bySeat = new Map()
  const re = /\b(?:Sec(?:tion)?\s+(\S+?),?\s+)?Row\s+(\S+?),?\s+Seat\s+([^\s,¶]+)/gi
  for (const m of text.matchAll(re)) {
    const key = `${m[2]}|${m[3]}`.toLowerCase()
    const sections = bySeat.get(key) ?? new Set()
    if (m[1]) sections.add(m[1].toLowerCase())
    bySeat.set(key, sections)
  }
  let n = 0
  for (const sections of bySeat.values()) n += Math.max(1, sections.size)
  return n || null
}

/**
 * Tickets in a Ticketmaster order summary: the sum of its "2x Standard
 * Admission" line items, each ticket type once (the summary is repeated for
 * mobile and desktop). Read only after "Order Summary" / "Your Tickets", so
 * promo copy ("Earn 2x points") elsewhere in the email can't set the count.
 */
function orderLineItemCount(text) {
  const start = text.search(/\b(?:order summary|your tickets)\b/i)
  if (start < 0) return null
  const items = new Map()
  const re =
    /\b(\d{1,2})\s?x\s+(?!(?:[Pp]oints?|[Rr]ewards?|[Mm]iles|POINTS|REWARDS|MILES)\b)([A-Z][\w'&/-]*(?:\s+[A-Z][\w'&/-]*)*)/g
  for (const m of text.slice(start).matchAll(re)) {
    const label = m[2].toLowerCase()
    items.set(label, Math.max(items.get(label) ?? 0, Number(m[1])))
  }
  let n = 0
  for (const q of items.values()) n += q
  return n || null
}

const EXTRACTORS = {
  gametime(text, subject, kind, dates) {
    // Order receipts and delivery notices share one block:
    // "Order # ¶ ABC123 ¶ <title> ¶ <date> ¶ <venue> ¶ <city>, ¶ <ST> ¶ … N ¶ Ticket(s) … Total Paid $X"
    const order = text.match(/Order\s*#\s*(?:¶\s*)?([A-Z0-9]{6,})\b\s*¶?\s*([^¶]+?)\s*¶/)
    // The count is its own cell and "Ticket(s)" ends the next one, so a number
    // in running copy ("10 Tickets left") is never read as the count.
    const tickets = text.match(/(?:^|¶)\s*(\d{1,2})\s*¶?\s*Tickets?(?:\(s\))?\s*(?=¶|$)/)
    const paid = text.match(/Total Paid[\s¶]*\$\s?([\d,]+(?:\.\d{2})?)/i)
    return {
      orderRef: order?.[1] ?? null,
      title:
        order?.[2]?.trim() ??
        // "Order Confirmation - <A> @ <B> @ <Venue> on 3/14": with two "@", the
        // last one is the venue. A single "@" is the matchup itself.
        titleFromSubject(subject, /^order confirmation\s*-\s*(.+?\s+@\s+.+?)\s+@\s+[^@]+$/i) ??
        titleFromSubject(subject, /-\s*(.+)$/) ??
        titleBeforeDate(text, dates),
      ticketCount: tickets ? Number(tickets[1]) : null,
      costTotal: kind === 'purchase' ? money(paid?.[1]) : null,
      costCurrency: kind === 'purchase' && paid ? 'USD' : null,
    }
  },

  ticketmaster(text, subject, kind, dates) {
    const order = text.match(/Order\s*#\s*([0-9]+-[0-9]+\/[A-Z0-9]+)/i)
    const total = text.match(/\bTotal:?[\s¶]*\$\s?([\d,]+(?:\.\d{2})?)/i)
    const count =
      orderLineItemCount(text) ??
      text.match(/\byou got (\d{1,2}) ticket/i)?.[1] ??
      text.match(/\b(?:sent|transferred) you (\d{1,2})\b/i)?.[1] ??
      String(subject ?? '').match(/\b(?:sent|transferred) you (\d{1,2})\b/i)?.[1] ??
      text.match(/Transferred Tickets \((\d{1,2})\)/i)?.[1] ??
      `${subject ?? ''} ${text}`.match(/\btransferred (\d{1,2})\b/i)?.[1] ??
      (kind === 'transfer_out' &&
      /\bassigned\b.{0,60}?\ban? ticket\b/i.test(`${subject ?? ''} ${text}`)
        ? '1'
        : undefined)
    const title =
      titleFromSubject(subject, /^you got tickets to\s+(.+)$/i) ??
      titleFromSubject(subject, /\bticket(?:\(s\)|s)? for\s+(.+)$/i) ??
      titleFromSubject(subject, /^you'?re all set to see\s+(.+)$/i) ??
      titleFromSubject(subject, /^event reminder:\s*(.+)$/i) ??
      // "Jordan Just Sent You 2 Harbor City Hawks Tickets" names a team, not
      // the event; the body's event block does: "<title> ¶ <date>".
      titleBeforeDate(text, dates)
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

/**
 * The block just before the first event date — Ticketmaster's event-card
 * title. Read from the text before the date *starts*, so a date whose time
 * sits in the next cell ("Title ¶ Sat, Mar 14 ¶ 6:40 PM") still yields the
 * title rather than the date fragment. Whatever shares the date's own block
 * ("Date: Sat, Mar 14 …") is skipped.
 *
 * @param {string} text Output of {@link cleanEmailText}.
 * @param {EventDateMatch[]} dates `findEventDates(text)`.
 */
function titleBeforeDate(text, dates) {
  const date = dates[0]
  if (!date) return null
  const blocks = text.slice(0, date.start).split(BLOCK)
  blocks.pop() // the date's own block, up to the date
  const t =
    blocks
      .map(s => s.trim())
      .filter(Boolean)
      .pop() ?? null
  return t && t.length <= 120 && !findEventDate(t) ? t : null
}

/**
 * Strip accents: NFKD splits "é" into "e" plus a combining mark, and the mark
 * is dropped, so "Théâtre" and "Theatre" read the same.
 *
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function foldAccents(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
}

/**
 * Normalize a venue or title for matching: lowercase, accents folded, ASCII
 * letters and digits only, and leading "the" dropped. "The Field" and "field "
 * match, and so do "Théâtre" and "Theatre".
 *
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function normalizeForMatch(s) {
  return foldAccents(s)
    .toLowerCase()
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
  return matchKeyWith(p, normalizeForMatch)
}

function matchKeyWith(p, normalize) {
  if (!p?.when) return null
  const { year, month, day } = p.when
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (p.venue) return `${date}|v:${normalize(p.venue)}`
  if (p.title) return `${date}|t:${normalize(p.title)}`
  return null
}

/**
 * The key {@link eventMatchKey} gave this email before accents were folded,
 * when that differs: an accent then became a word break ("Théâtre" →
 * "the atre", which also lost a leading "the"). Events stored under the old
 * key are still found by it, so a re-read doesn't create a duplicate.
 *
 * @param {ParsedEventEmail} p
 * @returns {string|null} Null when the email has no key or the keys agree.
 */
export function legacyMatchKey(p) {
  const legacy = matchKeyWith(p, s =>
    String(s ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/^\s*the\s+/, '')
      .replace(/\s+/g, '')
  )
  return legacy && legacy !== eventMatchKey(p) ? legacy : null
}

/**
 * Words a venue's name ends with. A " at " or "@" whose right side ends in one
 * names a place, not a team: "Example Band at Sample Bowl", "Comedy Night @
 * The Improv Club".
 */
const VENUE_WORDS =
  /\b(?:arena|stadium|field|park|cent(?:er|re)|hall|theat(?:er|re)|amphitheat(?:er|re)|bowl|pavilion|ballroom|club|lounge|gardens?|museum|auditorium|coliseum|dome|forum|house|room|bar|brewery|winery|studios?|lawn|grounds|palladium|fillmore|warfield)\s*$/i

const SPORTS_WORDS =
  /\b(?:football|basketball|baseball|hockey|soccer|training camp|play-?in|playoffs?|nfl|nba|mlb|nhl|wnba|mls|ncaa)\b/i
const CONCERT_WORDS =
  /\b(?:concert|tour|festival|symphony|orchestra|philharmonic|quartet|jazz|choir|dj set|live music|unplugged|acoustic|in concert)\b/i
const SHOW_WORDS =
  /\b(?:comedy|comedian|stand-?up|improv|musical|theat(?:er|re)|ballet|opera|broadway|magic show|circus)\b/i

/**
 * Event categories the importer can infer; `party` is set only by the owner.
 * @typedef {'sports'|'concert'|'show'|'other'} InferredCategory
 */

/**
 * Infer a coarse category from the title (and the venue, when known). Sports
 * are recognisable ("vs.", "@", a team-at-team " at ", a team or league word);
 * a music or stage word reads as a concert or a show; anything else stays
 * `other` for a manual override rather than being guessed at.
 *
 * " at " and "@" are also how shows are named ("Night at the Museum", "Live
 * at the Bowl", "Comedy Night @ The Improv"), so they read as a matchup only
 * when the right side isn't a place: it doesn't start with "the", doesn't end
 * in a venue word, and isn't the email's own venue. A bare " at " further
 * needs two full team names of two words or more on either side.
 *
 * Titles often wrap the matchup in a label — "Round 1: Rockets at Hawks:
 * Game 3", "Preseason - Rockets at Hawks" — so the matchup is read from the
 * segment between ": " and " - " separators that holds it, and the label
 * stays out of the team names.
 *
 * @param {string|null} title
 * @param {string|null} [venue] The parsed venue, to recognise "Artist at <venue>".
 * @returns {{ category: InferredCategory, teams: string[]|null }}
 */
export function inferCategory(title, venue = null) {
  const t = String(title ?? '')
  const pairRe = /^(.+?)\s+(vs\.?|v\.?|at|@)\s+(.+)$/i
  const segment = t.split(/:\s+|\s+[-–—|]\s+/).find(s => pairRe.test(s.trim()))
  const pair = segment?.trim().match(pairRe)
  let named = t // the part of the title that names the act, for the word checks
  if (pair) {
    const [, rawA, sep, rawB] = pair
    const a = rawA.trim()
    const b = rawB.trim()
    const s = sep.toLowerCase().replace('.', '')
    const words = x => x.split(/\s+/).length
    const v = normalizeForMatch(venue)
    const nb = normalizeForMatch(b)
    // Exactly the email's venue. Not a prefix: a home team often starts the
    // venue's name ("Example State at Michigan", venue "Michigan Stadium").
    const sameAsVenue = v.length > 0 && nb === v
    const isPlace = /^the\b/i.test(b) || VENUE_WORDS.test(b) || sameAsVenue
    const matchup =
      s === 'vs' || s === 'v' || (!isPlace && (s === '@' || (words(a) >= 2 && words(b) >= 2)))
    if (matchup) return { category: 'sports', teams: [a, b] }
    if (isPlace) named = a
  }
  if (SPORTS_WORDS.test(t)) return { category: 'sports', teams: null }
  if (CONCERT_WORDS.test(named)) return { category: 'concert', teams: null }
  if (SHOW_WORDS.test(named)) return { category: 'show', teams: null }
  return { category: 'other', teams: null }
}
