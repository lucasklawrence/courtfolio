import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests the admin POST handler.
 *
 * Both the auth gate and the Supabase service-role client are mocked
 * so the route's own logic — JSON parsing, Zod validation, status-code
 * mapping for unique-violation vs other Postgres errors — is exercised
 * in isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const insertMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  insert: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  single: vi.fn(() => insertMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  insertMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.insert.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.single.mockClear()
  // Re-bind the chain — every method returns the chain except `single` which resolves.
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.insert.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.single.mockImplementation(() => insertMock())
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/movement-benchmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/movement-benchmarks', () => {
  it('returns 401 when the auth gate rejects (no session)', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    // Cast to NextRequest is fine — the route only reads .json().
    const res = await POST(makeRequest({ date: '2026-04-15' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 when the gate rejects with the wrong email', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Admin only.' }, { status: 403 }),
    })
    const res = await POST(makeRequest({ date: '2026-04-15' }) as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest('not-json') as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valid JSON/i)
  })

  it('returns 400 with Zod-flattened issues for an invalid payload', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ date: 'not-a-date' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation failed/i)
    expect(body.issues).toBeTruthy()
  })

  it('rejects unknown extra fields via Zod .strict()', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(
      makeRequest({ date: '2026-04-15', bench_press_lbs: 200 }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 on Postgres unique-violation (duplicate date PK)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key violates unique constraint' },
    })
    const res = await POST(makeRequest({ date: '2026-04-15' }) as never)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })

  it('returns 500 on other Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    })
    const res = await POST(makeRequest({ date: '2026-04-15' }) as never)
    expect(res.status).toBe(500)
  })

  it('returns 201 with the inserted row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const inserted = { date: '2026-04-15', bodyweight_lbs: 232 }
    insertMock.mockResolvedValueOnce({ data: inserted, error: null })
    const res = await POST(makeRequest(inserted) as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(inserted)
    expect(supabaseChain.from).toHaveBeenCalledWith('movement_benchmarks')
    expect(supabaseChain.insert).toHaveBeenCalledWith(inserted)
  })
})
