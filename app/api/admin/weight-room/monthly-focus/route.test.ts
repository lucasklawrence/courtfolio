import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/weight-room/monthly-focus` (#255). Auth gate
 * + Supabase service-role client are mocked. The route does two writes —
 * a `kind: 'focus'` goal-anchor upsert (awaited directly) and a focus-row
 * insert (`.insert().select().single()`) — so the mock resolves those two
 * call shapes independently.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const upsertResultMock = vi.fn()
const singleMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  upsert: vi.fn(() => upsertResultMock()),
  insert: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  single: vi.fn(() => singleMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

const validFocus = {
  exercise: 'shrugs',
  daily_target: 100,
  color: '#C9A268',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

beforeEach(() => {
  requireAdminMock.mockReset()
  upsertResultMock.mockReset()
  singleMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.upsert.mockClear()
  supabaseChain.insert.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.single.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.upsert.mockImplementation(() => upsertResultMock())
  supabaseChain.insert.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.single.mockImplementation(() => singleMock())
  // Happy-path defaults; individual tests override.
  upsertResultMock.mockResolvedValue({ error: null })
  singleMock.mockResolvedValue({ data: { id: 'f1', ...validFocus, target_kind: 'reps' }, error: null })
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
      makeRequest({ ...validFocus, start_date: '2026-07-31', end_date: '2026-07-01' }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('rejects unknown extra fields via Zod .strict()', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validFocus, sneaky: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 when the goal-anchor upsert fails', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    upsertResultMock.mockResolvedValueOnce({ error: { code: 'XX001', message: 'boom' } })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/anchor focus goal/i)
  })

  it('returns 500 when the focus insert fails', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'XX001', message: 'nope' } })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(500)
  })

  it('anchors a kind=focus goal without clobbering existing goals, then inserts the focus', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest(validFocus) as never)
    expect(res.status).toBe(201)

    // Anchor upsert: kind 'focus', ignoreDuplicates so an existing
    // permanent goal isn't flipped.
    expect(supabaseChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ exercise: 'shrugs', kind: 'focus', daily_target: 100 }),
      { onConflict: 'exercise', ignoreDuplicates: true },
    )
    // Focus insert defaults target_kind to 'reps'.
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        exercise: 'shrugs',
        target_kind: 'reps',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
      }),
    )
  })

  it('lowercases the exercise name on write', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    await POST(makeRequest({ ...validFocus, exercise: 'Shrugs' }) as never)
    expect(supabaseChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ exercise: 'shrugs' }),
      expect.anything(),
    )
  })
})
