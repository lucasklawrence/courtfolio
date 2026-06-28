/**
 * Tests for the OTbeat email parser (#251).
 *
 * `otbeat-summary-full.txt` is the cleaned text of a real 06/27/2026 summary
 * email (tread + rower), trimmed to the workout-summary window so no
 * unsubscribe/tracking tokens are committed. The parser cleans HTML first,
 * and cleaning is idempotent on already-flat text, so feeding the fixture
 * straight in exercises the same code path a real email would.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// Imported from the plain-`node` .mjs so the test pins the exact module the
// import script runs — no separate TS copy to drift.
import { mmssToSec, parseOtbeatHtml } from './otbeat-parser.mjs'

// Resolved from the repo root (Vitest's cwd); Vite's module transform means
// `import.meta.url` isn't a usable `file:` URL here.
const FULL = readFileSync(path.resolve('scripts/lib/__fixtures__/otbeat-summary-full.txt'), 'utf8')

describe('parseOtbeatHtml', () => {
  it('parses a full session (treadmill + rower) including coach and studio', () => {
    const rec = parseOtbeatHtml(FULL)
    expect(rec.date).toBe('06/27/2026')
    expect(rec.time).toBe('9:30AM')
    expect(rec.coach).toBe('Mara Magistad')
    expect(rec.studio).toBe('Marina Del Rey, CA')
    expect(rec.zones_min).toEqual({ gray: 1, blue: 11, green: 29, orange: 14, red: 1 })
    expect(rec.calories).toBe(776)
    expect(rec.splat).toBe(15)
    expect(rec.avg_hr).toBe(133)
    expect(rec.peak_hr).toBe(164)
    expect(rec.steps).toBe(3508)
    expect(rec.treadmill).toMatchObject({
      distance_mi: 1.09,
      time: '16:44',
      avg_mph: 3.9,
      max_mph: 5.2,
      avg_incline: 8.5,
      max_incline: 13,
      avg_pace: '15:23',
      fastest_pace: '11:32',
      elevation_ft: 489.19,
    })
    expect(rec.rower).toMatchObject({
      distance_m: 2509,
      time: '13:54',
      avg_watt: 178.2,
      max_watt: 321,
      avg_kmh: 15.5,
      max_kmh: 19.1,
      split_500m: '01:56',
      best_split_500m: '01:34',
      avg_spm: 30.2,
    })
  })

  it('returns rower: null on a tread-only class format', () => {
    // Cut everything from the rower block onward — an Endurance/tread-only email.
    const treadOnly = FULL.slice(0, FULL.indexOf('ROWER PERFORMANCE TOTALS'))
    const rec = parseOtbeatHtml(treadOnly)
    expect(rec.rower).toBeNull()
    expect(rec.treadmill).not.toBeNull()
    expect(rec.treadmill?.distance_mi).toBe(1.09)
    expect(rec.coach).toBe('Mara Magistad')
  })

  it('parses the belt-malfunction anomaly without crashing (null blocks)', () => {
    const anomaly =
      'STUDIO WORKOUT SUMMARY Marina Del Rey, CA 05/30/2026 9:30 AM Jacob Buckenmeyer ' +
      '1 0 0 0 0 MINUTES / ZONE 4 CALORIES BURNED 0 SPLAT POINTS 94 AVG. HEART-RATE Peak HR: 95'
    const rec = parseOtbeatHtml(anomaly)
    expect(rec.coach).toBe('Jacob Buckenmeyer')
    expect(rec.zones_min).toEqual({ gray: 1, blue: 0, green: 0, orange: 0, red: 0 })
    expect(rec.calories).toBe(4)
    expect(rec.treadmill).toBeNull()
    expect(rec.rower).toBeNull()
  })

  it('captures multi-token and initial-style coach names', () => {
    const withCoach = (coach: string) =>
      `STUDIO WORKOUT SUMMARY Marina Del Rey, CA 06/20/2026 9:30 AM ${coach} ` +
      '21 10 20 8 0 MINUTES / ZONE 668 CALORIES BURNED'
    expect(parseOtbeatHtml(withCoach('DJ Joseph')).coach).toBe('DJ Joseph')
    expect(parseOtbeatHtml(withCoach('Anastasia McGregor')).coach).toBe('Anastasia McGregor')
  })

  it('treats &nbsp; / &#160; as separators (not deletions) in real HTML', () => {
    // If NBSP were stripped instead of spaced, the header tokens would fuse
    // ("06/27/20269:30AM…") and date/time/coach would fail to match.
    const html =
      'STUDIO WORKOUT SUMMARY Marina Del Rey, CA 06/27/2026&nbsp;9:30&nbsp;AM&nbsp;' +
      'Mara Magistad&#160;1 11 29 14 1 MINUTES / ZONE 776 CALORIES BURNED'
    const rec = parseOtbeatHtml(html)
    expect(rec.date).toBe('06/27/2026')
    expect(rec.time).toBe('9:30AM')
    expect(rec.coach).toBe('Mara Magistad')
  })
})

describe('mmssToSec', () => {
  it('converts MM:SS to seconds', () => {
    expect(mmssToSec('16:44')).toBe(1004)
    expect(mmssToSec('01:56')).toBe(116)
  })

  it('returns null on empty or malformed input', () => {
    expect(mmssToSec('')).toBeNull()
    expect(mmssToSec(null)).toBeNull()
    expect(mmssToSec('nope')).toBeNull()
  })
})
