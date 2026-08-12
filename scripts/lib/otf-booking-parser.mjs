/**
 * Title and studio parsing for OTF booking calendar events (#453).
 *
 * The OTbeat report email carries no class-template token at all, so the
 * template ("2G", "3G", "HYROX 2G") can only come from the booking calendar,
 * where it lives in the event title. This module turns those free-text titles
 * and location strings into the structured columns `otf_bookings` stores.
 *
 * Two rules govern everything here:
 *
 * 1. **Never guess.** A title that doesn't match the grammar yields all-null
 *    parsed fields, and the caller still writes the row with `title_raw`
 *    intact. Dropping the row would lose the booking; guessing at the format
 *    would put a fabricated template into the analysis that #453 exists to fix.
 * 2. **`format` is free text.** OTF introduces templates without notice — HYROX
 *    was unknown until 2026-08-05 — so anything after "Min" is captured
 *    verbatim rather than validated against a list.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step, same
 * constraint as the sibling otbeat parser / supabase / class-type helpers.
 */

/**
 * Observed booking-title grammar: `Orange [<program>] <duration> Min <format>`.
 *
 * The optional program group is anchored to start with a letter
 * (`[A-Za-z][A-Za-z0-9]*`) rather than the looser `[A-Za-z0-9]+` so it can
 * never swallow the duration: on "Orange 60 Min 2G" a digit-leading group would
 * match "60" and force the engine to backtrack. Requiring a leading letter
 * removes the ambiguity outright instead of relying on backtracking order.
 *
 * `format` is `.+` — greedy to end of string — because it is the one field with
 * no known vocabulary. "2G", "3G", "Tread 50", and whatever OTF ships next all
 * land here whole.
 */
const TITLE_RE = /^Orange\s+(?:([A-Za-z][A-Za-z0-9]*)\s+)?(\d+)\s+Min\s+(.+)$/

/**
 * A booking title broken into its parts. Every field is independently nullable:
 * a title that fails {@link TITLE_RE} yields all-null rather than a partial
 * guess, and the caller keeps the raw string.
 * @typedef {Object} ParsedBookingTitle
 * @property {string|null} program Program variant such as `'HYROX'`, or null for a standard class.
 * @property {number|null} durationMin Scheduled class length in minutes, e.g. 60.
 * @property {string|null} format Class template verbatim, e.g. `'2G'` / `'3G'` / `'Tread 50'`.
 */

/**
 * Parse an OTF booking event title into program / duration / format.
 *
 * @param {string|null|undefined} title Raw calendar event summary.
 * @returns {ParsedBookingTitle} Parsed parts; all null when the title is blank
 *   or doesn't match the grammar. Never throws — an unrecognized title is an
 *   expected outcome, not an error, and the row is still worth storing.
 */
export function parseBookingTitle(title) {
  const empty = { program: null, durationMin: null, format: null }
  if (typeof title !== 'string') return empty
  const m = title.trim().match(TITLE_RE)
  if (!m) return empty
  const [, program, duration, format] = m
  const trimmedFormat = format.trim()
  return {
    program: program ?? null,
    durationMin: Number(duration),
    format: trimmedFormat === '' ? null : trimmedFormat,
  }
}

/**
 * Marks an event as an OTF booking rather than something else on the same
 * calendar. Every observed booking title begins with "Orange".
 *
 * Deliberately looser than {@link TITLE_RE}: the source is the shared iCloud
 * "Home" calendar, so the reader must distinguish *not an OTF booking* (skip
 * it — it belongs to some other part of life) from *an OTF booking whose title
 * we can't fully parse* (store it, leave the parsed columns null). Testing the
 * full grammar here would collapse those two cases and silently drop a real
 * booking the day OTF changes its title format.
 */
const OTF_TITLE_PREFIX_RE = /^\s*Orange\b/i

/**
 * Whether a calendar event title looks like an OTF class booking.
 *
 * @param {string|null|undefined} title Raw calendar event summary.
 * @returns {boolean} True for anything starting with "Orange", case-insensitive.
 */
export function isOtfBookingTitle(title) {
  return typeof title === 'string' && OTF_TITLE_PREFIX_RE.test(title)
}

/**
 * Trailing US state suffix on a studio string, e.g. the ", CA" in
 * "Marina Del Rey, CA". The OTbeat email includes it; the calendar's location
 * field does not, so it has to come off before the two can be compared.
 */
const STATE_SUFFIX_RE = /,\s*[A-Za-z]{2}\.?\s*$/

/**
 * Normalize a studio string to its bare location name, preserving casing for
 * display: `'Marina Del Rey, CA'` and `'  Marina Del Rey '` both become
 * `'Marina Del Rey'`.
 *
 * Only the state suffix and whitespace are touched. Anything more aggressive
 * (title-casing, punctuation stripping) risks mangling a studio name we haven't
 * seen — there are at least three in play and OTF names them freely.
 *
 * @param {string|null|undefined} raw Studio string from either source.
 * @returns {string|null} The bare name, or null when there's nothing left.
 */
export function normalizeStudio(raw) {
  if (typeof raw !== 'string') return null
  const stripped = raw.replace(STATE_SUFFIX_RE, '').replace(/\s+/g, ' ').trim()
  return stripped === '' ? null : stripped
}

/**
 * Case-insensitive key for comparing two studio strings across sources.
 *
 * The join in the reconcile pass must treat "Marina Del Rey, CA" (as the OTbeat
 * email writes it) and "Marina Del Rey" (as the calendar writes it) as the same
 * studio, and must NOT treat Marina Del Rey and Mar Vista as interchangeable —
 * studio is part of the join key precisely because at least three locations are
 * in play.
 *
 * @param {string|null|undefined} raw Studio string from either source.
 * @returns {string|null} Lowercased bare name, or null when absent.
 */
export function studioMatchKey(raw) {
  const normalized = normalizeStudio(raw)
  return normalized === null ? null : normalized.toLowerCase()
}
