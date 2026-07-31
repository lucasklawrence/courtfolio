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
type QueryKind = 'existingGoal' | 'insertGoal' | 'upsertGoal' | 'historyRead' | 'historyUpsert'

/** A Supabase-shaped result. */
interface QueryResult {
  data?: unknown
  error?: unknown
}

/** Programmed responses per query kind; anything unset falls back to a benign default. */
let responses: Partial<Record<QueryKind, QueryResult>>
/** Every chain the route built, in order — the assertion surface for writes. */
let calls: { kind: QueryKind; table: string; payload?: unknown; options?: unknown }[]

const DEFAULTS: Record<QueryKind, QueryResult> = {
  existingGoal: { data: null, error: null },
  insertGoal: { data: null, error: null },
  upsertGoal: { data: null, error: null },
  historyRead: { data: [], error: null },
  historyUpsert: { data: null, error: null },
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
    select: vi.fn(() => {
      if (kind === undefined) {
        kind = table === 'weight_room_goals' ? 'existingGoal' : 'historyRead'
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

  /** Steady state for pushups: goal on file at 100, one matching history row. */
  function pushupsOnFile() {
    responses.existingGoal = { data: { exercise: 'pushups', daily_target: 100 }, error: null }
    responses.historyRead = {
      data: [{ daily_target: 100, effective_from: '2020-01-01' }],
      error: null,
    }
    responses.upsertGoal = { data: validGoal, error: null }
  }

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
    pushupsOnFile()
    responses.upsertGoal = { data: null, error: { code: 'XX001', message: 'data corruption' } }
    const res = await POST(makeRequest(validGoal) as never)
    expect(res.status).toBe(500)
  })

  it('returns 200 with the upserted row on success', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, email: 'a@b.com' })
    pushupsOnFile()
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
    pushupsOnFile()
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

    /** Pullups on file at 30 with a single seed row — the common starting point. */
    function pullupsAt30() {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyRead = {
        data: [{ daily_target: 30, effective_from: '2020-01-01' }],
        error: null,
      }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }
    }

    it('appends a history row dated today when the target changes', async () => {
      pullupsAt30()
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
      pullupsAt30()
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

    it('appends a backdate whose value matches the current mirror', async () => {
      // History says 30 until Aug 10, then 50 — so the mirror reads 50.
      // "The 50 actually started Aug 1" must still append, even though the
      // payload target equals the mirror. Gating on the mirror dropped this
      // silently and returned 200, defeating the point of backdating.
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 50 }, error: null }
      responses.historyRead = {
        data: [
          { daily_target: 30, effective_from: '2020-01-01' },
          { daily_target: 50, effective_from: '2026-08-10' },
        ],
        error: null,
      }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      const res = await POST(
        makeRequest({
          exercise: 'pullups',
          daily_target: 50,
          color: '#0EA5A1',
          effective_from: '2026-08-01',
        }) as never,
      )
      expect(res.status).toBe(200)
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ daily_target: 50, effective_from: '2026-08-01' }),
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
      pullupsAt30()
      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 30, color: '#123456' }) as never,
      )
      expect(res.status).toBe(200)
      expect(callFor('historyUpsert')).toBeUndefined()
    })

    it('seeds a baseline row when an existing goal has no history yet', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyRead = { data: [], error: null }
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

    it('repairs a history-less goal even when the target is unchanged', async () => {
      // Reachable after a create whose history write failed: the goal row
      // exists, history does not, and a retry with the same payload would
      // never append under change-gated logic — leaving the goal permanently
      // without history.
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 50 }, error: null }
      responses.historyRead = { data: [], error: null }
      responses.upsertGoal = { data: { exercise: 'pullups' }, error: null }

      await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ daily_target: 50, effective_from: '1970-01-01' }),
      ])
    })

    it('seeds history for a brand-new goal', async () => {
      responses.existingGoal = { data: null, error: null }
      responses.historyRead = { data: [], error: null }
      responses.upsertGoal = { data: { exercise: 'dips' }, error: null }

      await POST(makeRequest({ exercise: 'dips', daily_target: 40, color: '#123456' }) as never)
      expect(callFor('insertGoal')).toBeDefined()
      // No retroactive baseline — a brand-new goal has no past to protect.
      expect(callFor('historyUpsert')?.payload).toEqual([
        expect.objectContaining({ daily_target: 40, effective_from: '2026-08-15' }),
      ])
    })

    it('mirrors the resolved current target, not the payload, when backdating behind a newer entry', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 50 }, error: null }
      // A newer entry (50, effective Aug 10) already governs today, so
      // backdating a 40 to Aug 1 must leave the mirror at 50.
      responses.historyRead = {
        data: [
          { daily_target: 30, effective_from: '2020-01-01' },
          { daily_target: 50, effective_from: '2026-08-10' },
        ],
        error: null,
      }
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

    it('advances the mirror when the change is the newest entry', async () => {
      pullupsAt30()
      await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(callFor('upsertGoal')?.payload).toEqual(
        expect.objectContaining({ daily_target: 50 }),
      )
    })

    it('returns 500 and writes no mirror when the history write fails', async () => {
      pullupsAt30()
      responses.historyUpsert = { data: null, error: { message: 'conflict' } }

      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(res.status).toBe(500)
      // History is written first precisely so a failure here leaves the goal
      // row untouched rather than half-applied.
      expect(callFor('upsertGoal')).toBeUndefined()
    })

    it('returns 500 when the history read fails', async () => {
      responses.existingGoal = { data: { exercise: 'pullups', daily_target: 30 }, error: null }
      responses.historyRead = { data: null, error: { message: 'unavailable' } }

      const res = await POST(
        makeRequest({ exercise: 'pullups', daily_target: 50, color: '#0EA5A1' }) as never,
      )
      expect(res.status).toBe(500)
      expect(callFor('historyUpsert')).toBeUndefined()
    })
  })
})
