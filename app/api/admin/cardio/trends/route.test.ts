import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

/**
 * Tests the cardio lifestyle-trend upsert endpoint.
 * Validates API key auth, request parsing, schema validation, and Supabase upserts.
 */

const upsertMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: fromMock,
  }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  // Default: successful upsert
  selectMock.mockResolvedValue({
    error: null,
    data: [{ date: '2026-07-01', value: 233.8 }],
  })
  upsertMock.mockReturnValue({ select: selectMock })
  fromMock.mockReturnValue({ upsert: upsertMock })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/admin/cardio/trends', () => {
  it('returns 401 when API key is missing', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key-123')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized.' })
  })

  it('returns 401 when API key is wrong', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'correct-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'wrong-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid JSON', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: 'not valid json {',
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Body must be valid JSON.' })
  })

  it('returns 400 when date format is invalid', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-7-1', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed.')
  })

  it('returns 400 when metric is unknown', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'unknown_metric', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed.')
  })

  it('returns 400 when value is negative', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: -100 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when value is 0 for a strictly-positive metric (body_mass)', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 0 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Validation failed.')
  })

  it('allows value 0 for a volume metric (steps)', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'steps', value: 0 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('cardio_step_count_trend')
  })

  it('returns 200 and upserts body_mass when valid', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('cardio_body_mass_trend')
    // Payload carries the value, an explicit updated_at stamp (the tables have
    // no update trigger, so a re-log must bump it for imported_at), and
    // source='manual' so the full Apple Health import never overwrites it.
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-07-01', value: 233.8, source: 'manual' })
    )
    expect(typeof upsertMock.mock.calls[0][0].updated_at).toBe('string')
    const body = await res.json()
    expect(body.message).toContain('body_mass for 2026-07-01 upserted successfully')
  })

  it('returns 200 and upserts hrv when valid', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-02', metric: 'hrv', value: 45.2 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('cardio_hrv_trend')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-07-02', value: 45.2 })
    )
    // The manual-source tag is scoped to body mass — hrv has no source column.
    expect(upsertMock.mock.calls[0][0]).not.toHaveProperty('source')
  })

  it('returns 500 when database upsert fails', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', 'valid-key')
    selectMock.mockResolvedValueOnce({
      error: { message: 'Unique constraint violation' },
      data: null,
    })
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'valid-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Database error')
  })

  it('returns 401 when CARDIO_TRENDS_API_KEY env var is not set', async () => {
    vi.stubEnv('CARDIO_TRENDS_API_KEY', '')
    const req = new Request('http://localhost:3000/api/admin/cardio/trends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cardio-Trends-Key': 'any-key',
      },
      body: JSON.stringify({ date: '2026-07-01', metric: 'body_mass', value: 233.8 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })
})
