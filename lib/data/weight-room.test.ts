import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getWeightRoomData } from './weight-room'

/**
 * Read-path tests for the Weight Room data layer (#79). Mocks the
 * browser Supabase client and tracks per-table fake queries so each
 * assertion can stub `weight_room_sets` and `weight_room_goals`
 * results independently.
 *
 * Sibling pattern: `lib/data/cardio.test.ts`.
 */

/** Stubbed PostgREST result a {@link FakeQuery} resolves with when awaited. */
interface FakeResult {
  data: Array<Record<string, unknown>> | null
  error: unknown
}

/**
 * Chainable + awaitable fake of the Supabase query builder. `select`/
 * `order` return the builder itself (so multi-key `.order().order()`
 * chains work, #229) and awaiting it resolves with {@link FakeQuery.result}
 * — mirroring the real builder, which is a thenable.
 */
interface FakeQuery extends PromiseLike<FakeResult> {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  /** Result the await resolves with; {@link stubTable} overwrites it. */
  result: FakeResult
}

const queriesByTable: Record<string, FakeQuery> = {}
const fromMock = vi.fn((table: string): FakeQuery => {
  if (!queriesByTable[table]) {
    const query: FakeQuery = {
      select: vi.fn(),
      order: vi.fn(),
      result: { data: [], error: null },
      then(onFulfilled, onRejected) {
        return Promise.resolve(this.result).then(onFulfilled, onRejected)
      },
    }
    query.select.mockReturnValue(query)
    query.order.mockReturnValue(query)
    queriesByTable[table] = query
  }
  return queriesByTable[table]
})
const browserClientMock = { from: fromMock }

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserSupabaseClient: () => browserClientMock,
}))

beforeEach(() => {
  for (const key of Object.keys(queriesByTable)) {
    delete queriesByTable[key]
  }
  fromMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubTable(
  table: string,
  data: Array<Record<string, unknown>> | null,
  error: unknown = null,
): void {
  const query = fromMock(table)
  query.result = { data, error }
}

describe('getWeightRoomData', () => {
  it('returns null when both tables are empty', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [])
    fromMock.mockClear()

    await expect(getWeightRoomData()).resolves.toBeNull()

    expect(fromMock).toHaveBeenCalledWith('weight_room_sets')
    expect(fromMock).toHaveBeenCalledWith('weight_room_goals')
  })

  it('orders sets by logged_at with deterministic tie-breakers, goals by exercise', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [])
    await getWeightRoomData()

    // Backdated sets share an identical noon logged_at (#229), so the
    // query must chain updated_at + id to keep tie order stable.
    expect(queriesByTable.weight_room_sets.order.mock.calls).toEqual([
      ['logged_at', { ascending: true }],
      ['updated_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(queriesByTable.weight_room_goals.order).toHaveBeenCalledWith('exercise', {
      ascending: true,
    })
  })

  it('assembles the WeightRoomData shape', async () => {
    stubTable(
      'weight_room_sets',
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          logged_at: '2026-05-07T08:00:00Z',
          exercise: 'pushups',
          reps: 25,
          updated_at: '2026-05-07T08:00:01Z',
        },
      ],
    )
    stubTable(
      'weight_room_goals',
      [
        {
          exercise: 'pushups',
          daily_target: 100,
          color: '#EA580C',
          updated_at: '2026-05-07T08:00:00Z',
        },
        {
          exercise: 'pullups',
          daily_target: 30,
          color: '#0EA5A1',
          updated_at: '2026-05-07T08:00:00Z',
        },
      ],
    )

    const data = await getWeightRoomData()
    expect(data).toEqual({
      imported_at: '2026-05-07T08:00:01Z',
      sets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          logged_at: '2026-05-07T08:00:00Z',
          exercise: 'pushups',
          reps: 25,
        },
      ],
      goals: [
        { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
        { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' },
      ],
    })
  })

  it('imported_at takes the latest updated_at across both tables', async () => {
    stubTable(
      'weight_room_sets',
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          logged_at: '2026-05-07T08:00:00Z',
          exercise: 'pushups',
          reps: 25,
          updated_at: '2026-05-07T08:00:01Z',
        },
      ],
    )
    stubTable(
      'weight_room_goals',
      [
        {
          exercise: 'pushups',
          daily_target: 100,
          color: '#EA580C',
          updated_at: '2026-05-07T09:30:00Z',
        },
      ],
    )

    const data = await getWeightRoomData()
    expect(data?.imported_at).toBe('2026-05-07T09:30:00Z')
  })

  it('throws a descriptive error when the sets query fails', async () => {
    stubTable('weight_room_sets', null, { message: 'JWT expired' })
    stubTable('weight_room_goals', [])
    await expect(getWeightRoomData()).rejects.toThrow(/JWT expired/)
  })

  it('throws a descriptive error when the goals query fails', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', null, { message: 'permission denied' })
    await expect(getWeightRoomData()).rejects.toThrow(/permission denied/)
  })

  it('throws when a row fails schema validation (e.g. negative reps)', async () => {
    stubTable(
      'weight_room_sets',
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          logged_at: '2026-05-07T08:00:00Z',
          exercise: 'pushups',
          reps: -5, // CHECK constraint blocks at DB level, but defense-in-depth at the schema too.
          updated_at: '2026-05-07T08:00:00Z',
        },
      ],
    )
    stubTable(
      'weight_room_goals',
      [
        {
          exercise: 'pushups',
          daily_target: 100,
          color: '#EA580C',
          updated_at: '2026-05-07T08:00:00Z',
        },
      ],
    )
    await expect(getWeightRoomData()).rejects.toThrow(
      /weight_room_sets failed schema validation/,
    )
  })
})
