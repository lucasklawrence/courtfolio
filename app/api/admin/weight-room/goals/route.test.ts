import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from './route'

/**
 * Tests for `POST /api/admin/weight-room/goals`. Auth gate + Supabase
 * service-role client are mocked; the route's own logic (JSON parsing,
 * Zod validation, hex-color enforcement, effective-dated target history,
 * upsert success path) is exercised in isolation.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

/**
 * Which logical query a chain represents, derived from the table plus the
 * first operation called on it. The route issues a deterministic sequence, so
 * naming each step lets a test program exactly the one it cares about and
 * leave the rest on sensible defaults.
 */
type QueryKind =
  | 'existingGoal'
  | 'insertGoal'
  | 'upsertGoal'
  | 'historyCount'
  | 'historyUpsert'
  | 'currentTarget'

/** A Supabase-shaped result. `count` is only read by the history-count query. */
interface QueryResult {
  data?: unknown
  error?: unknown
  count?: number
}

/** Programmed responses per query kind; anything unset falls back to a benign default. */
let responses: Partial<Record<QueryKind, QueryResult>>
/** Every chain the route built, in order — the assertion surface for writes. */
let calls: { kind: QueryKind; table: string; payload?: unknown; options?: unknown }[]

const DEFAULTS: Record<QueryKind, QueryResult> = {
  existingGoal: { data: null, error: null },
  insertGoal: { data: null, error: null },
  upsertGoal: { data: null, error: null },
  historyCount: { count: 1, error: null },
  historyUpsert: { data: null, error: null },
  currentTarget: { data: null, error: null },
}

/**
 * Build a chainable, thenable query stub. Every filter/order method returns
 * `this`; awaiting the chain (or calling `single`/`maybeSingle`) resolves the
 * response programmed for its {@link QueryKind}.
 */
function makeChain(table: string) {
  let kind: QueryKind | undefined
  const record: { kind: QueryKind; table: string; payload?: unknown; options?: unknown } = {
    kind: 'existingGoal',
    table,
  }

  const settle = (): Promise<QueryResult> => {
    const resolved = kind ?? 'existingGoal'
    return Promise.resolve(responses[resolved] ?? DEFAULTS[resolved])
  }

  const chain = {
    select: vi.fn((_cols?: unknown, opts?: { count?: string; head?: boolean }) => {
      if (kind === undefined) {
        if (table === 'weight_room_goals') kind = 'existingGoal'
        else kind = opts?.head === true ? 'historyCount' : 'currentTarget'
        record.kind = kind
      }
      return chain
    }),
    insert: vi.fn((payload: unknown) => {
      kind = 'insertGoal'
      record.kind = kind
      record.payload = payload
      calls.push(record)
      return chain
    }),
    upsert: vi.fn((payload: unknown, options?: unknown) => {
      kind = table === 'weight_room_goals' ? 'upsertGoal' : 'historyUpsert'
      record.kind = kind
      record.payload = payload
      record.options = options
      calls.push(record)
      return chain
    }),
    eq: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => settle()),
    single: vi.fn(() => settle()),
    then: (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      settle().then(onFulfilled, onRejected),
  }
  return chain
}

const fromMock = vi.fn((table: string) => makeChain(table))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: fromMock }),
}))

/** The write recorded for a given query kind, or `undefined` if it never ran. */
function callFor(kind: QueryKind) {
  return calls.find((c) => c.kind === kind)
}

beforeEach(() => {
  requireAdminMock.mockReset()
  fromMock.mockClear()
  responses = {}
  calls = []
})

afterEach(() => {
  vi.useRealTimers()
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/weight-room/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/weight-room/goals', () => {
  const validGoal = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }

  it('returns 401 when not signed in', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    })
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when color is not a hex string', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(
      makeRequest({ exercise: 'pushups', daily_target: 100, color: 'orange' }) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation failed/i)
  })

  it('rejects unknown extra fields via Zod .strict()', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    const res = await POST(makeRequest({ ...validGoal, sneaky: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on unexpected Supabase errors', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    responses.upsertGoal = { data: null, error: { code: 'XX001', message: 'data corruption' } }
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(500)
  })

  it('returns 200 with the upserted row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    responses.existingGoal = { data: { exercise: 'pushups', daily_target: 100 }, error: null }
    responses.currentTarget = { data: { daily_target: 100 }, error: null }
    responses.upsertGoal = { data: validGoal, error: null }
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(validGoal)
    expect(callFor('upsertGoal')?.payload).toEqual(
      expect.objectContaining({ ...validGoal, updated_at: expect.any(String) }),
    )
    expect(callFor('upsertGoal')?.options).toEqual({ onConflict: 'exercise' })
  })

  it('stamps updated_at so edits advance the row freshness', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    responses.existingGoal = { data: { exercise: 'pushups', daily_target: 100 }, error: null }
    responses.currentTarget = { data: { daily_target: 100 }, error: null }
    responses.upsertGoal = { data: validGoal, error: null }
    await POST(makeRequest(validGoal) as never)
    expect(callFor('upsertGoal')?.payload).toEqual(
      // Loose ISO-8601 check: starts with YYYY-MM-DD.
      expect.objectContaining({ updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }),
    )
  })

  describe('effective-dated target history (#362)', () => {
    beforeEach(() => {
      requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
      // Fixed clock so "today" is deterministic. 19:00Z is midday Pacific
      // year-round, so the Pacific day key is unambiguously 2026-08-15.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-15T19:00:00Z'))
    })

    it('appends a history row dated today when the target changes', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyCount = { count: 1, error: null }
      responses.currentTarget = { data: { daily_target: 50 }, error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(res.status).toBe(200)
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({
          exercise: 'pullups',
          daily_target: 50,
          effective_from: '2026-08-15',
        }),
      ])
      expect(callFor('historyUpsert')?.options).toEqual({
        onConflict: 'exercise,effective_from',
      })
    })

    it('honours a backdated effective_from', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyCount = { count: 1, error: null }
      responses.currentTarget = { data: { daily_target: 50 }, error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      await POST(
        makeRequest({
          exercise: 'pullups',
          daily_target: 50,
          color: '#0EA5A1',
          effective_from: '2026-08-01',
        }) as never,
      )
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ effective_from: '2026-08-01', daily_target: 50 }),
      ])
    })

    it('rejects a future effective_from', async () => {
      const res = await POST(
        makeRequest({
          exercise: 'pullups',
          daily_target: 50,
          color: '#0EA5A1',
          effective_from: '2026-09-01',
        }) as never,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/future/i)
      expect(callFor('historyUpsert')).toBeUndefined()
    })

    it('does not append history for a colour-only edit', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.currentTarget = { data: { daily_target: 30 }, error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 30, color: '#123456' }) as never,
      )
      expect(res.status).toBe(200)
      expect(callFor('historyUpsert')).toBeUndefined()
    })

    it('seeds a baseline row when an existing goal has no history yet', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyCount = { count: 0, error: null }
      responses.currentTarget = { data: { daily_target: 50 }, error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      // Old target anchored at the epoch so no logged day is left uncovered
      // and the past keeps scoring against 30.
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ daily_target: 30, effective_from: '1970-01-01' }),
        expect.objectContaining({ daily_target: 50, effective_from: '2026-08-15' }),
      ])
    })

    it('seeds history for a brand-new goal', async () => {
      responses.existingGoal = { data: null, error: null }
      responses.currentTarget = { data: { daily_target: 40 }, error: null }
      responses.upsertGoal = { data: { exercise: 'dips' }, error: null }

      await POST(makeRequest({ exercise: 'dips', daily_target: 40, color: '#123456' }) as never)
      expect(callFor('insertGoal')).toBeDefined()
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ daily_target: 40, effective_from: '2026-08-15' }),
      ])
    })

    it('mirrors the resolved current target, not the payload, when backdating behind a newer entry', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 50 }, error: null }
      responses.historyCount = { count: 2, error: null }
      // A newer entry (50, effective Aug 10) already governs today, so
      // backdating a 40 to Aug 1 must leave the mirror at 50.
      responses.currentTarget = { data: { daily_target: 50 }, error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      await POST(
        makeRequest({
          exercise: 'pullups',
          daily_target: 40,
          color: '#0EA5A1',
          effective_from: '2026-08-01',
        }) as never,
      )
      expect(callFor('upsertGoal')?.payload).toEqual(
        expect.objectContaining({ daily_target: 50 }),
      )
    })

    it('returns 500 and writes no mirror when the history write fails', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyCount = { count: 1, error: null }
      responses.historyUpsert = { data: null, error: { message: 'conflict' } }

      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(res.status).toBe(500)
      // History is written first precisely so a failure here leaves the goal
      // row untouched rather than half-applied.
      expect(callFor('upsertGoal')).toBeUndefined()
    })
  })
})
