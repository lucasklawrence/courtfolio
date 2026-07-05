import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCardioSession } from './cardio-server'

/**
 * Tests for the per-session server reader (#165), focused on the HR-sample
 * read paging around PostgREST's per-response row cap. A busy class can log
 * more than 1000 samples — one real session already has 1287 — so a single
 * `.order().range()` page would drop the tail of the HR curve. The mock
 * drives the session lookup (`.maybeSingle()`) and the paged sample stream
 * (`.range()`) independently.
 *
 * Sibling pattern: `lib/data/cardio.test.ts` (the browser assembler).
 */

/** Chainable stub for the `.maybeSingle()`-terminated session lookup. */
interface SessionBuilder {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

/** Chainable stub for the `.range()`-terminated HR-sample read. */
interface SamplesBuilder {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
}

let sessionBuilder: SessionBuilder
let samplesBuilder: SamplesBuilder

const fromMock = vi.fn((table: string) =>
  table === 'cardio_sessions' ? sessionBuilder : samplesBuilder,
)

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ from: fromMock }),
}))

/** A schema-valid `cardio_sessions` row for the session lookup. */
const SESSION_ROW = {
  started_at: '2026-07-01T08:00:00Z',
  activity: 'stair',
  duration_seconds: 1800,
  distance_meters: null,
  avg_hr: 150,
  max_hr: 175,
  pace_seconds_per_km: null,
  zone1_seconds: null,
  zone2_seconds: null,
  zone3_seconds: null,
  zone4_seconds: null,
  zone5_seconds: null,
  meters_per_heartbeat: null,
}

/** Build `n` schema-valid HR-sample rows with distinct timestamps. */
function sampleRows(n: number, startIndex = 0): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({
    session_started_at: SESSION_ROW.started_at,
    sample_at: `2026-07-01T08:${String(startIndex + i).padStart(4, '0')}Z`,
    bpm: 120 + ((startIndex + i) % 40),
  }))
}

beforeEach(() => {
  fromMock.mockClear()
  sessionBuilder = {
    select: vi.fn(() => sessionBuilder),
    eq: vi.fn(() => sessionBuilder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: SESSION_ROW, error: null })),
  }
  samplesBuilder = {
    select: vi.fn(() => samplesBuilder),
    eq: vi.fn(() => samplesBuilder),
    order: vi.fn(() => samplesBuilder),
    range: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }
})

describe('getCardioSession', () => {
  it('pages the HR samples past the row cap so the curve keeps its tail', async () => {
    // A full first page (== the page size) forces a second request; the
    // short second page terminates the loop. Without pagination the last
    // five samples — the end of the workout — would vanish.
    const firstPage = sampleRows(1000, 0)
    const secondPage = sampleRows(5, 1000)
    samplesBuilder.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null })

    const detail = await getCardioSession(SESSION_ROW.started_at)

    expect(detail?.samples).toHaveLength(1005)
    // The final sample survived — it only existed on the second page.
    expect(detail?.samples.at(-1)).toEqual({ ts: '2026-07-01T08:1004Z', bpm: 120 + (1004 % 40) })
    // Two contiguous windows were requested with the right bounds.
    expect(samplesBuilder.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(samplesBuilder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('returns null when no session exists at the timestamp', async () => {
    sessionBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(getCardioSession('2000-01-01T00:00:00Z')).resolves.toBeNull()
  })

  it('surfaces an HR-sample read error rather than rendering a partial curve', async () => {
    samplesBuilder.range.mockResolvedValueOnce({
      data: null,
      error: { message: 'statement timeout' },
    })
    await expect(getCardioSession(SESSION_ROW.started_at)).rejects.toThrow(/statement timeout/)
  })
})
