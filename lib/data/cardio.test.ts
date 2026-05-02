import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import { getCardioData } from './cardio'

/**
 * Tests for the cardio data-access wrapper after the Supabase migration
 * (#152). Reads now hit three tables in parallel — the test mocks
 * `getBrowserSupabaseClient` and tracks which table each chained call
 * targets so each assertion can stub a per-table result independently.
 *
 * Sibling pattern: `lib/data/movement.test.ts`.
 */

interface FakeQuery {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

const queriesByTable: Record<string, FakeQuery> = {}
const fromMock = vi.fn((table: string): FakeQuery => {
  if (!queriesByTable[table]) {
    const query: FakeQuery = {
      select: vi.fn(),
      order: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.order.mockResolvedValue({ data: [], error: null })
    queriesByTable[table] = query
  }
  return queriesByTable[table]
})
const browserClientMock = { from: fromMock }

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserSupabaseClient: () => browserClientMock,
}))

beforeEach(() => {
  for (const key of Object.keys(queriesByTable)) {
    delete queriesByTable[key]
  }
  fromMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Pre-stub a query result for one of the three cardio tables.
 *
 * Calls `fromMock(table)` to lazily build the per-table query stub,
 * which means each `stubTable` call records a `fromMock.toHaveBeenCalledWith(...)`
 * invocation. Tests that need to assert "the data layer queried table X"
 * must call `fromMock.mockClear()` between `stubTable` setup and the
 * assertion, otherwise the assertion is a tautology.
 */
function stubTable(table: string, data: Array<Record<string, unknown>> | null, error: unknown = null): void {
  const query = fromMock(table)
  query.order.mockReset()
  query.order.mockResolvedValue({ data, error })
}

describe('getCardioData', () => {
  it('returns null when all three cardio tables are empty', async () => {
    stubTable('cardio_sessions', [])
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', [])
    // `stubTable` calls `fromMock(table)` to lazily create the chain
    // stubs, so without this clear the next assertion is a tautology
    // (it'd pass even if `getCardioData` never ran).
    fromMock.mockClear()

    await expect(getCardioData()).resolves.toBeNull()

    expect(fromMock).toHaveBeenCalledWith('cardio_sessions')
    expect(fromMock).toHaveBeenCalledWith('cardio_resting_hr')
    expect(fromMock).toHaveBeenCalledWith('cardio_vo2max')
  })

  it('orders sessions by started_at ascending and trends by date ascending', async () => {
    stubTable('cardio_sessions', [])
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', [])
    await getCardioData()

    expect(queriesByTable.cardio_sessions.order).toHaveBeenCalledWith('started_at', {
      ascending: true,
    })
    expect(queriesByTable.cardio_resting_hr.order).toHaveBeenCalledWith('date', {
      ascending: true,
    })
    expect(queriesByTable.cardio_vo2max.order).toHaveBeenCalledWith('date', {
      ascending: true,
    })
  })

  it('assembles the legacy CardioData shape and reconstructs hr_seconds_in_zone', async () => {
    stubTable(
      'cardio_sessions',
      [
        {
          started_at: '2026-04-26T08:00:00Z',
          activity: 'stair',
          duration_seconds: 1980,
          distance_meters: null,
          avg_hr: 158,
          max_hr: 178,
          pace_seconds_per_km: null,
          zone1_seconds: 10,
          zone2_seconds: 280,
          zone3_seconds: 740,
          zone4_seconds: 680,
          zone5_seconds: 270,
          meters_per_heartbeat: null,
          updated_at: '2026-04-26T08:30:00Z',
        },
      ],
    )
    stubTable(
      'cardio_resting_hr',
      [{ date: '2026-04-26', value: 57, updated_at: '2026-04-26T08:30:00Z' }],
    )
    stubTable(
      'cardio_vo2max',
      [{ date: '2026-04-26', value: 43.4, updated_at: '2026-04-26T08:30:00Z' }],
    )

    const data = await getCardioData()
    expect(data).toEqual({
      imported_at: '2026-04-26T08:30:00Z',
      sessions: [
        {
          date: '2026-04-26T08:00:00Z',
          activity: 'stair',
          duration_seconds: 1980,
          avg_hr: 158,
          max_hr: 178,
          hr_seconds_in_zone: { 1: 10, 2: 280, 3: 740, 4: 680, 5: 270 },
        },
      ],
      resting_hr_trend: [{ date: '2026-04-26', value: 57 }],
      vo2max_trend: [{ date: '2026-04-26', value: 43.4 }],
    })
  })

  it('omits hr_seconds_in_zone when every zone column is null (Apple Watch off)', async () => {
    stubTable(
      'cardio_sessions',
      [
        {
          started_at: '2026-04-21T07:00:00Z',
          activity: 'walking',
          duration_seconds: 1800,
          distance_meters: 2400,
          avg_hr: null,
          max_hr: null,
          pace_seconds_per_km: 750,
          zone1_seconds: null,
          zone2_seconds: null,
          zone3_seconds: null,
          zone4_seconds: null,
          zone5_seconds: null,
          meters_per_heartbeat: null,
          updated_at: '2026-04-21T07:30:00Z',
        },
      ],
    )
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', [])

    const data = await getCardioData()
    expect(data?.sessions[0]).not.toHaveProperty('hr_seconds_in_zone')
    expect(data?.sessions[0]).toEqual({
      date: '2026-04-21T07:00:00Z',
      activity: 'walking',
      duration_seconds: 1800,
      distance_meters: 2400,
      pace_seconds_per_km: 750,
    })
  })

  it('takes imported_at from the latest updated_at across all three tables', async () => {
    // Re-import advances `updated_at` on every upserted row even when
    // nothing changed (the import script writes `updated_at = now()` on
    // each upsert payload). `created_at` is frozen at first-insert and
    // would go stale, so the data layer reads `updated_at`.
    stubTable(
      'cardio_sessions',
      [
        {
          started_at: '2026-02-08T08:00:00Z',
          activity: 'stair',
          duration_seconds: 1440,
          distance_meters: null,
          avg_hr: null,
          max_hr: null,
          pace_seconds_per_km: null,
          zone1_seconds: null,
          zone2_seconds: null,
          zone3_seconds: null,
          zone4_seconds: null,
          zone5_seconds: null,
          meters_per_heartbeat: null,
          updated_at: '2026-02-08T09:00:00Z',
        },
      ],
    )
    stubTable(
      'cardio_resting_hr',
      [{ date: '2026-04-26', value: 57, updated_at: '2026-04-26T08:30:00Z' }],
    )
    stubTable(
      'cardio_vo2max',
      [{ date: '2026-03-01', value: 42, updated_at: '2026-03-01T09:00:00Z' }],
    )

    const data = await getCardioData()
    expect(data?.imported_at).toBe('2026-04-26T08:30:00Z')
  })

  it('throws a descriptive error when the sessions query fails', async () => {
    stubTable('cardio_sessions', null, { message: 'JWT expired' })
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', [])
    await expect(getCardioData()).rejects.toThrow(/JWT expired/)
  })

  it('throws a descriptive error when the resting-HR query fails', async () => {
    stubTable('cardio_sessions', [])
    stubTable('cardio_resting_hr', null, { message: 'permission denied' })
    stubTable('cardio_vo2max', [])
    await expect(getCardioData()).rejects.toThrow(/permission denied/)
  })

  it('throws a descriptive error when the VO2max query fails', async () => {
    stubTable('cardio_sessions', [])
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', null, { message: 'connection reset' })
    await expect(getCardioData()).rejects.toThrow(/connection reset/)
  })

  it('throws when a row fails schema validation (e.g. unknown activity)', async () => {
    stubTable(
      'cardio_sessions',
      [
        {
          started_at: '2026-04-26T08:00:00Z',
          activity: 'cycling', // not in the enum — Zod rejects.
          duration_seconds: 1200,
          distance_meters: null,
          avg_hr: null,
          max_hr: null,
          pace_seconds_per_km: null,
          zone1_seconds: null,
          zone2_seconds: null,
          zone3_seconds: null,
          zone4_seconds: null,
          zone5_seconds: null,
          meters_per_heartbeat: null,
          updated_at: '2026-04-26T08:30:00Z',
        },
      ],
    )
    stubTable('cardio_resting_hr', [])
    stubTable('cardio_vo2max', [])
    await expect(getCardioData()).rejects.toThrow(/cardio_sessions failed schema validation/)
  })
})
