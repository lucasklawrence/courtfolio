import { describe, it, expect } from 'vitest'

import {
  CardioSessionRowSchema,
  CardioTrendRowSchema,
  cardioSessionToRow,
  sessionRowToCardioSession,
  trendRowToTimePoint,
} from './cardio'

/**
 * Tests for the Zod schemas and bidirectional transforms that bridge
 * the legacy `CardioData` JSON shape (nested `hr_seconds_in_zone` map)
 * and the Supabase row shape (5 explicit zone columns) introduced in
 * #152.
 */

describe('CardioSessionRowSchema', () => {
  it('accepts a fully-populated session row', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair' as const,
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      zone1_seconds: 10,
      zone2_seconds: 280,
      zone3_seconds: 740,
      zone4_seconds: 680,
      zone5_seconds: 270,
    }
    expect(CardioSessionRowSchema.safeParse(row).success).toBe(true)
  })

  it('accepts a session row with only required fields', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'walking' as const,
      duration_seconds: 1800,
    }
    expect(CardioSessionRowSchema.safeParse(row).success).toBe(true)
  })

  it('rejects an unknown activity value', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'cycling',
      duration_seconds: 1200,
    }
    const result = CardioSessionRowSchema.safeParse(row)
    expect(result.success).toBe(false)
  })

  it('rejects a negative duration', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair' as const,
      duration_seconds: -1,
    }
    expect(CardioSessionRowSchema.safeParse(row).success).toBe(false)
  })

  it('rejects unknown columns (strict)', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair' as const,
      duration_seconds: 1200,
      // Typo / drift — schema should reject so a stale write doesn't
      // silently land in the DB.
      bogus_column: 42,
    }
    expect(CardioSessionRowSchema.safeParse(row).success).toBe(false)
  })
})

describe('CardioTrendRowSchema', () => {
  it('accepts a YYYY-MM-DD date and numeric value', () => {
    expect(
      CardioTrendRowSchema.safeParse({ date: '2026-04-26', value: 57 }).success,
    ).toBe(true)
  })

  it('rejects an ISO timestamp in the date field', () => {
    expect(
      CardioTrendRowSchema.safeParse({
        date: '2026-04-26T08:00:00Z',
        value: 57,
      }).success,
    ).toBe(false)
  })
})

describe('sessionRowToCardioSession', () => {
  it('reconstructs the nested hr_seconds_in_zone map from 5 columns', () => {
    const row = {
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair' as const,
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      zone1_seconds: 10,
      zone2_seconds: 280,
      zone3_seconds: 740,
      zone4_seconds: 680,
      zone5_seconds: 270,
    }
    expect(sessionRowToCardioSession(row)).toEqual({
      date: '2026-04-26T08:00:00Z',
      activity: 'stair',
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      hr_seconds_in_zone: { 1: 10, 2: 280, 3: 740, 4: 680, 5: 270 },
    })
  })

  it('omits hr_seconds_in_zone when every zone column is undefined', () => {
    const session = sessionRowToCardioSession({
      started_at: '2026-04-21T07:00:00Z',
      activity: 'walking',
      duration_seconds: 1800,
      distance_meters: 2400,
      pace_seconds_per_km: 750,
    })
    expect(session).not.toHaveProperty('hr_seconds_in_zone')
    expect(session).toEqual({
      date: '2026-04-21T07:00:00Z',
      activity: 'walking',
      duration_seconds: 1800,
      distance_meters: 2400,
      pace_seconds_per_km: 750,
    })
  })

  it('fills missing zones with 0 when at least one zone is present', () => {
    // A glitched session where Apple Watch only logged time in Z3 — the
    // dashboard should still see explicit zeros for the other four
    // zones so the bar chart renders four empty bars rather than
    // collapsing to one.
    const session = sessionRowToCardioSession({
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair',
      duration_seconds: 1980,
      zone3_seconds: 740,
    })
    expect(session.hr_seconds_in_zone).toEqual({ 1: 0, 2: 0, 3: 740, 4: 0, 5: 0 })
  })
})

describe('cardioSessionToRow', () => {
  it('flattens hr_seconds_in_zone into 5 explicit columns', () => {
    const row = cardioSessionToRow({
      date: '2026-04-26T08:00:00Z',
      activity: 'stair',
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      hr_seconds_in_zone: { '1': 10, '2': 280, '3': 740, '4': 680, '5': 270 },
    })
    expect(row).toMatchObject({
      started_at: '2026-04-26T08:00:00Z',
      activity: 'stair',
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      zone1_seconds: 10,
      zone2_seconds: 280,
      zone3_seconds: 740,
      zone4_seconds: 680,
      zone5_seconds: 270,
    })
  })

  it('emits null for absent zone fields so re-imports clear stale values', () => {
    const row = cardioSessionToRow({
      date: '2026-04-21T07:00:00Z',
      activity: 'walking',
      duration_seconds: 1800,
      distance_meters: 2400,
      pace_seconds_per_km: 750,
    })
    // hr_seconds_in_zone absent → all 5 zone columns serialize to null,
    // so a re-upsert of a session whose Apple Watch data was later
    // removed clears the old zone values rather than leaving stale
    // numbers behind.
    expect(row).toMatchObject({
      zone1_seconds: null,
      zone2_seconds: null,
      zone3_seconds: null,
      zone4_seconds: null,
      zone5_seconds: null,
      avg_hr: null,
      max_hr: null,
    })
  })

  it('round-trips a session through cardioSessionToRow → sessionRowToCardioSession', () => {
    const original = {
      date: '2026-04-26T08:00:00Z',
      activity: 'stair' as const,
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      hr_seconds_in_zone: { '1': 10, '2': 280, '3': 740, '4': 680, '5': 270 },
    }
    const row = cardioSessionToRow(original)
    // Strip nulls to mirror the data layer's `stripNulls()` step before
    // Zod validation.
    const stripped: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v !== null) stripped[k] = v
    }
    const parsed = CardioSessionRowSchema.parse(stripped)
    const session = sessionRowToCardioSession(parsed)
    expect(session).toEqual({
      date: '2026-04-26T08:00:00Z',
      activity: 'stair',
      duration_seconds: 1980,
      avg_hr: 158,
      max_hr: 178,
      hr_seconds_in_zone: { 1: 10, 2: 280, 3: 740, 4: 680, 5: 270 },
    })
  })
})

describe('trendRowToTimePoint', () => {
  it('passes through the typed shape', () => {
    expect(trendRowToTimePoint({ date: '2026-04-26', value: 57 })).toEqual({
      date: '2026-04-26',
      value: 57,
    })
  })
})
