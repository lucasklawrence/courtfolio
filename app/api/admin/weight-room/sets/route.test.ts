import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/weight-room/sets`. Both the auth gate and
 * the Supabase service-role client are mocked so the route's own logic
 * (JSON parsing, Zod validation, FK-violation mapping, default
 * `logged_at`) is exercised in isolation.
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
  supabaseChain.from.mockReturnValue(supabaseChain)
  supabaseChain.insert.mockReturnValue(supabaseChain)
  supabaseChain.select.mockReturnValue(supabaseChain)
  supabaseChain.single.mockImplementation(() => insertMock())
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/sets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/weight-room/sets', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not on the allowlist', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Admin only.' }, { status: 403 }),
    })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest('not-json') as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 with Zod issues when reps is missing', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ exercise: 'pushups' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation failed/i)
  })

  it('returns 400 when reps is not positive', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 0 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 409 on FK violation (exercise not in goals)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    })
    const res = await POST(makeRequest({ exercise: 'unknown', reps: 25 }) as never)
    expect(res.status).toBe(409)
  })

  it('returns 500 on unexpected Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX001', message: 'data corruption' },
    })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(res.status).toBe(500)
  })

  it('returns 201 with the inserted row on success and defaults logged_at', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const insertedRow = {
      id: '11111111-1111-4111-8111-111111111111',
      logged_at: '2026-05-07T08:00:00Z',
      exercise: 'pushups',
      reps: 25,
    }
    insertMock.mockResolvedValueOnce({ data: insertedRow, error: null })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(insertedRow)
    // logged_at was defaulted in the insert call.
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ exercise: 'pushups', reps: 25, logged_at: expect.any(String) })
    )
  })

  it('forwards the within-set step into the insert (#407)', async () => {
    // The schema accepting the field is not enough: this whitelist is what
    // actually writes it. Without it every mini-set reloads with no step, a
    // rack run never completes a pass, and the panel offers the first rung
    // forever — the feature is inert end to end.
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    const res = await POST(
      makeRequest({
        exercise: 'dumbbell-curl',
        reps: 8,
        weight_lbs: 30,
        template_slot_id: '22222222-2222-4222-8222-222222222222',
        template_slot_step_id: '33333333-3333-4333-8333-333333333333',
      }) as never
    )
    expect(res.status).toBe(201)
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_slot_id: '22222222-2222-4222-8222-222222222222',
        template_slot_step_id: '33333333-3333-4333-8333-333333333333',
      })
    )
  })

  it('omits the step column for an ordinary straight set (#407)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ template_slot_step_id: expect.anything() })
    )
  })

  it('rejects a step with no slot — a step belongs to a slot (#407)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(
      makeRequest({
        exercise: 'dumbbell-curl',
        reps: 8,
        template_slot_step_id: '33333333-3333-4333-8333-333333333333',
      }) as never
    )
    expect(res.status).toBe(400)
    expect(supabaseChain.insert).not.toHaveBeenCalled()
  })

  it('threads a lowercased/trimmed variant into the insert (#254)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    const res = await POST(
      makeRequest({ exercise: 'pullups', reps: 5, variant: '  Wide  ' }) as never
    )
    expect(res.status).toBe(201)
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ exercise: 'pullups', reps: 5, variant: 'wide' })
    )
  })

  it('omits the variant column entirely when none is supplied (#254)', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    insertMock.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    const res = await POST(makeRequest({ exercise: 'pushups', reps: 25 }) as never)
    expect(res.status).toBe(201)
    // An untagged set must not send `variant` so the DB keeps its null
    // default — not an empty-string bucket.
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ variant: expect.anything() })
    )
  })
})
