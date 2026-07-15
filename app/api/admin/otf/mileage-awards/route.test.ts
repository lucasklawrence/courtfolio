import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/otf/mileage-awards` (#321). The auth gate and the
 * Supabase service-role client are mocked; the route's single write ends in
 * `.insert().select().single()`, so the mock resolves that terminal call.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const singleMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  insert: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  single: vi.fn(() => singleMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

const validAward = { label: 'Ultra', miles: 31.1, color: '#EA580C' }

beforeEach(() => {
  requireAdminMock.mockReset()
  singleMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.insert.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.single.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.insert.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.single.mockImplementation(() => singleMock())
  // Happy-path default; individual tests override.
  singleMock.mockResolvedValue({ data: { id: 'a1', ...validAward }, error: null })
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/otf/mileage-awards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/otf/mileage-awards', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(makeRequest(validAward) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest('{ not json') as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when label is missing', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ miles: 13.1 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when miles is not positive', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ label: 'Zero', miles: 0 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 409 when the label already exists', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    singleMock.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'dup' } })
    const res = await POST(makeRequest(validAward) as never)
    expect(res.status).toBe(409)
  })

  it('returns 500 on an unexpected Supabase error', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'XX001', message: 'boom' } })
    const res = await POST(makeRequest(validAward) as never)
    expect(res.status).toBe(500)
  })

  it('returns 201 and inserts the tier on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest(validAward) as never)
    expect(res.status).toBe(201)
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Ultra', miles: 31.1, color: '#EA580C' }),
    )
  })

  it('writes color: null when the color is omitted', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    await POST(makeRequest({ label: 'Marathon', miles: 26.2 }) as never)
    expect(supabaseChain.insert).toHaveBeenCalledWith(expect.objectContaining({ color: null }))
  })
})
