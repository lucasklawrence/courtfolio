import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE, PUT } from './route'

/**
 * Tests for the admin PUT/DELETE handlers (item endpoints). Mirrors the
 * collection-route test setup: auth gate + Supabase service-role client
 * mocked so the handler's own status-code policy is exercised in
 * isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const terminalMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  update: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => terminalMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  terminalMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.update.mockClear()
  supabaseChain.delete.mockClear()
  supabaseChain.eq.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.maybeSingle.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.update.mockReturnValue(supabaseChain)
  supabaseChain.delete.mockReturnValue(supabaseChain)
  supabaseChain.eq.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.maybeSingle.mockImplementation(() => terminalMock())
})

function ctx(date: string): { params: Promise<{ date: string }> } {
  return { params: Promise.resolve({ date }) }
}

function putRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/movement-benchmarks/2026-04-15', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function deleteRequest(): Request {
  return new Request('http://localhost/api/admin/movement-benchmarks/2026-04-15', {
    method: 'DELETE',
  })
}

describe('PUT /api/admin/movement-benchmarks/[date]', () => {
  it('returns 401 when the auth gate rejects', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await PUT(putRequest({ vertical_in: 23 }) as never, ctx('2026-04-15'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a malformed date segment', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await PUT(putRequest({ vertical_in: 23 }) as never, ctx('not-a-date'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await PUT(putRequest('not-json') as never, ctx('2026-04-15'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the payload contains the (forbidden) date field', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await PUT(
      putRequest({ date: '2026-04-15', vertical_in: 23 }) as never,
      ctx('2026-04-15'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when no row matches the date', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    terminalMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await PUT(putRequest({ vertical_in: 23 }) as never, ctx('2026-04-15'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/no benchmark for 2026-04-15/i)
  })

  it('returns 200 with the merged row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const merged = { date: '2026-04-15', vertical_in: 23 }
    terminalMock.mockResolvedValueOnce({ data: merged, error: null })
    const res = await PUT(putRequest({ vertical_in: 23 }) as never, ctx('2026-04-15'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(merged)
    expect(supabaseChain.update).toHaveBeenCalledWith({ vertical_in: 23 })
    expect(supabaseChain.eq).toHaveBeenCalledWith('date', '2026-04-15')
  })

  it('returns 500 on Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    terminalMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection lost' },
    })
    const res = await PUT(putRequest({ vertical_in: 23 }) as never, ctx('2026-04-15'))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/admin/movement-benchmarks/[date]', () => {
  it('returns 401 when the auth gate rejects', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await DELETE(deleteRequest() as never, ctx('2026-04-15'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a malformed date segment', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE(deleteRequest() as never, ctx('not-a-date'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no row matches the date', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    terminalMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await DELETE(deleteRequest() as never, ctx('2026-04-15'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with the removed row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const removed = { date: '2026-04-15', bodyweight_lbs: 232 }
    terminalMock.mockResolvedValueOnce({ data: removed, error: null })
    const res = await DELETE(deleteRequest() as never, ctx('2026-04-15'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(removed)
    expect(supabaseChain.delete).toHaveBeenCalled()
    expect(supabaseChain.eq).toHaveBeenCalledWith('date', '2026-04-15')
  })

  it('returns 500 on Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    terminalMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'fk constraint' },
    })
    const res = await DELETE(deleteRequest() as never, ctx('2026-04-15'))
    expect(res.status).toBe(500)
  })
})
