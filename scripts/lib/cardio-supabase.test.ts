import { describe, it, expect, vi } from 'vitest'

// Vitest happily resolves `.mjs` from a `.ts` test file. Public surface is
// minimal — only the helpers exported for cross-module use are reachable.
import { pruneStaleRows, upsertHrSamples } from './cardio-supabase.mjs'

/**
 * Tests for the stale-row prune helper that backs the "exact mirror"
 * import semantics introduced in #152 and corrected in #158. The real
 * script integrates this with `upsertCardioData`; these tests pin the
 * empty-payload guard, the timestamp-based DELETE wiring, and the
 * failure path so a future refactor can't reintroduce the PK-string
 * comparison bug or silently turn a partial-export into a table wipe.
 *
 * Regression guard: the original `pruneOrphans` (replaced by
 * `pruneStaleRows`) compared source PK strings against PostgREST's
 * normalized output, which fails the moment Postgres normalizes the
 * source value (`"2026-02-08"` → `"2026-02-08T00:00:00+00:00"`). The
 * new strategy never does string-PK comparison, so the bug class is
 * structurally impossible to recreate without redesigning the helper.
 */

interface FakeSupabase {
  from: ReturnType<typeof vi.fn>
}

/**
 * Build a chainable Supabase test double for the
 * `from(table).delete({ count: 'exact' }).lt('updated_at', importedAt)`
 * call shape. `deleteResult` is what the awaited `.lt(...)` resolves
 * to — `{ data, error, count }` per the real Supabase response.
 */
function makeFakeSupabase(opts: {
  deleteResult?: { error: unknown; count?: number | null }
}): {
  supabase: FakeSupabase
  deleteFactory: ReturnType<typeof vi.fn>
  ltMock: ReturnType<typeof vi.fn>
} {
  const result = opts.deleteResult ?? { error: null, count: 0 }
  const ltMock = vi.fn().mockResolvedValue(result)
  const deleteFactory = vi.fn().mockReturnValue({ lt: ltMock })
  const supabase: FakeSupabase = {
    from: vi.fn(() => ({ delete: deleteFactory })),
  }
  return { supabase, deleteFactory, ltMock }
}

const IMPORTED_AT = '2026-05-02T01:30:00.123Z'

describe('pruneStaleRows', () => {
  it('is a no-op when the batch upserted nothing for this table', async () => {
    const { supabase } = makeFakeSupabase({})
    const result = await pruneStaleRows(supabase, 'cardio_sessions', IMPORTED_AT, false)
    expect(result).toBe(0)
    // The whole point of the empty-payload guard — an import with no
    // rows for a table must not even attempt the DELETE, otherwise a
    // future refactor that drops the early-return would silently wipe
    // every existing row.
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('issues delete().lt with the exact batch timestamp when upserts happened', async () => {
    const { supabase, deleteFactory, ltMock } = makeFakeSupabase({
      deleteResult: { error: null, count: 0 },
    })
    const result = await pruneStaleRows(supabase, 'cardio_sessions', IMPORTED_AT, true)
    expect(result).toBe(0)
    expect(supabase.from).toHaveBeenCalledWith('cardio_sessions')
    // `count: 'exact'` is required so the response includes the row
    // count — without it the helper can't surface the number to the
    // import script's success log.
    expect(deleteFactory).toHaveBeenCalledWith({ count: 'exact' })
    // Strict less-than against the batch timestamp; just-upserted rows
    // (updated_at == importedAt) are preserved by `<`, only earlier
    // rows are removed.
    expect(ltMock).toHaveBeenCalledWith('updated_at', IMPORTED_AT)
  })

  it('returns the count surfaced by Supabase when rows are pruned', async () => {
    const { supabase } = makeFakeSupabase({
      deleteResult: { error: null, count: 3 },
    })
    const result = await pruneStaleRows(supabase, 'cardio_sessions', IMPORTED_AT, true)
    expect(result).toBe(3)
  })

  it('returns 0 when Supabase reports a null count (no matches)', async () => {
    const { supabase } = makeFakeSupabase({
      deleteResult: { error: null, count: null },
    })
    const result = await pruneStaleRows(supabase, 'cardio_resting_hr', IMPORTED_AT, true)
    expect(result).toBe(0)
  })

  it('throws a descriptive error when the DELETE fails', async () => {
    const { supabase } = makeFakeSupabase({
      deleteResult: { error: { message: 'permission denied' }, count: null },
    })
    await expect(
      pruneStaleRows(supabase, 'cardio_sessions', IMPORTED_AT, true),
    ).rejects.toThrow(/Failed to prune stale rows from cardio_sessions.*permission denied/)
  })

  it('REGRESSION (#158): does not depend on PK string equality between source and DB', async () => {
    // The bug being defended against: Postgres normalizes a date-only
    // source value (`"2026-02-08"`) to a full timestamp
    // (`"2026-02-08T00:00:00+00:00"`), so a PK-set-diff prune treated
    // every existing row as an orphan and wiped the table on the first
    // import. The new strategy compares timestamps server-side, so the
    // existence (or content) of any PK column is irrelevant to whether
    // a row gets pruned. This test pins that property by asserting the
    // helper never reads or compares PK columns at all.
    const { supabase, ltMock } = makeFakeSupabase({
      deleteResult: { error: null, count: 0 },
    })
    await pruneStaleRows(supabase, 'cardio_sessions', IMPORTED_AT, true)
    // Verify the prune issued exactly one delete-by-timestamp call,
    // never a select on a PK column. (`makeFakeSupabase` doesn't even
    // wire a `.select()` chain — the test double would throw on access.)
    expect(ltMock).toHaveBeenCalledTimes(1)
    expect(ltMock).toHaveBeenCalledWith('updated_at', IMPORTED_AT)
  })
})

/**
 * Build a Supabase double that records the chained
 * `from(table).delete().eq('session_started_at', X)` and
 * `from(table).insert(rows)` call sequence used by `upsertHrSamples`. The
 * factory tracks every call across both shapes so a test can assert the
 * delete-then-insert ordering and the per-batch insert sizes.
 */
function makeHrSamplesFakeSupabase(): {
  supabase: { from: ReturnType<typeof vi.fn> }
  calls: Array<
    | { kind: 'delete'; table: string; key: string }
    | { kind: 'insert'; table: string; rowCount: number }
  >
} {
  const calls: Array<
    | { kind: 'delete'; table: string; key: string }
    | { kind: 'insert'; table: string; rowCount: number }
  > = []
  const supabase = {
    from: vi.fn((table: string) => ({
      delete: () => ({
        eq: (_col: string, key: string) => {
          calls.push({ kind: 'delete', table, key })
          return Promise.resolve({ error: null })
        },
      }),
      insert: (rows: unknown[]) => {
        calls.push({ kind: 'insert', table, rowCount: rows.length })
        return Promise.resolve({ error: null })
      },
    })),
  }
  return { supabase, calls }
}

const SESSION_TS = '2026-04-15T08:32:18-07:00'

/** Build N samples spaced 5 seconds apart starting at session start. */
function fakeSamples(n: number) {
  const start = new Date('2026-04-15T15:32:18Z').getTime()
  return Array.from({ length: n }, (_, i) => ({
    ts: new Date(start + i * 5000).toISOString(),
    bpm: 130 + (i % 30),
  }))
}

describe('upsertHrSamples', () => {
  it('runs delete then insert for a session with samples', async () => {
    const { supabase, calls } = makeHrSamplesFakeSupabase()
    const samples = fakeSamples(10)
    const total = await upsertHrSamples(supabase, [
      { date: SESSION_TS, activity: 'running', duration_seconds: 1800, hr_samples: samples },
    ])
    expect(total).toBe(10)
    // delete must come before insert; the FK + idempotency contract
    // depends on the prior session's samples being gone before new
    // rows arrive.
    expect(calls).toEqual([
      { kind: 'delete', table: 'cardio_session_hr_samples', key: SESSION_TS },
      { kind: 'insert', table: 'cardio_session_hr_samples', rowCount: 10 },
    ])
  })

  it('chunks inserts into 500-row batches', async () => {
    const { supabase, calls } = makeHrSamplesFakeSupabase()
    const samples = fakeSamples(1250)
    const total = await upsertHrSamples(supabase, [
      { date: SESSION_TS, activity: 'running', duration_seconds: 7200, hr_samples: samples },
    ])
    expect(total).toBe(1250)
    const inserts = calls.filter((c) => c.kind === 'insert') as Array<{
      kind: 'insert'
      table: string
      rowCount: number
    }>
    expect(inserts.map((c) => c.rowCount)).toEqual([500, 500, 250])
  })

  it('still issues a delete for sessions with no samples (clears stale rows)', async () => {
    const { supabase, calls } = makeHrSamplesFakeSupabase()
    const total = await upsertHrSamples(supabase, [
      { date: SESSION_TS, activity: 'stair', duration_seconds: 1500, hr_samples: null },
    ])
    expect(total).toBe(0)
    expect(calls).toEqual([
      { kind: 'delete', table: 'cardio_session_hr_samples', key: SESSION_TS },
    ])
  })

  it('processes each session independently in payload order', async () => {
    const { supabase, calls } = makeHrSamplesFakeSupabase()
    const total = await upsertHrSamples(supabase, [
      { date: SESSION_TS, activity: 'running', duration_seconds: 1800, hr_samples: fakeSamples(3) },
      {
        date: '2026-04-16T09:00:00-07:00',
        activity: 'stair',
        duration_seconds: 1500,
        hr_samples: fakeSamples(2),
      },
    ])
    expect(total).toBe(5)
    expect(calls.map((c) => c.kind)).toEqual(['delete', 'insert', 'delete', 'insert'])
  })

  it('throws a descriptive error when the DELETE fails', async () => {
    const supabase = {
      from: vi.fn(() => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { message: 'permission denied' } }),
        }),
        insert: () => Promise.resolve({ error: null }),
      })),
    }
    await expect(
      upsertHrSamples(supabase, [
        {
          date: SESSION_TS,
          activity: 'running',
          duration_seconds: 1800,
          hr_samples: fakeSamples(1),
        },
      ]),
    ).rejects.toThrow(/Failed to clear cardio_session_hr_samples.*permission denied/)
  })

  it('throws a descriptive error when the INSERT fails', async () => {
    const supabase = {
      from: vi.fn(() => ({
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: { message: 'unique violation' } }),
      })),
    }
    await expect(
      upsertHrSamples(supabase, [
        {
          date: SESSION_TS,
          activity: 'running',
          duration_seconds: 1800,
          hr_samples: fakeSamples(1),
        },
      ]),
    ).rejects.toThrow(/Failed to insert cardio_session_hr_samples.*unique violation/)
  })
})
