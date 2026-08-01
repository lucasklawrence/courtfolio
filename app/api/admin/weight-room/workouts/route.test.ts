import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { GET, POST } from './route'

/**
 * Tests for the workout-session collection endpoints (#374). Auth gate and the
 * Supabase service-role client are mocked; the route's own logic — the
 * stale-session rule, the open-slot 409, and after-the-fact recording — is
 * exercised in isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

/** Programmed results, keyed by the logical query the route issues. */
interface Results {
  /** `select ... is('ended_at', null)` on workouts — the open-session probe. */
  openWorkout: { data: unknown; error: unknown }
  /** `select logged_at` on sets — newest set in the stale session. */
  lastSet: { data: unknown; error: unknown }
  /** `update` on workouts — auto-closing the stale session. */
  closeStale: { error: unknown }
  /** `insert ... single()` on workouts — the new session. */
  insert: { data: unknown; error: unknown }
  /** `select ... order ... limit` on workouts — the list read. */
  list: { data: unknown; error: unknown }
}

let results: Results
/** Every write the route issued, for assertion. */
let updates: Record<string, unknown>[]
let inserts: Record<string, unknown>[]
/** `.is(column, value)` filters applied to an update chain. */
let updateFilters: [string, unknown][]

function freshResults(): Results {
  return {
    openWorkout: { data: null, error: null },
    lastSet: { data: null, error: null },
    closeStale: { error: null },
    insert: { data: { id: 'w-new', started_at: '2026-07-15T18:00:00.000Z' }, error: null },
    list: { data: [], error: null },
  }
}

/**
 * Chainable, thenable Supabase stub. Each chain records which table it targets
 * and which terminal it hit, so a test can program one leg without knowing the
 * route's exact call order.
 */
function makeChain(table: string) {
  let isOpenProbe = false
  let isUpdate = false
  let isInsert = false
  let isList = false

  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => {
      isList = true
      return chain
    }),
    limit: vi.fn(() => chain),
    is: vi.fn((column: string, value: unknown) => {
      // On an update chain this is the conditional-close guard; anywhere else
      // it's the open-session probe.
      if (isUpdate) updateFilters.push([column, value])
      else isOpenProbe = true
      return chain
    }),
    insert: vi.fn((row: Record<string, unknown>) => {
      isInsert = true
      inserts.push(row)
      return chain
    }),
    update: vi.fn((row: Record<string, unknown>) => {
      isUpdate = true
      updates.push(row)
      return chain
    }),
    maybeSingle: vi.fn(() => {
      if (table === 'weight_room_sets') return Promise.resolve(results.lastSet)
      if (isOpenProbe) return Promise.resolve(results.openWorkout)
      return Promise.resolve(results.list)
    }),
    single: vi.fn(() => Promise.resolve(results.insert)),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const settled = isUpdate
        ? results.closeStale
        : isInsert
          ? results.insert
          : isList
            ? results.list
            : results.openWorkout
      return Promise.resolve(settled).then(onFulfilled, onRejected)
    },
  }
  return chain
}

const fromMock = vi.fn((table: string) => makeChain(table))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: fromMock }),
}))

beforeEach(() => {
  requireAdminMock.mockReset()
  fromMock.mockClear()
  results = freshResults()
  updates = []
  inserts = []
  updateFilters = []
  vi.useRealTimers()
})

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function getRequest(query = ''): Request {
  return new Request(`http://localhost/api/admin/weight-room/workouts${query}`)
}

describe('POST /api/admin/weight-room/workouts', () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
  })

  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(401)
  })

  it('starts a session from an empty body, stamping started_at', async () => {
    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(201)
    expect(inserts[0].started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('rejects an unknown field via .strict()', async () => {
    const res = await POST(postRequest({ sneaky: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('accepts a window whose end sorts before its start but is later in time', async () => {
    // 05:00-07:00 is 12:00Z — two hours after 10:00Z. A string comparison
    // would reject this valid session.
    const res = await POST(
      postRequest({
        started_at: '2026-08-01T10:00:00Z',
        ended_at: '2026-08-01T05:00:00-07:00',
      }) as never
    )
    expect(res.status).toBe(201)
  })

  it('rejects an unparseable started_at even with no ended_at to compare against', async () => {
    // The window check below only runs when ended_at is supplied, so without
    // this guard a garbage started_at would reach Postgres as a 500.
    const res = await POST(postRequest({ started_at: 'tuesday' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/started_at must be a valid ISO/i)
    expect(inserts).toHaveLength(0)
  })

  it('rejects an unparseable ended_at with a 400 rather than passing it to Postgres', async () => {
    const res = await POST(
      postRequest({ started_at: '2026-08-01T10:00:00Z', ended_at: 'yesterday' }) as never
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valid ISO/i)
  })

  it('rejects ended_at before started_at with a 400, not a constraint 500', async () => {
    const res = await POST(
      postRequest({
        started_at: '2026-07-15T18:00:00Z',
        ended_at: '2026-07-15T17:00:00Z',
      }) as never
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/before started_at/i)
  })

  it('refuses with 409 when a recent session is still open', async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-open', started_at: startedAt }, error: null }

    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.open_workout_id).toBe('w-open')
    // Nothing was written — the caller decides whether to end it.
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('auto-ends a stale session at its last set, then starts the new one', async () => {
    const startedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    // An hour into that session — the dates have to be coherent or the
    // never-end-before-you-started clamp fires instead, which is a different
    // behavior (covered below).
    const lastSetAt = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-stale', started_at: startedAt }, error: null }
    results.lastSet = { data: { logged_at: lastSetAt }, error: null }

    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(201)
    // Closed at the last real evidence of training — not "now", which would
    // invent two days of session that never happened.
    expect(updates[0].ended_at).toBe(lastSetAt)
    expect(inserts).toHaveLength(1)
  })

  it('closes a stale session only while it is still open', async () => {
    // Without the `ended_at is null` filter, a request that explicitly ended
    // this session between the probe and the update would have its chosen
    // ended_at silently overwritten by the auto-end timestamp.
    const startedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-stale', started_at: startedAt }, error: null }

    await POST(postRequest({}) as never)

    expect(updateFilters).toContainEqual(['ended_at', null])
  })

  it('never ends a stale session before it started', async () => {
    // A set backdated earlier than its own session would otherwise produce an
    // ended_at < started_at and fail the table's CHECK.
    const startedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-stale', started_at: startedAt }, error: null }
    results.lastSet = { data: { logged_at: '2020-01-01T00:00:00.000Z' }, error: null }

    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(201)
    expect(updates[0].ended_at).toBe(startedAt)
  })

  it('collapses a stale session with no sets to zero duration', async () => {
    const startedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-stale', started_at: startedAt }, error: null }
    results.lastSet = { data: null, error: null }

    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(201)
    expect(updates[0].ended_at).toBe(startedAt)
  })

  it('records an already-finished session without touching the open slot', async () => {
    // An after-the-fact workout carries its own end, so it never contends for
    // the single in-progress slot — even with one genuinely open.
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    results.openWorkout = { data: { id: 'w-open', started_at: startedAt }, error: null }

    const res = await POST(
      postRequest({
        started_at: '2026-07-13T18:00:00Z',
        ended_at: '2026-07-13T19:00:00Z',
      }) as never
    )
    expect(res.status).toBe(201)
    expect(updates).toHaveLength(0)
  })

  it('maps a unique-violation from the index to 409, not 500', async () => {
    results.insert = { data: null, error: { code: '23505', message: 'duplicate key' } }
    const res = await POST(postRequest({}) as never)
    expect(res.status).toBe(409)
  })

  it('normalizes an empty title to an omitted column', async () => {
    await POST(postRequest({ title: '   ' }) as never)
    expect(inserts[0]).not.toHaveProperty('title')
  })
})

describe('GET /api/admin/weight-room/workouts', () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
  })

  it('returns null rather than 404 when nothing is open', async () => {
    // "Am I mid-workout?" is a question with a legitimate "no" — the recording
    // surface asks it on every load.
    results.openWorkout = { data: null, error: null }
    const res = await GET(getRequest('?open=true') as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns the open session when there is one', async () => {
    results.openWorkout = { data: { id: 'w-open' }, error: null }
    const res = await GET(getRequest('?open=true') as never)
    expect(await res.json()).toEqual({ id: 'w-open' })
  })

  it('lists sessions newest first', async () => {
    results.list = { data: [{ id: 'w2' }, { id: 'w1' }], error: null }
    const res = await GET(getRequest() as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'w2' }, { id: 'w1' }])
  })

  it('surfaces a read failure as 500', async () => {
    results.list = { data: null, error: { message: 'JWT expired' } }
    const res = await GET(getRequest() as never)
    expect(res.status).toBe(500)
  })
})
