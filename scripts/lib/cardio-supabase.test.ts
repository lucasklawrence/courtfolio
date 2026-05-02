import { describe, it, expect, vi } from 'vitest'

// Vitest happily resolves `.mjs` from a `.ts` test file. Public surface is
// minimal — only the helpers exported for cross-module use are reachable.
import { pruneOrphans } from './cardio-supabase.mjs'

/**
 * Tests for the orphan-prune helper that backs the "exact mirror"
 * import semantics introduced in #152. The real script integrates this
 * with `upsertCardioData`; these tests pin the empty-payload guard,
 * the PostgREST pagination loop, and the SELECT/DELETE wiring so a
 * future refactor can't silently turn a partial-export into a table
 * wipe — or miss orphans past PostgREST's default 1000-row cap.
 */

interface FakeSupabase {
  from: ReturnType<typeof vi.fn>
}

interface SelectResult {
  data: Array<Record<string, unknown>> | null
  error: unknown
}

/**
 * Build a chainable Supabase test double for the `from(table).select(col).range(from, to)`
 * call shape. `selectPages` is consumed in order — each entry returned
 * for one `.range()` call, so callers can simulate paginated results
 * by passing multiple pages.
 */
function makeFakeSupabase(opts: {
  selectPages?: SelectResult[]
  deleteResult?: { error: unknown }
}): {
  supabase: FakeSupabase
  rangeMock: ReturnType<typeof vi.fn>
  selectMock: ReturnType<typeof vi.fn>
  deleteMock: ReturnType<typeof vi.fn>
  deleteIn: ReturnType<typeof vi.fn>
} {
  const pages = opts.selectPages ?? [{ data: [], error: null }]
  const deleteResult = opts.deleteResult ?? { error: null }

  let pageIdx = 0
  const rangeMock = vi.fn().mockImplementation(() => {
    const page = pages[pageIdx++] ?? { data: [], error: null }
    return Promise.resolve(page)
  })
  const selectMock = vi.fn().mockReturnValue({ range: rangeMock })

  const deleteIn = vi.fn().mockResolvedValue(deleteResult)
  const deleteMock = vi.fn().mockReturnValue({ in: deleteIn })

  const supabase: FakeSupabase = {
    from: vi.fn(() => ({ select: selectMock, delete: deleteMock })),
  }
  return { supabase, rangeMock, selectMock, deleteMock, deleteIn }
}

describe('pruneOrphans', () => {
  it('is a no-op when keepKeys is empty (does not touch Supabase)', async () => {
    const { supabase } = makeFakeSupabase({})
    const result = await pruneOrphans(supabase, 'cardio_sessions', 'started_at', [])
    expect(result).toBe(0)
    // The whole point of the guard — an empty payload must not even
    // SELECT the table, otherwise a future refactor that drops the
    // early-return on `.length === 0` would silently wipe the table.
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns 0 and does not delete when there are no orphans', async () => {
    const { supabase, selectMock, deleteMock, rangeMock } = makeFakeSupabase({
      selectPages: [
        {
          data: [
            { started_at: '2026-04-26T08:00:00Z' },
            { started_at: '2026-04-21T07:00:00Z' },
          ],
          error: null,
        },
      ],
    })
    const result = await pruneOrphans(supabase, 'cardio_sessions', 'started_at', [
      '2026-04-26T08:00:00Z',
      '2026-04-21T07:00:00Z',
    ])
    expect(result).toBe(0)
    expect(selectMock).toHaveBeenCalledWith('started_at')
    expect(rangeMock).toHaveBeenCalledWith(0, 999)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes only the rows whose PK is not in keepKeys', async () => {
    const { supabase, deleteIn } = makeFakeSupabase({
      selectPages: [
        {
          data: [
            { started_at: '2026-04-26T08:00:00Z' },
            { started_at: '2026-04-21T07:00:00Z' },
            { started_at: '2026-04-17T08:00:00Z' },
          ],
          error: null,
        },
      ],
    })
    const result = await pruneOrphans(supabase, 'cardio_sessions', 'started_at', [
      '2026-04-26T08:00:00Z',
    ])
    expect(result).toBe(2)
    expect(deleteIn).toHaveBeenCalledWith('started_at', [
      '2026-04-21T07:00:00Z',
      '2026-04-17T08:00:00Z',
    ])
  })

  it('paginates the PK scan to cover tables larger than the page cap', async () => {
    // Use pageSize=2 so we don't have to fixture 1001 rows. Page 1 is
    // full (2 rows), page 2 is partial (1 row) → loop terminates after
    // the partial page without an extra empty-response request.
    const { supabase, rangeMock, deleteIn } = makeFakeSupabase({
      selectPages: [
        {
          data: [{ started_at: 'a' }, { started_at: 'b' }],
          error: null,
        },
        {
          data: [{ started_at: 'c' }],
          error: null,
        },
      ],
    })
    const result = await pruneOrphans(
      supabase,
      'cardio_sessions',
      'started_at',
      ['a', 'b'], // keep the first two; 'c' is an orphan only visible after pagination
      2, // pageSize
    )
    expect(result).toBe(1)
    expect(rangeMock).toHaveBeenCalledTimes(2)
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 1)
    expect(rangeMock).toHaveBeenNthCalledWith(2, 2, 3)
    expect(deleteIn).toHaveBeenCalledWith('started_at', ['c'])
  })

  it('terminates pagination on a full page followed by an empty page', async () => {
    // Edge case: every page is exactly full. Loop has to make one more
    // request to learn the table is drained, then break on the empty
    // response.
    const { supabase, rangeMock, deleteIn } = makeFakeSupabase({
      selectPages: [
        { data: [{ started_at: 'a' }, { started_at: 'b' }], error: null },
        { data: [], error: null },
      ],
    })
    const result = await pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['a'], 2)
    expect(result).toBe(1)
    expect(rangeMock).toHaveBeenCalledTimes(2)
    expect(deleteIn).toHaveBeenCalledWith('started_at', ['b'])
  })

  it('throws a descriptive error when the SELECT fails', async () => {
    const { supabase } = makeFakeSupabase({
      selectPages: [{ data: null, error: { message: 'JWT expired' } }],
    })
    await expect(
      pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['2026-04-26T08:00:00Z']),
    ).rejects.toThrow(/Failed to scan cardio_sessions for orphans.*JWT expired/)
  })

  it('throws a descriptive error when the DELETE fails', async () => {
    const { supabase } = makeFakeSupabase({
      selectPages: [
        {
          data: [{ started_at: '2026-04-26T08:00:00Z' }, { started_at: '2026-04-21T07:00:00Z' }],
          error: null,
        },
      ],
      deleteResult: { error: { message: 'permission denied' } },
    })
    await expect(
      pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['2026-04-26T08:00:00Z']),
    ).rejects.toThrow(/Failed to prune orphans from cardio_sessions.*permission denied/)
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid pageSize %s before any DB call (would infinite-loop)',
    async (pageSize) => {
      const { supabase } = makeFakeSupabase({})
      await expect(
        pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['a'], pageSize),
      ).rejects.toThrow(/pageSize must be a positive integer/)
      expect(supabase.from).not.toHaveBeenCalled()
    },
  )

  it('treats a null SELECT page the same as an empty page (no rows yet)', async () => {
    const { supabase, deleteMock } = makeFakeSupabase({
      selectPages: [{ data: null, error: null }],
    })
    const result = await pruneOrphans(supabase, 'cardio_resting_hr', 'date', ['2026-04-26'])
    expect(result).toBe(0)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
