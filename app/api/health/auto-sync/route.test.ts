import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

/**
 * Tests the Apple Health auto-sync endpoint. Validates API key auth, request
 * parsing, and the table-driven per-metric upsert loop (including the
 * body_mass path added alongside the manual trends endpoint).
 */

const upsertMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: fromMock }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  upsertMock.mockResolvedValue({ error: null })
  fromMock.mockReturnValue({ upsert: upsertMock })
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
    const tables = fromMock.mock.calls.map((c) => c[0])
    expect(tables).toEqual([
      'cardio_hrv_trend',
      'cardio_walking_hr_trend',
      'cardio_step_count_trend',
      'cardio_sleep_trend',
      'cardio_active_energy_trend',
      'cardio_body_mass_trend',
    ])
    expect(upsertMock).toHaveBeenCalledWith({ date: '2026-07-01', value: 233.8 })
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
    expect(fromMock.mock.calls.map((c) => c[0])).toEqual(['cardio_step_count_trend'])
  })

  it('returns 500 when a metric upsert fails', async () => {
    vi.stubEnv('HEALTH_AUTO_SYNC_API_KEY', 'valid-key')
    upsertMock.mockResolvedValueOnce({ error: { message: 'statement timeout' } })
    const res = await POST(makeRequest({ data: [{ date: '2026-07-01', steps: 9000 }] }) as any)
    expect(res.status).toBe(500)
    expect((await res.json()).details[0]).toContain('statement timeout')
  })
})
