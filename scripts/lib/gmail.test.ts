/**
 * Tests for the shared Gmail client's pure helpers. No network: the HTTP
 * calls are exercised by the importers' runs, not here.
 */
import { describe, expect, it } from 'vitest'

import { mapLimit } from './gmail.mjs'

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
