import { describe, it, expect, vi } from 'vitest'

// Vitest happily resolves `.mjs` from a `.ts` test file. Public surface is
// minimal — only the helpers exported for cross-module use are reachable.
import { pruneOrphans } from './cardio-supabase.mjs'

/**
 * Tests for the orphan-prune helper that backs the "exact mirror"
 * import semantics introduced in #152. The real script integrates this
 * with `upsertCardioData`; these tests pin the empty-payload guard and
 * the SELECT/DELETE wiring so a future refactor can't silently turn a
 * partial-export into a table wipe.
 */

interface FakeSupabase {
  from: ReturnType<typeof vi.fn>
}

/**
 * Build a chainable Supabase test double: `from(table).select(col)` resolves
 * with `selectResult`, and `from(table).delete().in(col, list)` resolves
 * with `deleteResult`. Each `.in()` call is recorded so tests can assert
 * the exact orphan list the helper computed.
 */
function makeFakeSupabase(opts: {
  selectResult?: { data: Array<Record<string, unknown>> | null; error: unknown }
  deleteResult?: { error: unknown }
}): { supabase: FakeSupabase; deleteIn: ReturnType<typeof vi.fn>; selectMock: ReturnType<typeof vi.fn>; deleteMock: ReturnType<typeof vi.fn> } {
  const selectResult = opts.selectResult ?? { data: [], error: null }
  const deleteResult = opts.deleteResult ?? { error: null }
  const deleteIn = vi.fn().mockResolvedValue(deleteResult)
  const selectMock = vi.fn().mockResolvedValue(selectResult)
  const deleteMock = vi.fn().mockReturnValue({ in: deleteIn })
  const supabase: FakeSupabase = {
    from: vi.fn(() => ({
      select: selectMock,
      delete: deleteMock,
    })),
  }
  return { supabase, deleteIn, selectMock, deleteMock }
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
    const { supabase, selectMock, deleteMock } = makeFakeSupabase({
      selectResult: {
        data: [{ started_at: '2026-04-26T08:00:00Z' }, { started_at: '2026-04-21T07:00:00Z' }],
        error: null,
      },
    })
    const result = await pruneOrphans(supabase, 'cardio_sessions', 'started_at', [
      '2026-04-26T08:00:00Z',
      '2026-04-21T07:00:00Z',
    ])
    expect(result).toBe(0)
    expect(selectMock).toHaveBeenCalledWith('started_at')
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes only the rows whose PK is not in keepKeys', async () => {
    const { supabase, deleteIn } = makeFakeSupabase({
      selectResult: {
        // Three existing rows; the import only knows about one — the
        // other two are orphans (deleted in HealthKit, never re-exported).
        data: [
          { started_at: '2026-04-26T08:00:00Z' },
          { started_at: '2026-04-21T07:00:00Z' },
          { started_at: '2026-04-17T08:00:00Z' },
        ],
        error: null,
      },
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

  it('throws a descriptive error when the SELECT fails', async () => {
    const { supabase } = makeFakeSupabase({
      selectResult: { data: null, error: { message: 'JWT expired' } },
    })
    await expect(
      pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['2026-04-26T08:00:00Z']),
    ).rejects.toThrow(/Failed to scan cardio_sessions for orphans.*JWT expired/)
  })

  it('throws a descriptive error when the DELETE fails', async () => {
    const { supabase } = makeFakeSupabase({
      selectResult: {
        data: [{ started_at: '2026-04-26T08:00:00Z' }, { started_at: '2026-04-21T07:00:00Z' }],
        error: null,
      },
      deleteResult: { error: { message: 'permission denied' } },
    })
    await expect(
      pruneOrphans(supabase, 'cardio_sessions', 'started_at', ['2026-04-26T08:00:00Z']),
    ).rejects.toThrow(/Failed to prune orphans from cardio_sessions.*permission denied/)
  })

  it('treats a null SELECT result the same as an empty array (no rows yet)', async () => {
    const { supabase, deleteMock } = makeFakeSupabase({
      selectResult: { data: null, error: null },
    })
    const result = await pruneOrphans(supabase, 'cardio_resting_hr', 'date', ['2026-04-26'])
    expect(result).toBe(0)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
