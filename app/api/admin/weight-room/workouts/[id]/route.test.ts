import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE, PATCH } from './route'

/**
 * Tests for the workout-session item endpoints (#374). The behaviour worth
 * pinning: deleting a session must never delete its sets, ending validates the
 * window against the *stored* start, and reopening can collide with the
 * one-open-session rule.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

interface Results {
  /** `select started_at ... maybeSingle()` — the stored-window read. */
  read: { data: unknown; error: unknown }
  /** `update ... maybeSingle()`. */
  update: { data: unknown; error: unknown }
  /** `delete ... maybeSingle()`. */
  remove: { data: unknown; error: unknown }
}

let results: Results
let updates: Record<string, unknown>[]

function makeChain() {
  let isUpdate = false
  let isDelete = false

  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    update: vi.fn((row: Record<string, unknown>) => {
      isUpdate = true
      updates.push(row)
      return chain
    }),
    delete: vi.fn(() => {
      isDelete = true
      return chain
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve(isUpdate ? results.update : isDelete ? results.remove : results.read)
    ),
  }
  return chain
}

const fromMock = vi.fn(() => makeChain())
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: fromMock }),
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
  fromMock.mockClear()
  updates = []
  results = {
    read: { data: { started_at: '2026-07-15T18:00:00Z' }, error: null },
    update: { data: { id: 'w1', started_at: '2026-07-15T18:00:00Z' }, error: null },
    remove: { data: { id: 'w1', started_at: '2026-07-15T18:00:00Z' }, error: null },
  }
})

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/workouts/w1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const deleteRequest = () =>
  new Request('http://localhost/api/admin/weight-room/workouts/w1', { method: 'DELETE' })

describe('PATCH /api/admin/weight-room/workouts/[id]', () => {
  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await PATCH(patchRequest({ ended_at: '2026-07-15T19:00:00Z' }) as never, ctx('w1'))
    expect(res.status).toBe(401)
  })

  it('rejects an empty patch', async () => {
    const res = await PATCH(patchRequest({}) as never, ctx('w1'))
    expect(res.status).toBe(400)
  })

  it('ends a session', async () => {
    const res = await PATCH(patchRequest({ ended_at: '2026-07-15T19:00:00Z' }) as never, ctx('w1'))
    expect(res.status).toBe(200)
    expect(updates[0].ended_at).toBe('2026-07-15T19:00:00Z')
  })

  it('validates ended_at against the stored start, not the caller', async () => {
    const res = await PATCH(patchRequest({ ended_at: '2026-07-15T17:00:00Z' }) as never, ctx('w1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/before started_at/i)
    expect(updates).toHaveLength(0)
  })

  it('404s when ending a workout that does not exist', async () => {
    results.read = { data: null, error: null }
    const res = await PATCH(
      patchRequest({ ended_at: '2026-07-15T19:00:00Z' }) as never,
      ctx('nope')
    )
    expect(res.status).toBe(404)
  })

  it('accepts ended_at: null to reopen a mis-ended session', async () => {
    const res = await PATCH(patchRequest({ ended_at: null }) as never, ctx('w1'))
    expect(res.status).toBe(200)
    expect(updates[0].ended_at).toBeNull()
  })

  it('maps a unique violation on reopen to 409', async () => {
    results.update = { data: null, error: { code: '23505', message: 'duplicate key' } }
    const res = await PATCH(patchRequest({ ended_at: null }) as never, ctx('w1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already in progress/i)
  })

  it('maps a malformed uuid to 404 rather than a 500', async () => {
    results.update = { data: null, error: { code: '22P02', message: 'invalid input syntax' } }
    const res = await PATCH(patchRequest({ title: 'Push Day' }) as never, ctx('not-a-uuid'))
    expect(res.status).toBe(404)
  })

  it('clears the title when it is patched to whitespace', async () => {
    // PATCH semantics: emptying the field in an editor and saving means
    // "remove the title", so it must write null. Collapsing it to undefined
    // would make the save a silent no-op and the old title would persist.
    await PATCH(patchRequest({ title: '   ' }) as never, ctx('w1'))
    expect(updates[0].title).toBeNull()
  })

  it('leaves untouched fields out of the update entirely', async () => {
    // Absent key means "leave this alone" — it must not reach Supabase as an
    // undefined that could be read as a clear.
    await PATCH(patchRequest({ title: 'Push Day' }) as never, ctx('w1'))
    expect(updates[0]).not.toHaveProperty('notes')
    expect(updates[0]).not.toHaveProperty('location')
    expect(updates[0]).not.toHaveProperty('ended_at')
  })
})

describe('DELETE /api/admin/weight-room/workouts/[id]', () => {
  it('returns 200 with the removed row', async () => {
    const res = await DELETE(deleteRequest() as never, ctx('w1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('w1')
  })

  it('404s for an unknown id', async () => {
    results.remove = { data: null, error: null }
    const res = await DELETE(deleteRequest() as never, ctx('nope'))
    expect(res.status).toBe(404)
  })

  it('never issues a delete against weight_room_sets', async () => {
    // The sets survive as loose sets via `on delete set null`. If this route
    // ever starts touching the sets table, that is training history being
    // destroyed by a container delete — the exact bug #373 removed.
    await DELETE(deleteRequest() as never, ctx('w1'))
    expect(fromMock).not.toHaveBeenCalledWith('weight_room_sets')
  })

  it('maps a malformed uuid to 404', async () => {
    results.remove = { data: null, error: { code: '22P02', message: 'invalid input syntax' } }
    const res = await DELETE(deleteRequest() as never, ctx('not-a-uuid'))
    expect(res.status).toBe(404)
  })
})
