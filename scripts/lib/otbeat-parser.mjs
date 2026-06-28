/**
 * Parser for Orangetheory "OTbeatReport" Studio Workout Summary emails (#251).
 *
 * Node port of the original `otbeat_parser.py`. Turns one summary email's
 * HTML body into a structured record. Used by `scripts/import-otbeat.mjs`
 * (the Gmail → Supabase ingestion) and exercised by
 * `scripts/lib/otbeat-parser.test.ts`.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step, so the
 * plain-`node` import scripts can require it directly (same constraint as
 * `scripts/lib/cardio-supabase.mjs`).
 *
 * Design notes:
 * - The rower block is class-dependent (Endurance / tread-only days have no
 *   rower); `record.rower` is `null` in that case. Handle downstream, don't
 *   assume it. Same for `treadmill` on rare formats that omit it.
 * - Times are kept as "MM:SS" strings; convert to seconds at the chart layer
 *   with {@link mmssToSec} if you want numeric axes.
 * - `date`/`time` are returned as the email's raw local strings
 *   ("MM/DD/YYYY", "9:30AM"); combining them into a `started_at` timestamptz
 *   (with the studio's timezone) is the importer's job, not the parser's.
 */

/**
 * Strip tags / entities and collapse whitespace to a flat single-line string.
 * Mirrors the Python `_clean` so the same regexes match.
 *
 * @param {string} html Raw email HTML.
 * @returns {string} Flattened text.
 */
export function cleanHtml(html) {
  return (
    html
      .replace(/<[^>]+>/g, ' ')
      // Zero-width joiners/non-joiners are layout noise — drop them outright.
      .replace(/&zwnj;|&zwj;|&#8204;|&#8205;/g, '')
      // Non-breaking spaces are real separators (OTbeat uses them between the
      // date/time/coach tokens) — collapse to a normal space, don't delete, or
      // adjacent tokens fuse and the header regexes stop matching.
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
  )
}

/**
 * Convert an "MM:SS" duration to whole seconds. Returns `null` on empty or
 * malformed input (no colon).
 *
 * @param {string|null|undefined} s e.g. "16:44".
 * @returns {number|null} e.g. 1004.
 */
export function mmssToSec(s) {
  if (!s || !s.includes(':')) return null
  const [mm, ss] = s.split(':')
  return Number(mm) * 60 + Number(ss)
}

/** First capture group of `re` against `text` as a Number, or `null`. */
function num(text, re) {
  const m = text.match(re)
  return m ? Number(m[1]) : null
}

/**
 * One parsed Orangetheory treadmill performance block. All distances/speeds
 * are imperial as the email reports them; paces/time are "MM:SS" strings.
 * @typedef {Object} OtbeatTreadmill
 * @property {number} distance_mi Total treadmill distance, miles.
 * @property {string} time Total treadmill time, "MM:SS".
 * @property {number} [avg_mph] Average speed, mph.
 * @property {number} [max_mph] Max speed, mph.
 * @property {number} [avg_incline] Average incline, percent.
 * @property {number} [max_incline] Max incline, percent.
 * @property {string} [avg_pace] Average pace, "MM:SS" per mile.
 * @property {string} [fastest_pace] Fastest pace, "MM:SS" per mile.
 * @property {number} [elevation_ft] Total elevation gain, feet.
 */

/**
 * One parsed Orangetheory rower performance block. Distance is meters;
 * splits are "MM:SS" strings.
 * @typedef {Object} OtbeatRower
 * @property {number} distance_m Total rower distance, meters.
 * @property {string} time Total rower time, "MM:SS".
 * @property {number} [avg_watt] Average wattage.
 * @property {number} [max_watt] Max wattage.
 * @property {number} [avg_kmh] Average speed, km/h.
 * @property {number} [max_kmh] Max speed, km/h.
 * @property {string} [split_500m] Average 500m split, "MM:SS".
 * @property {string} [best_split_500m] Best 500m split, "MM:SS".
 * @property {number} [avg_spm] Average stroke rate, strokes/min.
 */

/**
 * One parsed Orangetheory session.
 * @typedef {Object} OtbeatRecord
 * @property {string|null} date Class date, "MM/DD/YYYY" (studio-local).
 * @property {string|null} time Class start time, "9:30AM" (studio-local).
 * @property {string|null} coach Coach name.
 * @property {string|null} studio Studio location, e.g. "Marina Del Rey, CA".
 * @property {{gray:number,blue:number,green:number,orange:number,red:number}|null} zones_min
 *   Minutes spent in each HR zone, or `null` if the block wasn't found.
 * @property {number|null} calories Calories burned.
 * @property {number|null} splat Splat points (minutes in orange + red).
 * @property {number|null} avg_hr Average heart rate, bpm.
 * @property {number|null} peak_hr Peak heart rate, bpm.
 * @property {number|null} steps Step count.
 * @property {OtbeatTreadmill|null} treadmill Treadmill block, `null` if absent.
 * @property {OtbeatRower|null} rower Rower block, `null` if absent.
 */

/**
 * Parse one OTbeat summary email into an {@link OtbeatRecord}.
 *
 * @param {string} html Raw email HTML body (the `text/html` MIME part — the
 *   treadmill/rower stats live only there, not in the plaintext part).
 * @returns {OtbeatRecord} Structured record; nested blocks are `null` when
 *   the class format omits them.
 */
export function parseOtbeatHtml(html) {
  const c = cleanHtml(html)
  /** @type {OtbeatRecord} */
  const rec = {}

  // --- header ---
  const dateM = c.match(/(\d{2}\/\d{2}\/\d{4})/)
  rec.date = dateM ? dateM[1] : null
  const timeM = c.match(/\d{2}\/\d{2}\/\d{4}\s+([\d:]+\s*[AP]M)/)
  rec.time = timeM ? timeM[1].replace(/\s/g, '') : null

  // --- coach + studio ---
  // Header reads: "<studio> <date> <time> <coach> <z0 z1 z2 z3 z4> MINUTES / ZONE".
  const coachM = c.match(
    /\d{2}\/\d{2}\/\d{4}\s+[\d:]+\s*[AP]M\s+([A-Za-z][A-Za-z.'\- ]+?)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+MINUTES\s*\/\s*ZONE/
  )
  rec.coach = coachM ? coachM[1].trim() : null
  const studioM = c.match(/STUDIO WORKOUT SUMMARY\s+(.+?)\s+\d{2}\/\d{2}\/\d{4}/)
  rec.studio = studioM ? studioM[1].trim() : null

  // --- minutes per zone (gray, blue, green, orange, red) ---
  const zm = c.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+MINUTES\s*\/\s*ZONE/)
  rec.zones_min = zm
    ? {
        gray: Number(zm[1]),
        blue: Number(zm[2]),
        green: Number(zm[3]),
        orange: Number(zm[4]),
        red: Number(zm[5]),
      }
    : null

  // --- core stats ---
  rec.calories = num(c, /(\d+)\s+CALORIES BURNED/)
  rec.splat = num(c, /(\d+)\s+SPLAT POINTS/)
  rec.avg_hr = num(c, /(\d+)\s+AVG\. HEART-RATE/)
  rec.peak_hr = num(c, /Peak HR:\s*(\d+)/)
  rec.steps = num(c, /(\d+)\s+STEPS/)

  // --- treadmill block ---
  const t = c.match(
    /TREADMILL PERFORMANCE TOTALS\s*([\d.]+)\s*miles Total Distance\s*([\d:]+)\s*Total Time/
  )
  if (t) {
    /** @type {OtbeatTreadmill} */
    const tread = { distance_mi: Number(t[1]), time: t[2] }
    const sp = c.match(/AVG\. SPEED\s*([\d.]+)\s*mph\s*Max:\s*([\d.]+)/)
    if (sp) {
      tread.avg_mph = Number(sp[1])
      tread.max_mph = Number(sp[2])
    }
    const inc = c.match(/AVG\. INCLINE\s*([\d.]+)\s*%\s*Max:\s*([\d.]+)\s*%/)
    if (inc) {
      tread.avg_incline = Number(inc[1])
      tread.max_incline = Number(inc[2])
    }
    const pa = c.match(/AVG\. PACE\s*([\d:]+)\s*Fastest:\s*([\d:]+)/)
    if (pa) {
      tread.avg_pace = pa[1]
      tread.fastest_pace = pa[2]
    }
    const el = c.match(/ELEVATION\s*([\d.]+)\s*feet/)
    if (el) tread.elevation_ft = Number(el[1])
    rec.treadmill = tread
  } else {
    rec.treadmill = null
  }

  // --- rower block (absent on tread-only class formats) ---
  const r = c.match(/ROWER PERFORMANCE TOTALS\s*(\d+)\s*m Total Distance\s*([\d:]+)\s*Total Time/)
  if (r) {
    /** @type {OtbeatRower} */
    const rower = { distance_m: Number(r[1]), time: r[2] }
    const w = c.match(/AVG\. WATTAGE\s*([\d.]+)\s*watt\s*Max:\s*([\d.]+)/)
    if (w) {
      rower.avg_watt = Number(w[1])
      rower.max_watt = Number(w[2])
    }
    // The rower's "AVG. SPEED" is in km/h; the treadmill's earlier one is in
    // mph, so anchoring on `km/h` skips the treadmill match.
    const rs = c.match(/AVG\. SPEED\s*([\d.]+)\s*km\/h\s*Max:\s*([\d.]+)\s*km\/h/)
    if (rs) {
      rower.avg_kmh = Number(rs[1])
      rower.max_kmh = Number(rs[2])
    }
    const sl = c.match(/500M SPLIT\s*([\d:]+)\s*min\/500m\s*Max:\s*([\d:]+)/)
    if (sl) {
      rower.split_500m = sl[1]
      rower.best_split_500m = sl[2]
    }
    const st = c.match(/AVG\. STROKE RATE\s*([\d.]+)/)
    if (st) rower.avg_spm = Number(st[1])
    rec.rower = rower
  } else {
    rec.rower = null
  }

  return rec
}
