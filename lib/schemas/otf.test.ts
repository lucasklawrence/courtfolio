import { describe, expect, it } from 'vitest'

import { OtfSessionRowSchema, otfRowToSession } from './otf'

/**
 * Tests for the OTF row schema + row→session mapper (#256). Sibling pattern:
 * `lib/schemas/cardio.test.ts`.
 */

describe('OtfSessionRowSchema', () => {
  it('accepts a full row', () => {
    const row = {
      started_at: '2026-06-27T16:30:00+00:00',
      coach: 'Mara Magistad',
      studio: 'Marina Del Rey, CA',
      calories: 776,
      splat: 15,
      steps: 3508,
      avg_hr: 133,
      peak_hr: 164,
      zone_gray_min: 1,
      zone_blue_min: 11,
      zone_green_min: 29,
      zone_orange_min: 14,
      zone_red_min: 1,
      treadmill: { distance_mi: 1.09, time: '16:44', avg_mph: 3.9 },
      rower: { distance_m: 2509, time: '13:54', avg_spm: 30.2 },
    }
    expect(OtfSessionRowSchema.safeParse(row).success).toBe(true)
  })

  it('accepts a minimal row (started_at only)', () => {
    expect(OtfSessionRowSchema.safeParse({ started_at: '2026-06-27T16:30:00+00:00' }).success).toBe(
      true
    )
  })

  it('rejects an unknown column (.strict)', () => {
    expect(
      OtfSessionRowSchema.safeParse({ started_at: '2026-06-27T16:30:00+00:00', bogus: 1 }).success
    ).toBe(false)
  })

  it('rejects a negative numeric', () => {
    expect(
      OtfSessionRowSchema.safeParse({ started_at: '2026-06-27T16:30:00+00:00', calories: -1 })
        .success
    ).toBe(false)
  })

  it('rejects an empty started_at', () => {
    expect(OtfSessionRowSchema.safeParse({ started_at: '' }).success).toBe(false)
  })
})

describe('otfRowToSession', () => {
  it('folds the zone columns into zones_min and passes the jsonb blocks through', () => {
    const session = otfRowToSession({
      started_at: '2026-06-27T16:30:00+00:00',
      coach: 'Mara Magistad',
      zone_gray_min: 1,
      zone_blue_min: 11,
      zone_green_min: 29,
      zone_orange_min: 14,
      zone_red_min: 1,
      treadmill: { distance_mi: 1.09, time: '16:44' },
    })
    expect(session).toEqual({
      started_at: '2026-06-27T16:30:00+00:00',
      coach: 'Mara Magistad',
      zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
      treadmill: { distance_mi: 1.09, time: '16:44' },
    })
  })

  it('omits zones_min when no zone column is present', () => {
    const session = otfRowToSession({ started_at: '2026-05-30T16:30:00+00:00', calories: 4 })
    expect(session).not.toHaveProperty('zones_min')
    expect(session).toEqual({ started_at: '2026-05-30T16:30:00+00:00', calories: 4 })
  })

  it('defaults missing zones to 0 when at least one is present', () => {
    const session = otfRowToSession({ started_at: '2026-06-27T16:30:00+00:00', zone_orange_min: 5 })
    expect(session.zones_min).toEqual({ gray: 0, blue: 0, green: 0, orange: 5, red: 0 })
  })
})
