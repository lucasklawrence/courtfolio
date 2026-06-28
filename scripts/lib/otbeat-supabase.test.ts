/**
 * Tests for the OTbeat Supabase mapping + append-only upsert (#251).
 *
 * Focus is the risky logic: the timezone/DST conversion that builds
 * `started_at`, and the dedupe-by-`started_at` guarantee that makes the
 * weekly re-pull idempotent and never prunes history. The Supabase client is
 * faked so no network/credentials are needed.
 */
import { describe, expect, it } from 'vitest'

import { recordToRow, toStartedAt, upsertOtfSessions } from './otbeat-supabase.mjs'

const TZ = 'America/Los_Angeles'

describe('toStartedAt', () => {
  it('interprets the wall time in Pacific DAYLIGHT time (summer, -07:00)', () => {
    expect(toStartedAt('06/27/2026', '9:30AM', TZ)).toBe('2026-06-27T16:30:00.000Z')
  })

  it('interprets the wall time in Pacific STANDARD time (winter, -08:00)', () => {
    // Same wall clock, different offset — proves DST is handled, not hardcoded.
    expect(toStartedAt('01/15/2026', '9:30AM', TZ)).toBe('2026-01-15T17:30:00.000Z')
  })

  it('handles PM times that roll over to the next UTC day', () => {
    expect(toStartedAt('06/27/2026', '6:45PM', TZ)).toBe('2026-06-28T01:45:00.000Z')
  })

  it('handles 12-hour noon/midnight edges', () => {
    expect(toStartedAt('06/27/2026', '12:00PM', TZ)).toBe('2026-06-27T19:00:00.000Z')
    expect(toStartedAt('06/27/2026', '12:30AM', TZ)).toBe('2026-06-27T07:30:00.000Z')
  })

  it('throws on unparseable date/time', () => {
    expect(() => toStartedAt('2026-06-27', '9:30AM', TZ)).toThrow(/date/)
    expect(() => toStartedAt('06/27/2026', '0930', TZ)).toThrow(/time/)
  })
})

describe('recordToRow', () => {
  it('maps zone minutes to explicit columns and passes blocks through as JSONB', () => {
    const row = recordToRow(
      {
        date: '06/27/2026',
        time: '9:30AM',
        coach: 'Mara Magistad',
        studio: 'Marina Del Rey, CA',
        zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
        calories: 776,
        splat: 15,
        avg_hr: 133,
        peak_hr: 164,
        steps: 3508,
        treadmill: { distance_mi: 1.09 },
        rower: { distance_m: 2509 },
      },
      TZ
    )
    expect(row).toMatchObject({
      started_at: '2026-06-27T16:30:00.000Z',
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
      treadmill: { distance_mi: 1.09 },
      rower: { distance_m: 2509 },
    })
  })

  it('nulls out missing zones / blocks', () => {
    const row = recordToRow(
      { date: '05/30/2026', time: '9:30AM', zones_min: null, treadmill: null, rower: null },
      TZ
    )
    expect(row.zone_gray_min).toBeNull()
    expect(row.treadmill).toBeNull()
    expect(row.rower).toBeNull()
  })
})

/**
 * Minimal stand-in for the supabase-js client: `from().select()` resolves to
 * the seeded existing keys; `from().upsert()` records what was written.
 */
function fakeClient(existingStartedAt) {
  const inserted = []
  const client = {
    from() {
      return {
        select: async () => ({
          data: existingStartedAt.map(s => ({ started_at: s })),
          error: null,
        }),
        upsert: async rows => {
          inserted.push(...rows)
          return { error: null }
        },
      }
    },
    inserted,
  }
  return client
}

describe('upsertOtfSessions (append-only)', () => {
  const recA = { date: '06/27/2026', time: '9:30AM', zones_min: null, treadmill: null, rower: null }
  const recB = { date: '06/25/2026', time: '6:45PM', zones_min: null, treadmill: null, rower: null }

  it('inserts only sessions whose started_at is not already present', async () => {
    // recA already in the table; recB is new.
    const client = fakeClient(['2026-06-27T16:30:00+00:00'])
    const summary = await upsertOtfSessions(client, [recA, recB], { timeZone: TZ })
    expect(summary).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(client.inserted).toHaveLength(1)
    expect(client.inserted[0].started_at).toBe('2026-06-26T01:45:00.000Z') // recB (06/25 6:45PM PDT)
  })

  it('is idempotent — a re-pull with everything present adds 0 and writes nothing', async () => {
    const client = fakeClient(['2026-06-27T16:30:00+00:00', '2026-06-26T01:45:00+00:00'])
    const summary = await upsertOtfSessions(client, [recA, recB], { timeZone: TZ })
    expect(summary).toEqual({ added: 0, skipped: 2, total: 2 })
    expect(client.inserted).toHaveLength(0)
  })

  it('dedupes duplicates within a single batch', async () => {
    const client = fakeClient([])
    const summary = await upsertOtfSessions(client, [recA, recA], { timeZone: TZ })
    expect(summary.added).toBe(1)
    expect(client.inserted).toHaveLength(1)
  })
})
