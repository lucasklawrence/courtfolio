import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE } from './route'

/**
 * Tests for `DELETE /api/admin/weight-room/sets/[id]`. Auth gate and
 * Supabase service-role client are mocked; the route's own logic
 * (UUID guard, 404-vs-200 mapping) is exercised in isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const deleteMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => deleteMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  deleteMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.delete.mockClear()
  supabaseChain.eq.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.maybeSingle.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.delete.mockReturnValue(supabaseChain)
  supabaseChain.eq.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.maybeSingle.mockImplementation(() => deleteMock())
})

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = () =>
  new Request('http://localhost/api/admin/weight-room/sets/x', { method: 'DELETE' })

describe('DELETE /api/admin/weight-room/sets/[id]', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await DELETE(req() as never, ctx('11111111-1111-4111-8111-111111111111'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is not a UUID', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE(req() as never, ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no set exists for id', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    deleteMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await DELETE(req() as never, ctx('11111111-1111-4111-8111-111111111111'))
    expect(res.status).toBe(404)
  })

  it('returns 500 on unexpected Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    deleteMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX001', message: 'connection lost' },
    })
    const res = await DELETE(req() as never, ctx('11111111-1111-4111-8111-111111111111'))
    expect(res.status).toBe(500)
  })

  it('returns 200 with the removed row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const removed = {
      id: '11111111-1111-4111-8111-111111111111',
      logged_at: '2026-05-07T08:00:00Z',
      exercise: 'pushups',
      reps: 25,
    }
    deleteMock.mockResolvedValueOnce({ data: removed, error: null })
    const res = await DELETE(req() as never, ctx(removed.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(removed)
  })
})
