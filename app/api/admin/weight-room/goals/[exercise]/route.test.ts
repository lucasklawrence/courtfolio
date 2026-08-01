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
const focusMock = vi.fn()
/**
 * Table the most recent `.from()` targeted, so `.maybeSingle()` resolves the
 * right stub. The route reads `weight_room_monthly_focus` first (#384's
 * active-focus guard) and only then deletes from `weight_room_goals`; a single
 * shared result would let the guard consume each test's delete stub.
 */
let lastTable = ''
const supabaseChain = {
  from: vi.fn((table: string) => {
    lastTable = table
    return supabaseChain
  }),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn((_column: string, _value: unknown) => supabaseChain),
  // Typed args so `gte.mock.calls[0]` is a readable tuple rather than `[]`.
  gte: vi.fn((_column: string, _value: string) => supabaseChain),
  order: vi.fn((_column: string, _options?: unknown) => supabaseChain),
  limit: vi.fn((_count: number) => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() =>
    lastTable === 'weight_room_monthly_focus' ? focusMock() : deleteMock(),
  ),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  deleteMock.mockReset()
  focusMock.mockReset()
  lastTable = ''
  supabaseChain.from.mockClear()
  supabaseChain.delete.mockClear()
  supabaseChain.eq.mockClear()
  supabaseChain.gte.mockClear()
  supabaseChain.order.mockClear()
  supabaseChain.limit.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.maybeSingle.mockClear()
  supabaseChain.from.mockImplementation((table: string) => {
    lastTable = table
    return supabaseChain
  })
  supabaseChain.delete.mockReturnValue(supabaseChain)
  supabaseChain.eq.mockReturnValue(supabaseChain)
  supabaseChain.gte.mockReturnValue(supabaseChain)
  supabaseChain.order.mockReturnValue(supabaseChain)
  supabaseChain.limit.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.maybeSingle.mockImplementation(() =>
    lastTable === 'weight_room_monthly_focus' ? focusMock() : deleteMock(),
  )
  // Default: no focus depends on the goal, so the guard waves everything
  // through and the pre-#384 cases read unchanged.
  focusMock.mockResolvedValue({ data: null, error: null })
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

  describe('active-focus guard (#384)', () => {
    beforeEach(() => {
      requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    })

    it('refuses with 409 when a focus still runs through a future date', async () => {
      focusMock.mockResolvedValueOnce({
        data: { start_date: '2026-08-01', end_date: '2026-08-31' },
        error: null,
      })
      const res = await DELETE(req() as never, ctx('shrugs'))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toMatch(/2026-08-31/)
      // The delete must not have run — the goal is still there to fix.
      expect(supabaseChain.delete).not.toHaveBeenCalled()
    })

    it('only blocks on windows that have not ended yet', async () => {
      // The route filters with `.gte('end_date', today)`, so a finished focus
      // never reaches the guard — deleting the goal for a past campaign is
      // fine, and #363's rotation history is exactly what should outlive it.
      deleteMock.mockResolvedValueOnce({ data: { exercise: 'shrugs' }, error: null })
      const res = await DELETE(req() as never, ctx('shrugs'))
      expect(res.status).toBe(200)
      const [column, value] = supabaseChain.gte.mock.calls[0]
      expect(column).toBe('end_date')
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns 500 when the focus lookup itself fails', async () => {
      focusMock.mockResolvedValueOnce({ data: null, error: { message: 'JWT expired' } })
      const res = await DELETE(req() as never, ctx('shrugs'))
      expect(res.status).toBe(500)
      expect(supabaseChain.delete).not.toHaveBeenCalled()
    })
  })
})
