/**
 * Tests for the OTbeat Supabase mapping + append-only upsert (#251).
 *
 * Focus is the risky logic: the timezone/DST conversion that builds
 * `started_at`, and the dedupe-by-`started_at` guarantee that makes the
 * weekly re-pull idempotent and never prunes history. The Supabase client is
 * faked so no network/credentials are needed.
 */
import { describe, expect, it } from 'vitest'

import {
  findUntypedOtfSessions,
  recordToRow,
  toStartedAt,
  upsertOtfSessions,
} from './otbeat-supabase.mjs'

/** Local alias for the parser's JSDoc record type, for typing fixtures. */
type OtbeatRecord = import('./otbeat-parser.mjs').OtbeatRecord

const TZ = 'America/Los_Angeles'

/**
 * Full {@link OtbeatRecord} with every stat field nulled — the realistic
 * "header-only" shape the parser emits for a class format that reports
 * only date/time (the parser always assigns every field, `null` when
 * absent). Keeps the dedupe fixtures terse while satisfying the record's
 * required-but-nullable properties.
 */
function bareRecord(date: string, time: string): OtbeatRecord {
  return {
    date,
    time,
    coach: null,
    studio: null,
    zones_min: null,
    calories: null,
    splat: null,
    avg_hr: null,
    peak_hr: null,
    steps: null,
    treadmill: null,
    rower: null,
  }
}

describe('toStartedAt', () => {
  it('interprets the wall time in Pacific DAYLIGHT time (summer, -07:00)', () => {
    expect(toStartedAt('06/27/2026', '9:30AM', TZ)).toBe('2026-06-27T16:30:00.000Z')
  })

  it('interprets the wall time in Pacific STANDARD time (winter, -08:00)', () => {
    // Same wall clock, different offset — proves DST is handled, not hardcoded.
    expect(toStartedAt('01/15/2026', '9:30AM', TZ)).toBe('2026-01-15T17:30:00.000Z')
  })

  it('handles PM times that roll over to the next UTC day', () => {
    expect(toStartedAt('06/27/2026', '6:45PM', TZ)).toBe('2026-06-28T01:45:00.000Z')
  })

  it('handles 12-hour noon/midnight edges', () => {
    expect(toStartedAt('06/27/2026', '12:00PM', TZ)).toBe('2026-06-27T19:00:00.000Z')
    expect(toStartedAt('06/27/2026', '12:30AM', TZ)).toBe('2026-06-27T07:30:00.000Z')
  })

  it('throws on unparseable date/time', () => {
    expect(() => toStartedAt('2026-06-27', '9:30AM', TZ)).toThrow(/date/)
    expect(() => toStartedAt('06/27/2026', '0930', TZ)).toThrow(/time/)
  })
})

describe('recordToRow', () => {
  it('maps zone minutes to explicit columns and passes blocks through as JSONB', () => {
    const row = recordToRow(
      {
        date: '06/27/2026',
        time: '9:30AM',
        coach: 'Mara Magistad',
        studio: 'Marina Del Rey, CA',
        zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
        calories: 776,
        splat: 15,
        avg_hr: 133,
        peak_hr: 164,
        steps: 3508,
        treadmill: { distance_mi: 1.09, time: '11:24' },
        rower: { distance_m: 2509, time: '7:58' },
      },
      TZ
    )
    expect(row).toMatchObject({
      started_at: '2026-06-27T16:30:00.000Z',
      coach: 'Mara Magistad',
      studio: 'Marina Del Rey, CA',
      calories: 776,
      splat: 15,
      steps: 3508,
      avg_hr: 133,
      peak_hr: 164,
      zone_gray_min: 1,
      zone_blue_min: 11,
      zone_green_min: 29,
      zone_orange_min: 14,
      zone_red_min: 1,
      treadmill: { distance_mi: 1.09 },
      rower: { distance_m: 2509 },
    })
  })

  it('nulls out missing zones / blocks', () => {
    const row = recordToRow(bareRecord('05/30/2026', '9:30AM'), TZ)
    expect(row.zone_gray_min).toBeNull()
    expect(row.treadmill).toBeNull()
    expect(row.rower).toBeNull()
  })

  it('auto-flags a belt-malfunction session as excluded (#268)', () => {
    // 05/30 anomaly: near-zero output, no machine block.
    const row = recordToRow({ ...bareRecord('05/30/2026', '9:30AM'), calories: 4, splat: 0 }, TZ)
    expect(row.excluded).toBe(true)
    expect(row.excluded_reason).toMatch(/^auto:/)
  })

  it('leaves a real class un-excluded', () => {
    const row = recordToRow(
      {
        ...bareRecord('06/27/2026', '9:30AM'),
        calories: 776,
        splat: 15,
        treadmill: { distance_mi: 1.09, time: '11:24' },
        rower: { distance_m: 2509, time: '7:58' },
      },
      TZ
    )
    expect(row.excluded).toBe(false)
    expect(row.excluded_reason).toBeNull()
  })

  it('infers class_type from the machine signature and never writes class_type_override (#271)', () => {
    // Both blocks, tread 11:24 (684s) > rower 7:58 (478s) → 'Tread + Row'.
    const row = recordToRow(
      {
        ...bareRecord('06/27/2026', '9:30AM'),
        calories: 776,
        splat: 15,
        treadmill: { distance_mi: 1.09, time: '11:24' },
        rower: { distance_m: 2509, time: '7:58' },
      },
      TZ
    )
    expect(row.class_type).toBe('Tread + Row')
    // The override column is manual-only; the append-only importer must never
    // set it (else a re-pull would clobber a human edit).
    expect(row.class_type_override).toBeUndefined()
  })

  it('labels a tread-only class Tread-focused', () => {
    const row = recordToRow(
      {
        ...bareRecord('05/07/2026', '9:30AM'),
        calories: 692,
        splat: 15,
        treadmill: { distance_mi: 2.4, time: '26:13' },
      },
      TZ
    )
    expect(row.class_type).toBe('Tread-focused')
  })

  it('leaves class_type null for the belt-malfunction shape', () => {
    const row = recordToRow({ ...bareRecord('05/30/2026', '9:30AM'), calories: 4, splat: 0 }, TZ)
    expect(row.class_type).toBeNull()
  })
})

/**
 * The fake's public shape — the client param `upsertOtfSessions` expects,
 * intersected with the `inserted` capture so tests can assert what was
 * written. Deriving the client type from the function's own parameter
 * keeps the fake in lockstep with the real signature.
 */
type FakeClient = Parameters<typeof upsertOtfSessions>[0] & {
  inserted: Array<Record<string, unknown>>
  /** Captured `update()` patches from the class_type backfill pass. */
  updates: Array<Record<string, unknown>>
  /** The seeded rows, mutated in place by the backfill, for post-assertions. */
  rows: Array<Record<string, unknown>>
  /** Every `[from, to]` page requested, to assert the read paginates. */
  ranges: Array<[number, number]>
}

/** A seeded existing row. A bare string is shorthand for "already has a type". */
type SeedRow = string | { started_at: string; class_type?: string | null; excluded?: boolean }

/**
 * Minimal stand-in for the supabase-js client. `from().select()` returns a
 * thenable builder so it serves both the upsert path's direct `await select()`
 * and the `.eq().is().order()` chain in `findUntypedOtfSessions`;
 * `from().upsert()` captures inserts, and `from().update().eq()` applies the
 * class_type backfill to the seeded rows and captures it. Cast through
 * `unknown` to the real client type — only the surface these paths touch is
 * implemented.
 */
function fakeClient(existing: SeedRow[]): FakeClient {
  // A bare string seeds a row that already has a class_type, so the backfill
  // pass leaves it alone — that's the pre-existing tests' expectation.
  const rows: Array<Record<string, unknown>> = existing.map((s) =>
    typeof s === 'string'
      ? { started_at: s, class_type: 'Tread + Row', excluded: false, coach: null, calories: null }
      : { excluded: false, coach: null, calories: null, class_type: null, ...s }
  )
  const inserted: Array<Record<string, unknown>> = []
  const updates: Array<Record<string, unknown>> = []

  /**
   * Thenable query builder: collects filters, resolves to the matching rows.
   * `range` slices like PostgREST's inclusive bounds so the paginated read of
   * existing keys is exercised for real, and every page request is recorded.
   */
  const ranges: Array<[number, number]> = []
  function builder() {
    const filters: Array<(r: Record<string, unknown>) => boolean> = []
    let slice: [number, number] | null = null
    const self = {
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val)
        return self
      },
      is(col: string, val: unknown) {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val))
        return self
      },
      order() {
        return self
      },
      range(from: number, to: number) {
        slice = [from, to]
        ranges.push([from, to])
        return self
      },
      then<T>(
        resolve: (v: { data: Array<Record<string, unknown>>; error: null }) => T,
        reject?: (e: unknown) => T
      ) {
        let data = rows.filter((r) => filters.every((f) => f(r)))
        if (slice) data = data.slice(slice[0], slice[1] + 1) // `to` is inclusive
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return self
  }

  const client = {
    from() {
      return {
        select: () => builder(),
        upsert: async (newRows: Array<Record<string, unknown>>) => {
          inserted.push(...newRows)
          return { error: null }
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            const target = rows.find((r) => r[col] === val)
            if (target) Object.assign(target, patch)
            updates.push({ ...patch, [col]: val })
            return { error: null }
          },
        }),
      }
    },
    inserted,
    updates,
    rows,
    ranges,
  }
  return client as unknown as FakeClient
}

describe('upsertOtfSessions (append-only)', () => {
  const recA = bareRecord('06/27/2026', '9:30AM')
  const recB = bareRecord('06/25/2026', '6:45PM')

  it('inserts only sessions whose started_at is not already present', async () => {
    // recA already in the table; recB is new.
    const client = fakeClient(['2026-06-27T16:30:00+00:00'])
    const summary = await upsertOtfSessions(client, [recA, recB], { timeZone: TZ })
    expect(summary).toEqual({ added: 1, skipped: 1, repaired: 0, total: 2 })
    expect(client.inserted).toHaveLength(1)
    expect(client.inserted[0].started_at).toBe('2026-06-26T01:45:00.000Z') // recB (06/25 6:45PM PDT)
  })

  it('is idempotent — a re-pull with everything present adds 0 and writes nothing', async () => {
    const client = fakeClient(['2026-06-27T16:30:00+00:00', '2026-06-26T01:45:00+00:00'])
    const summary = await upsertOtfSessions(client, [recA, recB], { timeZone: TZ })
    expect(summary).toEqual({ added: 0, skipped: 2, repaired: 0, total: 2 })
    expect(client.inserted).toHaveLength(0)
    expect(client.updates).toHaveLength(0)
  })

  it('dedupes duplicates within a single batch', async () => {
    const client = fakeClient([])
    const summary = await upsertOtfSessions(client, [recA, recA], { timeZone: TZ })
    expect(summary.added).toBe(1)
    expect(client.inserted).toHaveLength(1)
  })
})

/**
 * CodeRabbit #334: an unranged select is capped at PostgREST's `max_rows` and
 * returns the first page with no error, so past that cap existing rows would
 * look absent — invisible to the class_type backfill and miscounted in `total`.
 */
describe('upsertOtfSessions (paginated read of existing keys)', () => {
  /** One more than a full 500-row page, so a second page is required. */
  const PAGE = 500
  const seeded = Array.from({ length: PAGE + 1 }, (_, i) => ({
    // Distinct, ordered timestamps: 2026-01-01T00:00Z + i minutes.
    started_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    class_type: 'Tread + Row',
  }))

  it('pages until a short page, seeing every existing row', async () => {
    const client = fakeClient(seeded)
    // This record matches the first seeded row, so there is nothing new to add.
    const rec = bareRecord('01/01/2026', '12:00AM')
    const summary = await upsertOtfSessions(client, [rec], { timeZone: 'UTC' })

    // Two pages requested: [0,499] then [500,999] (short → stop).
    expect(client.ranges).toEqual([
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
    ])
    // All 501 existing rows were seen, so `total` isn't truncated to 500.
    expect(summary.total).toBe(PAGE + 1)
    expect(summary.added).toBe(0)
  })

  it('finds a row beyond the first page, so the backfill is not truncated', async () => {
    // The LAST seeded row (index 500, i.e. on page 2) is the one missing a type.
    const withLateNull = seeded.map((r, i) =>
      i === PAGE ? { ...r, class_type: null } : r
    )
    const client = fakeClient(withLateNull)
    // A record matching that last row (00:00Z + 500 min = 08:20Z), carrying a
    // treadmill block so the classifier yields 'Tread-focused'.
    expect(withLateNull[PAGE].started_at).toBe('2026-01-01T08:20:00.000Z')
    const rec = {
      ...bareRecord('01/01/2026', '8:20AM'),
      treadmill: { time: '20:00' },
    } as OtbeatRecord
    const summary = await upsertOtfSessions(client, [rec], { timeZone: 'UTC' })

    expect(summary.added).toBe(0)
    expect(summary.repaired).toBe(1) // would be 0 if the read stopped at page 1
    expect(client.rows[PAGE].class_type).toBe('Tread-focused')
  })
})

/**
 * The #271 ingest race: rows inserted by a pre-#271 importer kept
 * `class_type = null`, and append-only insertion could never fix them.
 */
describe('upsertOtfSessions (null class_type backfill)', () => {
  const recA = bareRecord('06/27/2026', '9:30AM')
  const KEY_A = '2026-06-27T16:30:00+00:00'

  /** recA has no treadmill/rower and 0 calories, so give it a real machine block. */
  function typedRecord(): OtbeatRecord {
    return { ...bareRecord('06/27/2026', '9:30AM'), treadmill: { time: '20:00' } } as OtbeatRecord
  }

  it('backfills a null class_type on a row that is already present', async () => {
    const client = fakeClient([{ started_at: KEY_A, class_type: null }])
    const summary = await upsertOtfSessions(client, [typedRecord()], { timeZone: TZ })
    expect(summary).toEqual({ added: 0, skipped: 1, repaired: 1, total: 1 })
    // Only class_type is written — never the override or the excluded flags.
    expect(client.updates).toEqual([{ class_type: 'Tread-focused', started_at: KEY_A }])
    expect(client.rows[0].class_type).toBe('Tread-focused')
  })

  it('never overwrites a class_type that is already set', async () => {
    const client = fakeClient([{ started_at: KEY_A, class_type: '2G' }])
    const summary = await upsertOtfSessions(client, [typedRecord()], { timeZone: TZ })
    expect(summary.repaired).toBe(0)
    expect(client.updates).toHaveLength(0)
    expect(client.rows[0].class_type).toBe('2G')
  })

  it('leaves a null class_type alone when the classifier also yields null', async () => {
    // recA has no machine block and 0 calories — the belt-malfunction shape,
    // which classifies to null and must stay null rather than churn an update.
    const client = fakeClient([{ started_at: KEY_A, class_type: null, excluded: true }])
    const summary = await upsertOtfSessions(client, [recA], { timeZone: TZ })
    expect(summary.repaired).toBe(0)
    expect(client.updates).toHaveLength(0)
    expect(client.rows[0].class_type).toBeNull()
  })
})

describe('findUntypedOtfSessions', () => {
  it('returns counted sessions missing a class_type', async () => {
    const client = fakeClient([
      { started_at: '2026-07-02T16:30:00+00:00', class_type: null },
      { started_at: '2026-07-03T16:30:00+00:00', class_type: 'Tread + Row' },
    ])
    const untyped = await findUntypedOtfSessions(client)
    expect(untyped.map((s) => s.started_at)).toEqual(['2026-07-02T16:30:00+00:00'])
  })

  it('exempts excluded sessions — a malfunction has no inferable type', async () => {
    const client = fakeClient([
      { started_at: '2026-05-30T16:30:00+00:00', class_type: null, excluded: true },
    ])
    expect(await findUntypedOtfSessions(client)).toEqual([])
  })

  it('is empty when every counted session has a type', async () => {
    const client = fakeClient(['2026-07-03T16:30:00+00:00'])
    expect(await findUntypedOtfSessions(client)).toEqual([])
  })
})
