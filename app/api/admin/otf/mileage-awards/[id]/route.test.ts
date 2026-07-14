import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE, PATCH } from './route'

/**
 * Tests for `PATCH`/`DELETE /api/admin/otf/mileage-awards/[id]` (#321). Auth
 * gate + Supabase service-role client mocked; both verbs end their chain in
 * `.select().maybeSingle()`, so a missing row resolves `{ data: null }` → 404.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const maybeSingleMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  update: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => maybeSingleMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

const VALID_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  requireAdminMock.mockReset()
  maybeSingleMock.mockReset()
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
  supabaseChain.maybeSingle.mockImplementation(() => maybeSingleMock())
})

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost/api/admin/otf/mileage-awards/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('PATCH /api/admin/otf/mileage-awards/[id]', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await PATCH(patchRequest({ miles: 20 }) as never, ctx(VALID_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a non-UUID id', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await PATCH(patchRequest({ miles: 20 }) as never, ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an empty patch', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await PATCH(patchRequest({}) as never, ctx(VALID_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no tier matches the id', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await PATCH(patchRequest({ miles: 20 }) as never, ctx(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('returns 409 when the new label collides', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'dup' } })
    const res = await PATCH(patchRequest({ label: 'Marathon' }) as never, ctx(VALID_ID))
    expect(res.status).toBe(409)
  })

  it('returns 200 and updates only the supplied fields', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: VALID_ID, label: 'Marathon', miles: 26.2, color: '#F97316' },
      error: null,
    })
    const res = await PATCH(patchRequest({ miles: 26.2 }) as never, ctx(VALID_ID))
    expect(res.status).toBe(200)
    // Only `miles` was sent, so the update payload carries miles but no label.
    expect(supabaseChain.update).toHaveBeenCalledWith(expect.objectContaining({ miles: 26.2 }))
    expect(supabaseChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.anything() }),
    )
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', VALID_ID)
  })
})

describe('DELETE /api/admin/otf/mileage-awards/[id]', () => {
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

  it('returns 404 when no tier matches the id', async () => {
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
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: VALID_ID, label: 'Ultra', miles: 31.1, color: '#EA580C' },
      error: null,
    })
    const res = await DELETE({} as never, ctx(VALID_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: VALID_ID, label: 'Ultra', miles: 31.1, color: '#EA580C' })
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', VALID_ID)
  })
})
