/**
 * Attribution between transcribed Apple Notes sessions and the Apple Health
 * strength workouts already in `weight_room_workouts` (#400, shape shared with
 * #401).
 *
 * The two sources record the same hour from opposite ends. Health knows when a
 * session started, how long it ran and how hard — but not one thing that was
 * lifted. The note knows every set — but only bears the timestamps Apple stamped
 * on the file. Joined, a session gets both halves; joined *wrongly*, a session
 * gets someone else's heart rate welded onto its sets, and nothing downstream
 * looks suspicious. So the match is explicit, ranked, and reports what it did.
 *
 * The join is tighter than "same day" because these notes were typed *during*
 * the workout, one row at a time: on 2024-04-16 the Health window was
 * 21:39:00-22:10:42 and the note's own create/modify span was 21:40:38-22:07:12,
 * sitting entirely inside it. Overlap is therefore the primary signal, and it is
 * what separates the 8 days in this history that carry two strength sessions —
 * days a same-day join would silently coin-flip.
 */

/**
 * Milliseconds that two half-open intervals share.
 *
 * @param {number} aStart Start of the first interval, epoch ms.
 * @param {number} aEnd End of the first interval, epoch ms.
 * @param {number} bStart Start of the second interval, epoch ms.
 * @param {number} bEnd End of the second interval, epoch ms.
 * @returns {number} Overlap in ms; 0 when they do not intersect.
 */
export function overlapMs(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart)
  const end = Math.min(aEnd, bEnd)
  return Math.max(0, end - start)
}

/**
 * The offset of a time zone at a given instant, in milliseconds.
 *
 * Computed from `Intl` rather than hardcoded because this history spans several
 * years of daylight-saving transitions, and a fixed -08:00 would shift every
 * summer session by an hour — enough to push a note out of the workout window it
 * belongs to and break the match that makes the import worth doing.
 *
 * @param {Date} instant The moment to measure at.
 * @param {string} timeZone IANA zone, e.g. `'America/Los_Angeles'`.
 * @returns {number} Offset east of UTC in ms (negative for the Americas).
 */
export function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const at = type => Number(parts.find(part => part.type === type)?.value)
  // `hour12: false` renders midnight as 24 in some ICU versions.
  const hour = at('hour') % 24

  const asUtc = Date.UTC(at('year'), at('month') - 1, at('day'), hour, at('minute'), at('second'))
  return asUtc - instant.getTime()
}

/**
 * Interpret a wall-clock local time as a UTC instant.
 *
 * Apple's `Notes Details.csv` stamps `MM-DD-YYYY HH:MM:SS` with no offset, in
 * the exporting device's local zone. Treating that as UTC would land every
 * session seven or eight hours late and match it against the wrong workout —
 * or nothing at all.
 *
 * Resolved by guessing, measuring the zone's offset at the guess, and
 * correcting. Ambiguous times in the autumn fall-back hour resolve to the first
 * of the two; nothing in this dataset lands there, and a one-hour error in that
 * window would still overlap the session it belongs to.
 *
 * @param {{year: number, month: number, day: number, hour?: number,
 *   minute?: number, second?: number}} parts Wall-clock components, 1-based month.
 * @param {string} timeZone IANA zone the components are expressed in.
 * @returns {Date} The corresponding UTC instant.
 */
export function localToInstant(parts, timeZone) {
  const { year, month, day, hour = 0, minute = 0, second = 0 } = parts
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = zoneOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset)
}

/**
 * Parse one `MM-DD-YYYY HH:MM:SS` stamp from Apple's notes manifest.
 *
 * @param {string} stamp The raw cell, e.g. `'04-16-2024 21:40:38'`.
 * @param {string} timeZone IANA zone the stamp is expressed in.
 * @returns {Date|null} The instant, or null when the cell is not a stamp.
 */
export function parseNotesCsvStamp(stamp, timeZone) {
  if (typeof stamp !== 'string') return null
  const match = stamp.trim().match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, month, day, year, hour, minute, second] = match.map(Number)
  return localToInstant({ year, month, day, hour, minute, second }, timeZone)
}

/**
 * Pick the stored workout a transcribed note documents.
 *
 * Overlap first, ranked by how much of it there is. A note whose window misses
 * every session — typed up after the fact, or logged on a day the watch was on
 * the charger — falls back to a same-day match, but *only* when that day holds
 * exactly one session; two candidates and one note is not something to resolve
 * by guessing, so it returns null and the caller records the note as its own
 * session instead.
 *
 * @param {{start: Date, end: Date}} noteWindow The note's create/modify span.
 * @param {Array<{id: string, started_at: string, ended_at: string|null}>} sessions
 *   Candidate stored workouts.
 * @param {string} timeZone IANA zone used for the same-day fallback.
 * @returns {{id: string, method: 'overlap'|'same-day', overlapMs: number}|null}
 *   The chosen session, or null when nothing matched confidently.
 */
export function matchNoteToSession(noteWindow, sessions, timeZone) {
  const noteStart = noteWindow.start.getTime()
  const noteEnd = noteWindow.end.getTime()
  if (!Number.isFinite(noteStart) || !Number.isFinite(noteEnd)) return null

  /** @type {{id: string, overlap: number}|null} */
  let best = null
  for (const session of sessions) {
    const start = new Date(session.started_at).getTime()
    // A session with no recorded end is treated as instantaneous rather than
    // open-ended; an unbounded window would swallow every note that day.
    const end = session.ended_at ? new Date(session.ended_at).getTime() : start
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue

    const overlap = overlapMs(noteStart, noteEnd, start, end)
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { id: session.id, overlap }
    }
  }
  if (best) return { id: best.id, method: 'overlap', overlapMs: best.overlap }

  const dayKey = instant => localDayKey(instant, timeZone)
  const noteDay = dayKey(noteWindow.start)
  const sameDay = sessions.filter(
    session => dayKey(new Date(session.started_at)) === noteDay
  )
  if (sameDay.length === 1) {
    return { id: sameDay[0].id, method: 'same-day', overlapMs: 0 }
  }

  return null
}

/**
 * The `YYYY-MM-DD` a moment falls on in a given zone.
 *
 * @param {Date} instant The moment.
 * @param {string} timeZone IANA zone.
 * @returns {string} Day key, or `''` for an invalid date.
 */
export function localDayKey(instant, timeZone) {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const at = type => parts.find(part => part.type === type)?.value
  return `${at('year')}-${at('month')}-${at('day')}`
}
