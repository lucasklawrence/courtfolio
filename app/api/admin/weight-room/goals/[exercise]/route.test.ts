import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE } from './route'

/**
 * Tests for `DELETE /api/admin/weight-room/goals/[exercise]`. Auth gate +
 * Supabase service-role client are mocked; the route's own logic
 * (empty-segment guard, 404-vs-200 mapping, trimmed lookup) is
 * exercised in isolation. Next.js App Router decodes path segments
 * before invoking the handler, so the route doesn't re-decode and the
 * tests pass already-decoded values.
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

const ctx = (exercise: string) => ({ params: Promise.resolve({ exercise }) })
const req = () =>
  new Request('http://localhost/api/admin/weight-room/goals/pushups', { method: 'DELETE' })

describe('DELETE /api/admin/weight-room/goals/[exercise]', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await DELETE(req() as never, ctx('pushups'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when exercise is empty after URL-decoding', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE(req() as never, ctx('   '))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no goal exists for exercise', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    deleteMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await DELETE(req() as never, ctx('unknown'))
    expect(res.status).toBe(404)
  })

  it('trims whitespace around the exercise segment before querying', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    deleteMock.mockResolvedValueOnce({
      data: { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
      error: null,
    })
    const res = await DELETE(req() as never, ctx('  pushups  '))
    expect(res.status).toBe(200)
    expect(supabaseChain.eq).toHaveBeenCalledWith('exercise', 'pushups')
  })

  it('does not throw on bare-percent input — trim path is decode-free', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    deleteMock.mockResolvedValueOnce({ data: null, error: null })
    // A bare `%` character would crash an unsafe `decodeURIComponent` call
    // with `URIError`; the route should funnel through to the 404 instead.
    const res = await DELETE(req() as never, ctx('%bad'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with the removed row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const removed = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }
    deleteMock.mockResolvedValueOnce({ data: removed, error: null })
    const res = await DELETE(req() as never, ctx('pushups'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(removed)
  })
})
