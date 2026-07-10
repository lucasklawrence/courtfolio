// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PanelResult } from '@/lib/panel/types'

import {
  FAILED_RUN_COOLDOWN_MS,
  GLOBAL_RUNS_PER_DAY,
  PER_IP_RUNS_PER_HOUR,
} from './limits'

/**
 * Tests the panel_runs admission sequence and its fail-closed posture.
 *
 * The Supabase client is mocked with a queued query builder: every chain
 * method returns the builder, and each *terminal* operation (an awaited
 * builder, `.single()`, or `.maybeSingle()`) consumes the next preconfigured
 * response. `admitLiveRun` issues its queries strictly sequentially, so the
 * queue order mirrors the documented admission order: stale sweep → cooldown →
 * cache → single-flight insert → per-IP count → global count (→ reject update).
 */

/** One preconfigured terminal-query response. */
interface QueryResponse {
  data?: unknown
  error?: { code?: string; message: string } | null
  count?: number | null
}

/** FIFO of responses, one consumed per terminal query. */
const responses: QueryResponse[] = []

/** Every builder method invocation, in order, for structural assertions. */
const calls: { method: string; args: unknown[] }[] = []

function nextResponse(): QueryResponse {
  const next = responses.shift()
  if (!next) throw new Error('Supabase mock: response queue exhausted — test queued too few responses')
  return next
}

const CHAIN_METHODS = ['select', 'update', 'insert', 'eq', 'in', 'gte', 'lt', 'order', 'limit'] as const

function makeBuilder(): Record<string, unknown> {
  const builder: Record<string, unknown> = {}
  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.maybeSingle = () => {
    calls.push({ method: 'maybeSingle', args: [] })
    return Promise.resolve(nextResponse())
  }
  builder.single = () => {
    calls.push({ method: 'single', args: [] })
    return Promise.resolve(nextResponse())
  }
  // Awaiting the builder directly (update/count queries) is also terminal.
  builder.then = (
    onFulfilled: (value: QueryResponse) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(nextResponse()).then(onFulfilled, onRejected)
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return makeBuilder()
    },
  }),
}))

const { admitLiveRun, hashClientIp, markCompleted, markFailed } = await import('./run-store')

/** Minimal stored result for the cache-hit path (passed through opaquely). */
const storedResult: PanelResult = {
  thesis: { targetId: 'courtfolio', claims: ['c'] },
  verdicts: [],
  verifiedGaps: [],
  synthesis: {
    targetId: 'courtfolio',
    scoreboard: [],
    convergence: [],
    disagreements: [],
    robustFindings: [],
    topMoves: [],
    caughtErrors: [],
    verdict: 'v',
  },
}

/** The happy-path response prefix: sweep ok, no cooldown row, no cached row. */
function queueCleanPreamble(): void {
  responses.push({ error: null }) // stale sweep update
  responses.push({ data: null, error: null }) // cooldown lookup
  responses.push({ data: null, error: null }) // cache lookup
}

function updatePayloads(): Record<string, unknown>[] {
  return calls.filter(c => c.method === 'update').map(c => c.args[0] as Record<string, unknown>)
}

beforeEach(() => {
  responses.length = 0
  calls.length = 0
  vi.stubEnv('PANEL_IP_HASH_SALT', 's')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('hashClientIp', () => {
  it('returns a 64-char hex digest that differs per IP and is stable per IP', () => {
    const a = hashClientIp('1.2.3.4')
    const b = hashClientIp('5.6.7.8')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(b).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
    expect(hashClientIp('1.2.3.4')).toBe(a)
  })

  it('returns null and logs when the salt env var is unset (caller fails closed)', () => {
    vi.stubEnv('PANEL_IP_HASH_SALT', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(hashClientIp('1.2.3.4')).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('PANEL_IP_HASH_SALT'))
  })
})

describe('admitLiveRun', () => {
  it('rejects with a cooldown when a recent failed run exists', async () => {
    responses.push({ error: null }) // stale sweep
    responses.push({
      data: { created_at: new Date(Date.now() - 60_000).toISOString() },
      error: null,
    }) // cooldown lookup: failed 1 min ago

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome.kind).toBe('rejected')
    if (outcome.kind !== 'rejected') throw new Error('expected rejection')
    expect(outcome.rejection.kind).toBe('cooldown')
    expect(outcome.rejection.retryAfterSeconds).toBeGreaterThan(0)
    expect(outcome.rejection.retryAfterSeconds).toBeLessThanOrEqual(FAILED_RUN_COOLDOWN_MS / 1000)
    // Refused before any paid admission: nothing was inserted.
    expect(calls.some(c => c.method === 'insert')).toBe(false)
  })

  it('serves a fresh completed run from cache without inserting a new row', async () => {
    const createdAt = new Date(Date.now() - 10_000).toISOString()
    responses.push({ error: null }) // stale sweep
    responses.push({ data: null, error: null }) // cooldown lookup
    responses.push({
      data: { id: 'row-1', result: storedResult, created_at: createdAt },
      error: null,
    }) // cache lookup

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome).toEqual({
      kind: 'cached',
      run: { id: 'row-1', result: storedResult, createdAt },
    })
    expect(calls.some(c => c.method === 'insert')).toBe(false)
  })

  it('maps a unique violation on insert (single-flight index) to an in-progress rejection', async () => {
    queueCleanPreamble()
    responses.push({ data: null, error: { code: '23505', message: 'duplicate key' } }) // insert

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome).toEqual({
      kind: 'rejected',
      rejection: { kind: 'in-progress', retryAfterSeconds: 90 },
    })
  })

  it('marks the inserted row rejected and refuses when the per-IP hourly count exceeds the limit', async () => {
    queueCleanPreamble()
    responses.push({ data: { id: 'run-1' }, error: null }) // insert
    responses.push({ count: PER_IP_RUNS_PER_HOUR + 1, error: null }) // per-IP count (includes self)
    responses.push({ error: null }) // markRejected update

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome).toEqual({
      kind: 'rejected',
      rejection: { kind: 'ip-limit', retryAfterSeconds: 3600 },
    })
    expect(updatePayloads()).toContainEqual(expect.objectContaining({ status: 'rejected' }))
  })

  it('marks the inserted row rejected and refuses when the global daily count exceeds the limit', async () => {
    queueCleanPreamble()
    responses.push({ data: { id: 'run-1' }, error: null }) // insert
    responses.push({ count: 1, error: null }) // per-IP count: fine
    responses.push({ count: GLOBAL_RUNS_PER_DAY + 1, error: null }) // global count
    responses.push({ error: null }) // markRejected update

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome).toEqual({
      kind: 'rejected',
      rejection: { kind: 'global-limit', retryAfterSeconds: 3600 },
    })
    expect(updatePayloads()).toContainEqual(expect.objectContaining({ status: 'rejected' }))
  })

  it('admits with the inserted run id when every guard passes', async () => {
    queueCleanPreamble()
    responses.push({ data: { id: 'run-42' }, error: null }) // insert
    responses.push({ count: 1, error: null }) // per-IP count
    responses.push({ count: 5, error: null }) // global count

    const outcome = await admitLiveRun('courtfolio', 'hash')

    expect(outcome).toEqual({ kind: 'admitted', runId: 'run-42' })
  })

  it('throws on an unexpected DB error (route maps to 503, fail closed)', async () => {
    responses.push({ error: { message: 'connection refused' } }) // stale sweep fails

    await expect(admitLiveRun('courtfolio', 'hash')).rejects.toThrow(
      /stale sweep failed: connection refused/
    )
  })

  it('throws (never admits un-metered) when the insert fails with a non-unique-violation error', async () => {
    queueCleanPreamble()
    responses.push({ data: null, error: { code: '57014', message: 'timeout' } }) // insert

    await expect(admitLiveRun('courtfolio', 'hash')).rejects.toThrow(/insert failed: timeout/)
  })
})

describe('markCompleted', () => {
  it('updates the row to completed with the result and persona failure count', async () => {
    responses.push({ error: null })

    await markCompleted('run-7', storedResult, 1)

    expect(calls[0]).toEqual({ method: 'from', args: ['panel_runs'] })
    expect(updatePayloads()).toContainEqual(
      expect.objectContaining({
        status: 'completed',
        result: storedResult,
        persona_failure_count: 1,
      })
    )
    expect(calls.find(c => c.method === 'eq')?.args).toEqual(['id', 'run-7'])
  })

  it('throws when the update fails', async () => {
    responses.push({ error: { message: 'boom' } })

    await expect(markCompleted('run-7', storedResult, 0)).rejects.toThrow(
      /complete update failed: boom/
    )
  })
})

describe('markFailed', () => {
  it('updates the row to failed with the error type (starts the cooldown)', async () => {
    responses.push({ error: null })

    await markFailed('run-9', 'TimeoutError')

    expect(updatePayloads()).toContainEqual(
      expect.objectContaining({ status: 'failed', error_type: 'TimeoutError' })
    )
    expect(calls.find(c => c.method === 'eq')?.args).toEqual(['id', 'run-9'])
  })

  it('throws when the update fails', async () => {
    responses.push({ error: { message: 'boom' } })

    await expect(markFailed('run-9', 'Error')).rejects.toThrow(/failure update failed: boom/)
  })
})
