import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { PATCH } from './route'

/**
 * Tests for the slot collection endpoints (#375), concentrated on **reorder**.
 *
 * The reorder path shipped broken in the first cut and no test caught it:
 * `upsert` is `INSERT ... ON CONFLICT`, and Postgres validates NOT NULL on the
 * candidate row *before* resolving the conflict — so a payload carrying only
 * `{id, position}` raises a not-null violation on `exercise` / `target_sets`
 * and the position never moves. These pin the payload shape that fixes it.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

/** Rows the "which slots belong to this template" read returns. */
let ownedSlots: { id: string; exercise: string; target_sets: number }[]
/** Error the ownership read resolves with, if any. */
let ownedError: { code?: string; message: string } | null
/** Payload captured from the upsert. */
let upserted: Record<string, unknown>[] | null
/** Error the upsert resolves with, if any. */
let upsertError: { message: string } | null

function makeChain() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve({ data: ownedSlots, error: ownedError })),
    upsert: vi.fn((rows: Record<string, unknown>[]) => {
      upserted = rows
      return Promise.resolve({ error: upsertError })
    }),
  }
  return chain
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: vi.fn(() => makeChain()) }),
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
  ownedSlots = [
    { id: '11111111-1111-4111-8111-111111111111', exercise: 'barbell-bench-press', target_sets: 4 },
    { id: '22222222-2222-4222-8222-222222222222', exercise: 'barbell-row', target_sets: 3 },
  ]
  ownedError = null
  upserted = null
  upsertError = null
})

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function reorderRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/templates/t1/slots', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** A swap of the two seeded slots. */
const swap = {
  order: [
    { id: '11111111-1111-4111-8111-111111111111', position: 1 },
    { id: '22222222-2222-4222-8222-222222222222', position: 0 },
  ],
}

describe('PATCH /api/admin/weight-room/templates/[id]/slots — reorder', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await PATCH(reorderRequest(swap) as never, ctx('t1'))
    expect(res.status).toBe(401)
  })

  it('carries each slot’s NOT NULL columns into the upsert candidate', async () => {
    // The bug: without exercise/target_sets, Postgres raises a not-null
    // violation on the INSERT candidate before it ever resolves the conflict,
    // so no position moves.
    const res = await PATCH(reorderRequest(swap) as never, ctx('t1'))
    expect(res.status).toBe(200)

    expect(upserted).not.toBeNull()
    for (const row of upserted ?? []) {
      expect(row.exercise).toBeDefined()
      expect(row.target_sets).toBeDefined()
    }
  })

  it('sends both slots in one statement so the deferred constraint holds', async () => {
    // A swap transiently duplicates a position. The unique constraint is
    // DEFERRABLE, so one statement is legal — two sequential ones are not.
    await PATCH(reorderRequest(swap) as never, ctx('t1'))
    expect(upserted).toHaveLength(2)
  })

  it('applies the requested positions, not the stored ones', async () => {
    await PATCH(reorderRequest(swap) as never, ctx('t1'))
    const byId = Object.fromEntries((upserted ?? []).map((r) => [r.id, r.position]))
    expect(byId['11111111-1111-4111-8111-111111111111']).toBe(1)
    expect(byId['22222222-2222-4222-8222-222222222222']).toBe(0)
  })

  it('rejects a slot that belongs to another template', async () => {
    const res = await PATCH(
      reorderRequest({
        order: [{ id: '33333333-3333-4333-8333-333333333333', position: 0 }],
      }) as never,
      ctx('t1'),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/do not belong/i)
    // Nothing written — an unknown id would otherwise attempt an INSERT and
    // fail opaquely on the NOT NULL columns.
    expect(upserted).toBeNull()
  })

  it('rejects an empty order list', async () => {
    const res = await PATCH(reorderRequest({ order: [] }) as never, ctx('t1'))
    expect(res.status).toBe(400)
  })

  it('maps a malformed template uuid to 404', async () => {
    ownedError = { code: '22P02', message: 'invalid input syntax' }
    const res = await PATCH(reorderRequest(swap) as never, ctx('not-a-uuid'))
    expect(res.status).toBe(404)
  })

  it('surfaces an upsert failure as 500', async () => {
    upsertError = { message: 'deadlock detected' }
    const res = await PATCH(reorderRequest(swap) as never, ctx('t1'))
    expect(res.status).toBe(500)
  })
})
