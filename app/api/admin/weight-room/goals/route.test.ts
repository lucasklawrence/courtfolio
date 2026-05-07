import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/weight-room/goals`. Auth gate + Supabase
 * service-role client are mocked; the route's own logic (JSON parsing,
 * Zod validation, hex-color enforcement, upsert success path) is
 * exercised in isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const upsertMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  upsert: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  single: vi.fn(() => upsertMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  upsertMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.upsert.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.single.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.upsert.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.single.mockImplementation(() => upsertMock())
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/weight-room/goals', () => {
  const validGoal = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }

  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when color is not a hex string', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(
      makeRequest({ exercise: 'pushups', daily_target: 100, color: 'orange' }) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation failed/i)
  })

  it('rejects unknown extra fields via Zod .strict()', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validGoal, sneaky: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on unexpected Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX001', message: 'data corruption' },
    })
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(500)
  })

  it('returns 200 with the upserted row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    upsertMock.mockResolvedValueOnce({ data: validGoal, error: null })
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(validGoal)
    expect(supabaseChain.upsert).toHaveBeenCalledWith(validGoal, { onConflict: 'exercise' })
  })
})
