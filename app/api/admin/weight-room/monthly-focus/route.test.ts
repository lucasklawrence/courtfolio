import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/weight-room/monthly-focus` (#255). Auth gate
 * + Supabase service-role client are mocked. The route provisions the
 * movement catalog (an `.upsert()` on `weight_room_exercises`), then makes
 * one `create_weight_room_monthly_focus` RPC that anchors the goal and
 * inserts the focus in a single transaction (#384).
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const catalogUpsertResultMock = vi.fn()
const rpcMock = vi.fn((_fn: string, _args: Record<string, unknown>) =>
  Promise.resolve({ data: null as unknown, error: null as unknown })
)
/** Every call, in order, so tests can assert the catalog lands before the RPC. */
const calls: string[] = []
const supabaseChain = {
  from: vi.fn((table: string) => {
    calls.push(`from:${table}`)
    return supabaseChain
  }),
  upsert: vi.fn(() => catalogUpsertResultMock()),
  rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
    calls.push(`rpc:${fn}`)
    return rpcMock(fn, args)
  }),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

const validFocus = {
  exercise: 'shrugs',
  daily_target: 100,
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

beforeEach(() => {
  requireAdminMock.mockReset()
  catalogUpsertResultMock.mockReset()
  rpcMock.mockReset()
  calls.length = 0
  supabaseChain.from.mockClear()
  supabaseChain.upsert.mockClear()
  supabaseChain.rpc.mockClear()
  // Happy-path defaults; individual tests override.
  catalogUpsertResultMock.mockResolvedValue({ error: null })
  rpcMock.mockResolvedValue({
    data: { id: 'f1', ...validFocus, target_kind: 'reps' },
    error: null,
  })
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/monthly-focus', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/weight-room/monthly-focus', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when color is not a hex string', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validFocus, color: 'tan' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when end_date precedes start_date', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(
      makeRequest({ ...validFocus, start_date: '2026-07-31', end_date: '2026-07-01' }) as never
    )
    expect(res.status).toBe(400)
  })

  it('rejects unknown extra fields via Zod .strict()', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validFocus, sneaky: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is not upper or lower', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validFocus, category: 'core' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is missing', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const { category: _omit, ...noCategory } = validFocus
    const res = await POST(makeRequest(noCategory) as never)
    expect(res.status).toBe(400)
  })

  it('provisions the movement catalog before the create RPC (#373)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    await POST(makeRequest(validFocus) as never)
    // Both the anchor and the focus row FK the catalog, so the roster entry
    // has to land first or a brand-new focus exercise 23503s.
    expect(calls.indexOf('from:weight_room_exercises')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('from:weight_room_exercises')).toBeLessThan(
      calls.indexOf('rpc:create_weight_room_monthly_focus')
    )
  })

  it('returns 500 when the catalog provisioning fails (#373)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    catalogUpsertResultMock.mockResolvedValueOnce({
      error: { code: 'XX001', message: 'boom' },
    })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/movement catalog/i)
  })

  it('returns 500 when the create RPC fails', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: 'XX001', message: 'nope' } })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/nope/)
  })

  it('anchors and inserts in one RPC, defaulting target_kind to reps (#384)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'f1', exercise: 'shrugs' })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('create_weight_room_monthly_focus', {
      p_exercise: 'shrugs',
      p_daily_target: 100,
      p_target_kind: 'reps',
      p_color: '#C9A268',
      p_category: 'upper',
      p_start_date: '2026-07-01',
      p_end_date: '2026-07-31',
    })
    // No direct table write for the goal or the focus: a separate anchor
    // upsert is what let a concurrent goal delete strand the focus.
    expect(calls).not.toContain('from:weight_room_goals')
    expect(calls).not.toContain('from:weight_room_monthly_focus')
  })

  it('lowercases the exercise name on write', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    await POST(makeRequest({ ...validFocus, exercise: 'Shrugs' }) as never)
    expect(rpcMock).toHaveBeenCalledWith(
      'create_weight_room_monthly_focus',
      expect.objectContaining({ p_exercise: 'shrugs' })
    )
  })
})
