// @vitest-environment node
/**
 * Tests for the per-request telemetry wrapper (#220).
 *
 * The telemetry client is mocked so assertions run against the emitted
 * arguments, not Pub/Sub. The wrapper's contract: exactly one emitEvent per
 * invocation, pass-through responses, re-thrown errors, and no PII (route
 * label + numeric status + error constructor name only).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { scheduleFlush, withTelemetry } from './with-telemetry'

const emitEventMock = vi.hoisted(() => vi.fn())
const flushMock = vi.hoisted(() => vi.fn())
const afterMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/telemetry/client', () => ({
  emitEvent: emitEventMock,
  flush: flushMock,
}))

// `after()` only works inside a Next.js request scope; capture the callback
// instead so tests can assert the post-response flush is scheduled.
vi.mock('next/server', () => ({
  after: afterMock,
}))

beforeEach(() => {
  emitEventMock.mockReset()
  flushMock.mockReset()
  afterMock.mockReset()
})

describe('withTelemetry', () => {
  it('passes the response through and emits ok with duration + http_status', async () => {
    const wrapped = withTelemetry('GET /api/admin/check', async () =>
      Response.json({ isAdmin: false }, { status: 200 })
    )

    const res = await wrapped()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAdmin: false })
    expect(emitEventMock).toHaveBeenCalledTimes(1)
    const [name, opts] = emitEventMock.mock.calls[0]
    expect(name).toBe('GET /api/admin/check')
    expect(opts.status).toBe('ok')
    expect(opts.durationMs).toBeGreaterThanOrEqual(0)
    expect(opts.attributes).toEqual({ http_status: 200 })
  })

  it('forwards all handler arguments unchanged', async () => {
    const handler = vi.fn(async (_req: Request, _ctx: { params: Promise<{ id: string }> }) =>
      Response.json({}, { status: 200 })
    )
    const wrapped = withTelemetry('DELETE /api/admin/weight-room/sets/[id]', handler)

    const req = new Request('http://localhost/api/admin/weight-room/sets/abc')
    const ctx = { params: Promise.resolve({ id: 'abc' }) }
    await wrapped(req, ctx)

    expect(handler).toHaveBeenCalledWith(req, ctx)
  })

  it('labels 4xx/5xx responses as error status', async () => {
    const wrapped = withTelemetry('POST /api/admin/weight-room/sets', async () =>
      Response.json({ error: 'nope' }, { status: 403 })
    )

    const res = await wrapped()

    expect(res.status).toBe(403)
    const [, opts] = emitEventMock.mock.calls[0]
    expect(opts.status).toBe('error')
    expect(opts.attributes).toEqual({ http_status: 403 })
  })

  it('emits error with the constructor name (never the message) and re-throws', async () => {
    class SupabaseEnvError extends Error {}
    const thrown = new SupabaseEnvError('secret: lucasklawrence@gmail.com')
    const wrapped = withTelemetry('PUT /api/admin/movement-benchmarks/[date]', async () => {
      throw thrown
    })

    await expect(wrapped()).rejects.toBe(thrown)

    expect(emitEventMock).toHaveBeenCalledTimes(1)
    const [name, opts] = emitEventMock.mock.calls[0]
    expect(name).toBe('PUT /api/admin/movement-benchmarks/[date]')
    expect(opts.status).toBe('error')
    expect(opts.attributes).toEqual({ error_type: 'SupabaseEnvError' })
    // PII guard: the email-bearing message must not appear anywhere in the emission.
    expect(JSON.stringify(emitEventMock.mock.calls[0])).not.toContain('lucasklawrence')
  })

  it('labels non-Error throws with their typeof', async () => {
    const wrapped = withTelemetry('GET /resume', async () => {
      throw 'string failure'
    })

    await expect(wrapped()).rejects.toBe('string failure')
    const [, opts] = emitEventMock.mock.calls[0]
    expect(opts.attributes).toEqual({ error_type: 'string' })
  })

  it('schedules a post-response flush on success and on throw', async () => {
    const ok = withTelemetry('GET /api/admin/check', async () =>
      Response.json({}, { status: 200 })
    )
    await ok()
    expect(afterMock).toHaveBeenCalledTimes(1)
    // The scheduled callback is the client's flush — draining the publish
    // queue inside the platform's waitUntil scope.
    expect(afterMock.mock.calls[0][0]).toBe(flushMock)

    const boom = withTelemetry('GET /resume', async () => {
      throw new Error('boom')
    })
    await expect(boom()).rejects.toThrow('boom')
    expect(afterMock).toHaveBeenCalledTimes(2)
  })
})

describe('scheduleFlush', () => {
  it('swallows after() throwing outside a request scope', () => {
    afterMock.mockImplementationOnce(() => {
      throw new Error('`after` was called outside a request scope')
    })
    expect(() => scheduleFlush()).not.toThrow()
  })
})
