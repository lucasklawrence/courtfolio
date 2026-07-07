import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

/**
 * Tests the Apple Health auto-sync endpoint. Validates API key auth, request
 * parsing, and the table-driven per-metric upsert loop (including the
 * body_mass path added alongside the manual trends endpoint).
 */

// upsertMock is invoked as (table, row) so a test can assert which table each
// write targeted; the endpoint's `supabase.from(table).upsert(row)` forwards
// both. selectEqMock backs the manual-weigh-in lookup
// (`from('cardio_body_mass_trend').select('date').eq('source','manual')`),
// which runs once per request that carries body mass.
const upsertMock = vi.fn()
const selectEqMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: fromMock }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  upsertMock.mockResolvedValue({ error: null })
  selectEqMock.mockResolvedValue({ data: [], error: null })
  fromMock.mockImplementation((table: string) => ({
    upsert: (row: unknown) => upsertMock(table, row),
    select: () => ({ eq: selectEqMock }),
  }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Build a POST request with the given JSON body and (optional) key header. */
function makeRequest(body: unknown, key: string | null = 'valid-key'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key !== null) headers['X-Health-Sync-Key'] = key
  return new Request('http://localhost:3000/api/health/auto-sync', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/health/auto-sync', () => {
  it('returns 401 when the API key is missing', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    const res = await POST(makeRequest({ data: [] }, null) as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the API key is wrong', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'correct-key')
    const res = await POST(makeRequest({ data: [] }, 'wrong-key') as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when the body is invalid JSON', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    const res = await POST(makeRequest('not json {') as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Body must be valid JSON.' })
  })

  it('returns 400 when a date is malformed', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    const res = await POST(makeRequest({ data: [{ date: '2026-7-1', steps: 100 }] }) as any)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Validation failed.')
  })

  it('upserts every present metric — including body_mass — into its table', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    const res = await POST(
      makeRequest({
        data: [
          {
            date: '2026-07-01',
            hrv_ms: 45,
            walking_hr_bpm: 80,
            steps: 9000,
            sleep_hours: 7.5,
            active_energy_kcal: 600,
            body_mass_lbs: 233.8,
          },
        ],
      }) as any
    )
    expect(res.status).toBe(200)
    const tables = upsertMock.mock.calls.map((c) => c[0])
    expect(tables).toEqual([
      'cardio_hrv_trend',
      'cardio_walking_hr_trend',
      'cardio_step_count_trend',
      'cardio_sleep_trend',
      'cardio_active_energy_trend',
      'cardio_body_mass_trend',
    ])
    // body_mass is tagged source='apple_health' (only that table has the
    // column) and stamps updated_at so re-syncing advances imported_at.
    const bodyMassRow = upsertMock.mock.calls.find(
      (c) => c[0] === 'cardio_body_mass_trend'
    )?.[1] as { date: string; value: number; source: string; updated_at: unknown }
    expect(bodyMassRow).toMatchObject({
      date: '2026-07-01',
      value: 233.8,
      source: 'apple_health',
    })
    expect(typeof bodyMassRow.updated_at).toBe('string')
    expect((await res.json()).results).toEqual({
      hrv: 1,
      walking_hr: 1,
      steps: 1,
      sleep: 1,
      active_energy: 1,
      body_mass: 1,
    })
  })

  it('skips null/absent metrics and only upserts what was sent', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    const res = await POST(
      makeRequest({
        data: [{ date: '2026-07-01', steps: 9000, hrv_ms: null }],
      }) as any
    )
    expect(res.status).toBe(200)
    // Only the steps table was touched — null hrv and absent fields skipped.
    expect(upsertMock.mock.calls.map((c) => c[0])).toEqual(['cardio_step_count_trend'])
  })

  it('skips body_mass on days that already have a manual weigh-in', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    // A manual row exists for 2026-07-01 — the scale reading must not clobber it.
    selectEqMock.mockResolvedValue({ data: [{ date: '2026-07-01' }], error: null })
    const res = await POST(
      makeRequest({
        data: [{ date: '2026-07-01', steps: 9000, body_mass_lbs: 240 }],
      }) as any
    )
    expect(res.status).toBe(200)
    // steps still written; body_mass skipped because the day is manual.
    expect(upsertMock.mock.calls.map((c) => c[0])).toEqual(['cardio_step_count_trend'])
    expect((await res.json()).results.body_mass).toBe(0)
  })

  it('returns 500 when a metric upsert fails', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    upsertMock.mockResolvedValueOnce({ error: { message: 'statement timeout' } })
    const res = await POST(makeRequest({ data: [{ date: '2026-07-01', steps: 9000 }] }) as any)
    expect(res.status).toBe(500)
    expect((await res.json()).details[0]).toContain('statement timeout')
  })
})
