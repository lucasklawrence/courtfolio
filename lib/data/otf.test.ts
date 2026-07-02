import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getOtfData } from './otf'

/**
 * Tests for the OTF data-access wrapper (#256). Mocks
 * `getBrowserSupabaseClient` and tracks the chained `from(...).select().order()`
 * call so each assertion can stub the `otf_sessions` result independently.
 *
 * Sibling pattern: `lib/data/cardio.test.ts`.
 */

interface FakeQuery {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

const queriesByTable: Record<string, FakeQuery> = {}
const fromMock = vi.fn((table: string): FakeQuery => {
  if (!queriesByTable[table]) {
    const query: FakeQuery = { select: vi.fn(), order: vi.fn() }
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
  for (const key of Object.keys(queriesByTable)) delete queriesByTable[key]
  fromMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Stub the `otf_sessions` query result. See the cardio test for the tautology gotcha around `fromMock.mockClear()`. */
function stubSessions(data: Array<Record<string, unknown>> | null, error: unknown = null): void {
  const query = fromMock('otf_sessions')
  query.order.mockReset()
  query.order.mockResolvedValue({ data, error })
}

const FULL_ROW = {
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
  updated_at: '2026-06-30T07:53:00+00:00',
}

describe('getOtfData', () => {
  it('returns null when otf_sessions is empty', async () => {
    stubSessions([])
    fromMock.mockClear()
    await expect(getOtfData()).resolves.toBeNull()
    expect(fromMock).toHaveBeenCalledWith('otf_sessions')
  })

  it('orders sessions by started_at ascending', async () => {
    stubSessions([])
    await getOtfData()
    expect(queriesByTable.otf_sessions.order).toHaveBeenCalledWith('started_at', {
      ascending: true,
    })
  })

  it('assembles OtfData and folds zone columns into zones_min', async () => {
    stubSessions([FULL_ROW])
    const data = await getOtfData()
    expect(data).toEqual({
      imported_at: '2026-06-30T07:53:00+00:00',
      sessions: [
        {
          started_at: '2026-06-27T16:30:00+00:00',
          coach: 'Mara Magistad',
          studio: 'Marina Del Rey, CA',
          calories: 776,
          splat: 15,
          steps: 3508,
          avg_hr: 133,
          peak_hr: 164,
          zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
          treadmill: { distance_mi: 1.09, time: '16:44', avg_mph: 3.9 },
          rower: { distance_m: 2509, time: '13:54', avg_spm: 30.2 },
        },
      ],
    })
  })

  it('omits zones_min / treadmill / rower when null (belt-malfunction anomaly)', async () => {
    stubSessions([
      {
        started_at: '2026-05-30T16:30:00+00:00',
        coach: 'Jacob Buckenmeyer',
        studio: 'Marina Del Rey, CA',
        calories: 4,
        splat: 0,
        steps: null,
        avg_hr: 94,
        peak_hr: 95,
        zone_gray_min: null,
        zone_blue_min: null,
        zone_green_min: null,
        zone_orange_min: null,
        zone_red_min: null,
        treadmill: null,
        rower: null,
        updated_at: '2026-05-30T17:00:00+00:00',
      },
    ])
    const data = await getOtfData()
    expect(data?.sessions[0]).not.toHaveProperty('zones_min')
    expect(data?.sessions[0]).not.toHaveProperty('treadmill')
    expect(data?.sessions[0]).not.toHaveProperty('rower')
    expect(data?.sessions[0]).not.toHaveProperty('steps')
    expect(data?.sessions[0]).toEqual({
      started_at: '2026-05-30T16:30:00+00:00',
      coach: 'Jacob Buckenmeyer',
      studio: 'Marina Del Rey, CA',
      calories: 4,
      splat: 0,
      avg_hr: 94,
      peak_hr: 95,
    })
  })

  it('passes the excluded flag + reason through to the session (#268)', async () => {
    stubSessions([
      {
        started_at: '2026-05-30T16:30:00+00:00',
        coach: 'Jacob Buckenmeyer',
        calories: 4,
        splat: 0,
        excluded: true,
        excluded_reason: 'auto: near-zero output with no treadmill or rower block',
        updated_at: '2026-05-30T17:00:00+00:00',
      },
    ])
    const data = await getOtfData()
    expect(data?.sessions[0].excluded).toBe(true)
    expect(data?.sessions[0].excluded_reason).toMatch(/near-zero output/)
  })

  it('takes imported_at from the latest updated_at', async () => {
    stubSessions([
      {
        ...FULL_ROW,
        started_at: '2026-06-01T00:00:00+00:00',
        updated_at: '2026-06-01T00:00:00+00:00',
      },
      {
        ...FULL_ROW,
        started_at: '2026-06-27T16:30:00+00:00',
        updated_at: '2026-06-30T07:53:00+00:00',
      },
    ])
    const data = await getOtfData()
    expect(data?.imported_at).toBe('2026-06-30T07:53:00+00:00')
  })

  it('throws a descriptive error when the query fails', async () => {
    stubSessions(null, { message: 'JWT expired' })
    await expect(getOtfData()).rejects.toThrow(/Failed to load OTF sessions: JWT expired/)
  })

  it('throws when a row fails schema validation (unknown column)', async () => {
    stubSessions([{ ...FULL_ROW, bogus_col: 1 }])
    await expect(getOtfData()).rejects.toThrow(/otf_sessions failed schema validation/)
  })
})
