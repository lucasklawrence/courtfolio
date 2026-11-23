/**
 * Tests for the shared Gmail client's pure helpers. No network: the HTTP
 * calls are exercised by the importers' runs, not here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { gmailGet, gmailSession, mapLimit } from './gmail.mjs'

describe('gmailSession', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Stub fetch: 401 for any token but `fresh`, a message otherwise. Returns the tokens seen. */
  function stubAuth() {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
        const token = init.headers.Authorization.replace('Bearer ', '')
        seen.push(token)
        return token === 'fresh'
          ? new Response('{"id":"m1"}', { status: 200 })
          : new Response('{"error":"invalid_token"}', { status: 401 })
      })
    )
    return seen
  }

  it('renews an expired token once and retries the call', async () => {
    const seen = stubAuth()
    const refresh = vi.fn(async () => 'fresh')
    const gmail = gmailSession('stale', refresh)
    expect(await gmail.get('messages/m1', { baseDelayMs: 1 })).toEqual({ id: 'm1' })
    expect(seen).toEqual(['stale', 'fresh'])
    expect(gmail.token).toBe('fresh')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shares one renewal between calls that expire together', async () => {
    stubAuth()
    const refresh = vi.fn(async () => 'fresh')
    const gmail = gmailSession('stale', refresh)
    await Promise.all([gmail.get('messages/a'), gmail.get('messages/b'), gmail.get('messages/c')])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('gives up when the renewed token is refused too', async () => {
    stubAuth()
    const gmail = gmailSession('stale', async () => 'also-stale')
    await expect(gmail.get('messages/m1', { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 401,
    })
  })
})

describe('gmailGet', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Stub fetch with a fixed sequence of responses; returns the call log. */
  function stubFetch(
    ...responses: Array<{ status: number; body?: string; headers?: Record<string, string> }>
  ) {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        const r = responses[Math.min(calls.length, responses.length) - 1]
        return new Response(r.body ?? '{}', { status: r.status, headers: r.headers })
      })
    )
    return calls
  }

  it('retries a rate limit and a server error, then returns the body', async () => {
    const calls = stubFetch(
      { status: 429 },
      { status: 403, body: '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}' },
      { status: 503 },
      { status: 200, body: '{"id":"m1"}' }
    )
    expect(await gmailGet('messages/m1', 't', { baseDelayMs: 1 })).toEqual({ id: 'm1' })
    expect(calls).toHaveLength(4)
  })

  it('gives up after the last attempt, with the status on the error', async () => {
    const calls = stubFetch({ status: 429 })
    await expect(gmailGet('messages/m1', 't', { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 429,
    })
    expect(calls).toHaveLength(5)
  })

  it('does not retry a 404 or a plain 403, and reports the status', async () => {
    const calls = stubFetch({ status: 404 })
    await expect(gmailGet('messages/gone', 't', { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 404,
    })
    expect(calls).toHaveLength(1)
    const forbidden = stubFetch({ status: 403, body: '{"error":"insufficientPermissions"}' })
    await expect(gmailGet('messages/x', 't', { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 403,
    })
    expect(forbidden).toHaveLength(1)
  })
})

describe('mapLimit', () => {
  it('keeps input order and never runs more than the limit at once', async () => {
    let inFlight = 0
    let peak = 0
    const delays = [30, 5, 20, 1, 15, 10, 2, 25]
    const out = await mapLimit(delays, 3, async (ms: number) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, ms))
      inFlight -= 1
      return ms * 2
    })
    expect(out).toEqual(delays.map(ms => ms * 2))
    expect(peak).toBe(3)
  })

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapLimit([], 8, async () => 1)).toEqual([])
    expect(await mapLimit([1, 2], 8, async (n: number) => n + 1)).toEqual([2, 3])
  })

  it('rejects when any call rejects', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n: number) => {
        if (n === 2) throw new Error('boom')
        return n
      })
    ).rejects.toThrow('boom')
  })
})
