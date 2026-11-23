import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE } from './route'

/**
 * Tests for `DELETE /api/admin/weight-room/goals/[exercise]`. Auth gate +
 * Supabase service-role client are mocked; the route's own logic
 * (empty-segment guard, mapping the `delete_weight_room_goal` outcome onto
 * 200 / 404 / 409, trimmed lookup) is exercised in isolation. The guard and
 * the delete themselves run inside that one RPC (#384) — the SQL is the
 * migration's to get right; these pin the contract the route relies on.
 *
 * Next.js App Router decodes path segments before invoking the handler, so
 * the route doesn't re-decode and the tests pass already-decoded values.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const rpcMock = vi.fn((_fn: string, _args: Record<string, unknown>) =>
  Promise.resolve({ data: null as unknown, error: null as unknown })
)
const supabase = {
  rpc: rpcMock,
  // The route must not reach for a table directly any more: a two-call
  // check-then-delete is exactly the race the RPC closes.
  from: vi.fn(() => {
    throw new Error('the goal DELETE must go through delete_weight_room_goal')
  }),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabase,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  rpcMock.mockClear()
  rpcMock.mockResolvedValue({ data: { status: 'not_found' }, error: null })
  supabase.from.mockClear()
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
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 400 when exercise is empty after URL-decoding', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE(req() as never, ctx('   '))
    expect(res.status).toBe(400)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 404 when no goal exists for exercise', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE(req() as never, ctx('unknown'))
    expect(res.status).toBe(404)
  })

  it('trims whitespace and passes a Pacific day key to the RPC', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    rpcMock.mockResolvedValueOnce({
      data: { status: 'deleted', goal: { exercise: 'pushups' } },
      error: null,
    })
    const res = await DELETE(req() as never, ctx('  pushups  '))
    expect(res.status).toBe(200)
    const [fn, args] = rpcMock.mock.calls[0]
    expect(fn).toBe('delete_weight_room_goal')
    expect(args.p_exercise).toBe('pushups')
    expect(args.p_today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not throw on bare-percent input — trim path is decode-free', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    // A bare `%` character would crash an unsafe `decodeURIComponent` call
    // with `URIError`; the route should funnel through to the 404 instead.
    const res = await DELETE(req() as never, ctx('%bad'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with the removed row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const removed = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }
    rpcMock.mockResolvedValueOnce({ data: { status: 'deleted', goal: removed }, error: null })
    const res = await DELETE(req() as never, ctx('pushups'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(removed)
  })

  it('returns 500 when the RPC fails', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'JWT expired' } })
    const res = await DELETE(req() as never, ctx('pushups'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/JWT expired/)
  })

  it('returns 500 rather than guessing on an unrecognised RPC result', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    rpcMock.mockResolvedValueOnce({ data: { status: 'mystery' }, error: null })
    const res = await DELETE(req() as never, ctx('pushups'))
    expect(res.status).toBe(500)
  })

  describe('active-focus guard (#384)', () => {
    beforeEach(() => {
      requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    })

    it('refuses with 409 naming the focus end date when the RPC reports it blocked', async () => {
      rpcMock.mockResolvedValueOnce({
        data: { status: 'blocked', end_date: '2026-08-31' },
        error: null,
      })
      const res = await DELETE(req() as never, ctx('shrugs'))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/2026-08-31/)
    })

    it('never touches a table directly, so the check and delete stay in one transaction', async () => {
      await DELETE(req() as never, ctx('shrugs'))
      expect(supabase.from).not.toHaveBeenCalled()
      expect(rpcMock).toHaveBeenCalledTimes(1)
    })
  })
})
