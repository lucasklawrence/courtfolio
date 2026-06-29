import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE } from './route'

/**
 * Tests for `DELETE /api/admin/weight-room/monthly-focus/[id]` (#255).
 * Auth gate + Supabase service-role client mocked; the delete chain ends
 * in `.maybeSingle()` so a missing row resolves `{ data: null }` → 404.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const maybeSingleMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => maybeSingleMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

const VALID_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  requireAdminMock.mockReset()
  maybeSingleMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.delete.mockClear()
  supabaseChain.eq.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.maybeSingle.mockClear()
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.delete.mockReturnValue(supabaseChain)
  supabaseChain.eq.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.maybeSingle.mockImplementation(() => maybeSingleMock())
})

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

describe('DELETE /api/admin/weight-room/monthly-focus/[id]', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await DELETE({} as never, ctx(VALID_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a non-UUID id', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await DELETE({} as never, ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no focus matches the id', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await DELETE({} as never, ctx(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('returns 500 on an unexpected Supabase error', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const res = await DELETE({} as never, ctx(VALID_ID))
    expect(res.status).toBe(500)
  })

  it('returns 200 with the deleted row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: VALID_ID, exercise: 'shrugs' }, error: null })
    const res = await DELETE({} as never, ctx(VALID_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: VALID_ID, exercise: 'shrugs' })
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', VALID_ID)
  })
})
