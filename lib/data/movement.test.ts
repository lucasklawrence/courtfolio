import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import {
  deleteBenchmark,
  getMovementBenchmarks,
  logBenchmark,
  updateBenchmark,
} from './movement'

/**
 * Tests the data-access wrappers in `lib/data/movement.ts`.
 *
 * Reads now go through the Supabase JS client (browser singleton); the
 * test mocks `getBrowserSupabaseClient` to return a tiny chainable
 * stub. Writes still fetch to admin route handlers (`/api/admin/...`)
 * and are tested by mocking global `fetch`. The route handlers
 * themselves are tested in their own files.
 */

const supabaseQuery = {
  select: vi.fn(),
  order: vi.fn(),
}
const fromMock = vi.fn(() => supabaseQuery)
const browserClientMock = { from: fromMock }

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserSupabaseClient: () => browserClientMock,
}))

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  fromMock.mockClear()
  supabaseQuery.select.mockReset()
  supabaseQuery.order.mockReset()
  // Default chain: from(t).select(cols).order(...) → resolves to { data, error }.
  // Re-bind the chain so mock-clear above doesn't drop the references.
  supabaseQuery.select.mockReturnValue(supabaseQuery)
  supabaseQuery.order.mockResolvedValue({ data: [], error: null })
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
  it('queries the movement_benchmarks table ordered by date desc', async () => {
    const rows = [{ date: '2026-04-15', bodyweight_lbs: 232 }]
    supabaseQuery.order.mockResolvedValueOnce({ data: rows, error: null })
    await expect(getMovementBenchmarks()).resolves.toEqual(rows)
    expect(fromMock).toHaveBeenCalledWith('movement_benchmarks')
    expect(supabaseQuery.order).toHaveBeenCalledWith('date', { ascending: false })
  })

  it('returns [] when Supabase returns null data (no rows yet — pre-baseline)', async () => {
    supabaseQuery.order.mockResolvedValueOnce({ data: null, error: null })
    await expect(getMovementBenchmarks()).resolves.toEqual([])
  })

  it('throws a descriptive error when the query fails', async () => {
    supabaseQuery.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'JWT expired', code: '401' },
    })
    await expect(getMovementBenchmarks()).rejects.toThrow(/JWT expired/)
  })
})

describe('logBenchmark', () => {
  it('POSTs JSON to the admin write route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 201 }))
    const entry = { date: '2026-04-15', bodyweight_lbs: 232 }
    await logBenchmark(entry)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/movement-benchmarks')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(entry)
  })

  it("surfaces the route's domain message verbatim on 401 (sign-in required)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Sign in required.' }, { status: 401 }),
    )
    await expect(logBenchmark({ date: '2026-04-15' })).rejects.toThrow(
      'Sign in required.',
    )
  })

  it("surfaces the route's domain message verbatim on 403 (admin only)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Admin only.' }, { status: 403 }),
    )
    await expect(logBenchmark({ date: '2026-04-15' })).rejects.toThrow('Admin only.')
  })

  it('throws a descriptive message on responses without a JSON `error` field', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('payload too big', { status: 413, statusText: 'Payload Too Large' }),
    )
    await expect(logBenchmark({ date: '2026-04-15' })).rejects.toThrow(/413/)
  })

  it('does not throw on a successful response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 201 }))
    await expect(logBenchmark({ date: '2026-04-15' })).resolves.toBeUndefined()
  })
})

describe('updateBenchmark', () => {
  it('PUTs to the date-keyed admin URL with URL-encoded segment', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBenchmark('2026-04-15', { vertical_in: 23.5 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/movement-benchmarks/2026-04-15')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ vertical_in: 23.5 })
  })

  it('encodes special characters in the date segment defensively', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBenchmark('2026/04/15', { vertical_in: 23 })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/movement-benchmarks/2026%2F04%2F15')
  })

  it("surfaces the route's own message on 404 (entry not found)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'No benchmark for 2026-04-15.' }, { status: 404 }),
    )
    await expect(updateBenchmark('2026-04-15', { vertical_in: 23 })).rejects.toThrow(
      'No benchmark for 2026-04-15.',
    )
  })

  it('falls back to the descriptive non-OK message when the response has no JSON error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'something else' }, { status: 500 }))
    await expect(updateBenchmark('2026-04-15', { vertical_in: 23 })).rejects.toThrow(
      /Failed to update benchmark: 500/,
    )
  })
})

describe('deleteBenchmark', () => {
  it('DELETEs the date-keyed admin URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deleteBenchmark('2026-04-15')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/movement-benchmarks/2026-04-15')
    expect(init.method).toBe('DELETE')
  })

  it("surfaces the route's own message on 404 (entry-not-found)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'No benchmark for 2026-04-15.' }, { status: 404 }),
    )
    await expect(deleteBenchmark('2026-04-15')).rejects.toThrow('No benchmark for 2026-04-15.')
  })

  it('surfaces 401/403 admin-gate messages verbatim', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Admin only.' }, { status: 403 }),
    )
    await expect(deleteBenchmark('2026-04-15')).rejects.toThrow('Admin only.')
  })
})
