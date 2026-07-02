import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_HR } from '@/constants/hr-zones'
import type { CardioSession } from '@/types/cardio'
import type { OtfSession } from '@/types/otf'

import {
  averageOf,
  bandForBpm,
  buildHrZoneComparison,
  observedMaxHr,
} from './hr-zone-comparison'

/** OTF session factory. */
function otf(started_at: string, extra: Partial<OtfSession> = {}): OtfSession {
  return { started_at, ...extra }
}

/** Cardio session factory — stair activity is arbitrary; only HR fields matter here. */
function cardio(date: string, extra: Partial<CardioSession> = {}): CardioSession {
  return { date, activity: 'stair', duration_seconds: 0, ...extra }
}

describe('observedMaxHr', () => {
  it('falls back to the default when no input carries a peak', () => {
    expect(observedMaxHr({})).toEqual({
      maxHr: DEFAULT_MAX_HR,
      source: 'default',
      observedPeak: null,
    })
  })

  it('takes the highest peak across OTF peak_hr and Apple max_hr', () => {
    const result = observedMaxHr({
      otfSessions: [otf('a', { peak_hr: 175 }), otf('b', { peak_hr: 168 })],
      cardioSessions: [cardio('2026-06-01', { max_hr: 150 })],
    })
    expect(result).toEqual({ maxHr: 175, source: 'observed', observedPeak: 175 })
  })

  it('considers raw HR samples that exceed a session max_hr', () => {
    const result = observedMaxHr({
      cardioSessions: [
        cardio('2026-06-01', {
          max_hr: 170,
          hr_samples: [
            { ts: '2026-06-01T00:00:00Z', bpm: 165 },
            { ts: '2026-06-01T00:01:00Z', bpm: 181 },
          ],
        }),
      ],
    })
    expect(result.maxHr).toBe(181)
    expect(result.source).toBe('observed')
  })

  it('ignores non-finite and non-positive candidates', () => {
    const result = observedMaxHr({
      otfSessions: [otf('a', { peak_hr: 0 }), otf('b', { peak_hr: Number.NaN })],
      cardioSessions: [cardio('2026-06-01', { max_hr: -5 })],
    })
    expect(result.source).toBe('default')
    expect(result.observedPeak).toBeNull()
  })
})

describe('buildHrZoneComparison', () => {
  it('projects both systems onto the observed peak and matches the issue #261 tables', () => {
    const otfSessions = [otf('a', { peak_hr: 175 })]
    const cmp = buildHrZoneComparison([], otfSessions)

    expect(cmp.maxHr).toBe(175)
    expect(cmp.maxHrSource).toBe('observed')
    expect(cmp.observedPeak).toBe(175)

    // Apple even bands at 175 — issue #261's table is hand-rounded (70% of 175
    // = 122.5 → 123); the shared bpmRangeForZone helper hits the IEEE-754
    // representation of 122.5 (122.4999…) and rounds to 122. Matching the real
    // helper output rather than the illustrative table.
    expect(cmp.apple.bands.map(b => [b.shortLabel, b.minBpm, b.maxBpm])).toEqual([
      ['Z1', 88, 105],
      ['Z2', 105, 122],
      ['Z3', 122, 140],
      ['Z4', 140, 158],
      ['Z5', 158, 175],
    ])

    // OTF uneven bands at 175 (issue table; blue's 122 same float note as above).
    expect(cmp.otf.bands.map(b => [b.shortLabel, b.minBpm, b.maxBpm])).toEqual([
      ['Gray', 88, 105],
      ['Blue', 107, 122],
      ['Green', 124, 145],
      ['Orange', 147, 159],
      ['Red', 161, 175],
    ])
  })

  it('honors an explicit maxHrOverride over the derived peak', () => {
    const cmp = buildHrZoneComparison([], [otf('a', { peak_hr: 175 })], {
      maxHrOverride: 190,
    })
    expect(cmp.maxHr).toBe(190)
  })

  it('folds Apple seconds and OTF minutes into per-system shares that sum to 1', () => {
    const cardioSessions = [
      cardio('2026-06-01', {
        max_hr: 160,
        hr_seconds_in_zone: { 1: 0, 2: 300, 3: 300, 4: 0, 5: 0 },
      }),
    ]
    const otfSessions = [otf('a', { peak_hr: 170, zones_min: { gray: 5, blue: 10, green: 20, orange: 4, red: 1 } })]

    const cmp = buildHrZoneComparison(cardioSessions, otfSessions)

    expect(cmp.apple.total).toBe(600)
    expect(cmp.apple.unit).toBe('seconds')
    const appleShare = cmp.apple.bands.map(b => b.share)
    expect(appleShare[1]).toBeCloseTo(0.5)
    expect(appleShare[2]).toBeCloseTo(0.5)
    expect(appleShare.reduce((a, b) => a + b, 0)).toBeCloseTo(1)

    expect(cmp.otf.total).toBe(40)
    expect(cmp.otf.unit).toBe('minutes')
    expect(cmp.otf.bands.map(b => b.share).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('gives every band a zero share when a system logged no time', () => {
    const cmp = buildHrZoneComparison([], [], { maxHrOverride: 175 })
    expect(cmp.apple.total).toBe(0)
    expect(cmp.apple.bands.every(b => b.share === 0)).toBe(true)
    expect(cmp.otf.bands.every(b => b.share === 0)).toBe(true)
  })
})

describe('averageOf', () => {
  it('averages only sessions carrying the field', () => {
    const sessions = [otf('a', { peak_hr: 160 }), otf('b', { peak_hr: 164 }), otf('c')]
    expect(averageOf(sessions, 'peak_hr')).toBe(162)
  })

  it('returns null when no session carries the field', () => {
    expect(averageOf([otf('a'), otf('b')], 'avg_hr')).toBeNull()
  })
})

describe('bandForBpm', () => {
  const cmp = buildHrZoneComparison([], [], { maxHrOverride: 175 })

  it('lands an avg OTF peak of 162 in the red zone under both systems', () => {
    expect(bandForBpm(cmp.otf.bands, 162)?.shortLabel).toBe('Red')
    expect(bandForBpm(cmp.apple.bands, 162)?.shortLabel).toBe('Z5')
  })

  it('lands an avg HR of 125 in Z3 (Apple) and green (OTF)', () => {
    expect(bandForBpm(cmp.apple.bands, 125)?.shortLabel).toBe('Z3')
    expect(bandForBpm(cmp.otf.bands, 125)?.shortLabel).toBe('Green')
  })

  it('returns null below the lowest band floor', () => {
    expect(bandForBpm(cmp.apple.bands, 80)).toBeNull()
    expect(bandForBpm(cmp.otf.bands, 80)).toBeNull()
  })
})
