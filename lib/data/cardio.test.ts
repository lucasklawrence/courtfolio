import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { getCardioData } from './cardio'

/**
 * `getCardioData` is a thin fetch wrapper that mirrors the empty-state
 * behavior of `getMovementBenchmarks`: 404 → return a sentinel (here `null`,
 * since `CardioData` is an object and `[]` wouldn't typecheck), other non-OK
 * responses → throw.
 */

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getCardioData', () => {
  it('fetches /data/cardio.json by default', async () => {
    const payload = {
      imported_at: '2026-04-26T00:00:00Z',
      sessions: [],
      resting_hr_trend: [],
      vo2max_trend: [],
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(getCardioData()).resolves.toEqual(payload)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/data/cardio.json')
  })

  it('returns null on 404 (pre-baseline empty state, no cardio.json yet)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))
    await expect(getCardioData()).resolves.toBeNull()
  })

  it('throws on 500 with status code in the message', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    )
    await expect(getCardioData()).rejects.toThrow(/500/)
  })

  it('throws when the response is OK but the body is invalid JSON', async () => {
    // Response.json() rejects on bad JSON — getCardioData lets that bubble up.
    fetchMock.mockResolvedValueOnce(
      new Response('not valid json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(getCardioData()).rejects.toThrow()
  })
})
