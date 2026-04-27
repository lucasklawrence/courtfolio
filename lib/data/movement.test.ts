import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  deleteBenchmark,
  getMovementBenchmarks,
  logBenchmark,
  updateBenchmark,
} from './movement'

/**
 * Tests the client-side data-access wrappers in `lib/data/movement.ts`.
 *
 * The wrappers are thin — they call `fetch`, branch on `res.ok`, and build
 * descriptive Error messages. We mock `fetch` per test rather than spinning
 * up the real route handlers, since the route handlers are tested directly
 * in `app/api/dev/movement-benchmarks/route.test.ts`.
 */

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json' },
  })
}

describe('getMovementBenchmarks', () => {
  it('returns the parsed array on 200', async () => {
    const data = [{ date: '2026-04-15', bodyweight_lbs: 232 }]
    fetchMock.mockResolvedValueOnce(jsonResponse(data))
    await expect(getMovementBenchmarks()).resolves.toEqual(data)
  })

  it('returns [] on 404 (file not yet created — pre-baseline state)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(getMovementBenchmarks()).resolves.toEqual([])
  })

  it('throws on other non-OK responses (e.g. 500)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'oops' }))
    await expect(getMovementBenchmarks()).rejects.toThrow(/500/)
  })
})

describe('logBenchmark', () => {
  it('POSTs JSON to the dev write route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 201 }))
    const entry = { date: '2026-04-15', bodyweight_lbs: 232 }
    await logBenchmark(entry)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dev/movement-benchmarks')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(entry)
  })

  it('throws the dev-only-API message when the route 404s (prod-gate)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(logBenchmark({ date: '2026-04-15' })).rejects.toThrow(
      /dev-only write API is unavailable/i,
    )
  })

  it('throws a descriptive message on other non-OK responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('payload too big', { status: 413, statusText: 'Payload Too Large' }),
    )
    await expect(logBenchmark({ date: '2026-04-15' })).rejects.toThrow(/413/)
  })

  it('does not throw on a successful response (caller wraps fire-and-forget UX)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 201 }))
    await expect(logBenchmark({ date: '2026-04-15' })).resolves.toBeUndefined()
  })
})

describe('updateBenchmark', () => {
  it('PUTs to the date-keyed URL with URL-encoded segment', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBenchmark('2026-04-15', { vertical_in: 23.5 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dev/movement-benchmarks/2026-04-15')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ vertical_in: 23.5 })
  })

  it('encodes special characters in the date segment defensively', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    // A real date will never contain '/', but encodeURIComponent should still
    // protect us if a caller passes a malformed key.
    await updateBenchmark('2026/04/15', { vertical_in: 23 })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dev/movement-benchmarks/2026%2F04%2F15')
  })

  it('throws the dev-only-API message on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(updateBenchmark('2026-04-15', { vertical_in: 23 })).rejects.toThrow(
      /dev-only write API is unavailable/i,
    )
  })
})

describe('deleteBenchmark', () => {
  it('DELETEs the date-keyed URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deleteBenchmark('2026-04-15')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dev/movement-benchmarks/2026-04-15')
    expect(init.method).toBe('DELETE')
  })

  it('throws the dev-only-API message on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(deleteBenchmark('2026-04-15')).rejects.toThrow(
      /dev-only write API is unavailable/i,
    )
  })
})
