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
 * `order`/`range` return the builder itself (so multi-key `.order().order()`
 * chains work, #229) and awaiting it resolves with {@link FakeQuery.result}
 * — mirroring the real builder, which is a thenable.
 *
 * When `.range(from, to)` has been called, the await resolves with just that
 * slice of `result.data`, so the paged sets read (#336) walks real page
 * boundaries instead of getting the whole array back on every request.
 */
interface FakeQuery extends PromiseLike<FakeResult> {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  /** Result the await resolves with; {@link stubTable} overwrites it. */
  result: FakeResult
  /** Inclusive `[from, to]` window from the most recent `.range()` call. */
  lastRange: [number, number] | null
}

const queriesByTable: Record<string, FakeQuery> = {}
const fromMock = vi.fn((table: string): FakeQuery => {
  if (!queriesByTable[table]) {
    const query: FakeQuery = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      result: { data: [], error: null },
      lastRange: null,
      then(onFulfilled, onRejected) {
        const { data, error } = this.result
        const paged =
          this.lastRange !== null && data !== null
            ? data.slice(this.lastRange[0], this.lastRange[1] + 1)
            : data
        return Promise.resolve({ data: paged, error }).then(onFulfilled, onRejected)
      },
    }
    query.select.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.range.mockImplementation((from: number, to: number) => {
      query.lastRange = [from, to]
      return query
    })
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
  error: unknown = null
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
    stubTable('weight_room_sets', [
      {
        id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-05-07T08:00:00Z',
        exercise: 'pushups',
        reps: 25,
        updated_at: '2026-05-07T08:00:01Z',
      },
    ])
    stubTable('weight_room_goals', [
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
    ])

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
      monthly_focus: [],
      exercises: [],
    })
  })

  it('assembles weighted sets, focus goals, and the monthly-focus roadmap (#255)', async () => {
    stubTable('weight_room_sets', [
      {
        id: '22222222-2222-4222-8222-222222222222',
        logged_at: '2026-07-01T08:00:00Z',
        exercise: 'shrugs',
        reps: 20,
        weight_lbs: 100,
        updated_at: '2026-07-01T08:00:01Z',
      },
    ])
    stubTable('weight_room_goals', [
      {
        exercise: 'shrugs',
        daily_target: 100,
        color: '#C9A268',
        kind: 'focus',
        updated_at: '2026-07-01T08:00:00Z',
      },
    ])
    stubTable('weight_room_monthly_focus', [
      {
        id: '33333333-3333-4333-8333-333333333333',
        exercise: 'shrugs',
        daily_target: 100,
        target_kind: 'reps',
        color: '#C9A268',
        category: 'upper',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        updated_at: '2026-07-01T08:00:00Z',
      },
    ])

    const data = await getWeightRoomData()
    expect(data?.sets).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        logged_at: '2026-07-01T08:00:00Z',
        exercise: 'shrugs',
        reps: 20,
        weight_lbs: 100,
      },
    ])
    expect(data?.goals).toEqual([
      { exercise: 'shrugs', daily_target: 100, color: '#C9A268', kind: 'focus' },
    ])
    expect(data?.monthly_focus).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        exercise: 'shrugs',
        daily_target: 100,
        target_kind: 'reps',
        color: '#C9A268',
        category: 'upper',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
      },
    ])
  })

  it('orders the monthly-focus roadmap by start_date descending (newest window first)', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [])
    await getWeightRoomData()

    expect(queriesByTable.weight_room_monthly_focus.order).toHaveBeenCalledWith('start_date', {
      ascending: false,
    })
  })

  it('imported_at takes the latest updated_at across both tables', async () => {
    stubTable('weight_room_sets', [
      {
        id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-05-07T08:00:00Z',
        exercise: 'pushups',
        reps: 25,
        updated_at: '2026-05-07T08:00:01Z',
      },
    ])
    stubTable('weight_room_goals', [
      {
        exercise: 'pushups',
        daily_target: 100,
        color: '#EA580C',
        updated_at: '2026-05-07T09:30:00Z',
      },
    ])

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
    stubTable('weight_room_sets', [
      {
        id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-05-07T08:00:00Z',
        exercise: 'pushups',
        reps: -5, // CHECK constraint blocks at DB level, but defense-in-depth at the schema too.
        updated_at: '2026-05-07T08:00:00Z',
      },
    ])
    stubTable('weight_room_goals', [
      {
        exercise: 'pushups',
        daily_target: 100,
        color: '#EA580C',
        updated_at: '2026-05-07T08:00:00Z',
      },
    ])
    await expect(getWeightRoomData()).rejects.toThrow(/weight_room_sets failed schema validation/)
  })
})

describe('getWeightRoomData — session membership (#374)', () => {
  it('carries workout_id and position through to the assembled set', async () => {
    stubTable('weight_room_sets', [
      {
        id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-07-15T18:05:00Z',
        exercise: 'pushups',
        reps: 20,
        workout_id: '22222222-2222-4222-8222-222222222222',
        position: 0,
        updated_at: '2026-07-15T18:05:01Z',
      },
    ])
    stubTable('weight_room_goals', [])

    const data = await getWeightRoomData()

    expect(data?.sets[0]).toMatchObject({
      workout_id: '22222222-2222-4222-8222-222222222222',
      position: 0,
    })
  })

  it('omits both for a loose set rather than surfacing nulls', async () => {
    // The overwhelming majority — every grease-the-groove set ever logged.
    // Absent is the real answer, so consumers test for it rather than for null.
    stubTable('weight_room_sets', [
      {
        id: '33333333-3333-4333-8333-333333333333',
        logged_at: '2026-07-15T18:05:00Z',
        exercise: 'pushups',
        reps: 20,
        workout_id: null,
        position: null,
        updated_at: '2026-07-15T18:05:01Z',
      },
    ])
    stubTable('weight_room_goals', [])

    const data = await getWeightRoomData()

    expect(data?.sets[0]).not.toHaveProperty('workout_id')
    expect(data?.sets[0]).not.toHaveProperty('position')
  })
})

describe('getWeightRoomData — exercise catalog (#373)', () => {
  /** One catalog row, with the not-null columns PostgREST always returns. */
  function catalogRow(
    slug: string,
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      slug,
      display_name: slug,
      equipment: 'bodyweight',
      muscle_group: 'full-body',
      load_multiplier: 1,
      is_unilateral: false,
      archived: false,
      updated_at: '2026-07-31T08:00:00Z',
      ...overrides,
    }
  }

  /** A goal row as read after #373 — no `load_multiplier` column. */
  function goalRow(exercise: string): Record<string, unknown> {
    return {
      exercise,
      daily_target: 100,
      color: '#EA580C',
      updated_at: '2026-07-31T08:00:00Z',
    }
  }

  it('joins load_multiplier from the catalog onto the goal', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('shrugs')])
    stubTable('weight_room_exercises', [
      catalogRow('shrugs', { equipment: 'dumbbell', load_multiplier: 2 }),
    ])

    const data = await getWeightRoomData()

    // The tonnage math in achievements.ts / monthly-focus.ts reads this off
    // the goal, so the join is what keeps those call sites working unchanged.
    expect(data?.goals[0]).toMatchObject({ exercise: 'shrugs', load_multiplier: 2 })
  })

  it('omits load_multiplier when the movement moves a single implement', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('pushups')])
    stubTable('weight_room_exercises', [catalogRow('pushups', { load_multiplier: 1 })])

    const data = await getWeightRoomData()

    // Absent rather than `1` — every read site defaults it, and omitting keeps
    // the pre-#373 shape for movements where nothing actually changed.
    expect(data?.goals[0]).not.toHaveProperty('load_multiplier')
  })

  it('joins display_name from the catalog onto the goal', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('barbell-bench-press')])
    stubTable('weight_room_exercises', [
      catalogRow('barbell-bench-press', { display_name: 'Barbell Bench Press' }),
    ])

    const data = await getWeightRoomData()

    // The ~10 surfaces that render a goal's name read it off the goal (#384),
    // so the join is what keeps them from each needing the roster threaded in.
    expect(data?.goals[0]).toMatchObject({
      exercise: 'barbell-bench-press',
      display_name: 'Barbell Bench Press',
    })
  })

  it('omits display_name when the catalog label is just the slug', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('pushups')])
    stubTable('weight_room_exercises', [catalogRow('pushups', { display_name: 'pushups' })])

    const data = await getWeightRoomData()

    // Same principle as load_multiplier: every render site falls back to the
    // slug, so an identical label is noise on the wire.
    expect(data?.goals[0]).not.toHaveProperty('display_name')
  })

  it('joins display_name onto a monthly focus too', async () => {
    stubTable('weight_room_sets', [])
    // The focus's anchor goal — a focus can't exist without one (FK), and the
    // assembler's null contract treats sets+goals empty as "no data at all".
    stubTable('weight_room_goals', [goalRow('farmers-carry')])
    stubTable('weight_room_monthly_focus', [
      {
        id: '44444444-4444-4444-8444-444444444444',
        exercise: 'farmers-carry',
        daily_target: 50,
        target_kind: 'reps',
        color: '#C9A268',
        category: 'upper',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        updated_at: '2026-07-31T08:00:00Z',
      },
    ])
    stubTable('weight_room_exercises', [
      catalogRow('farmers-carry', { display_name: "Farmer's Carry" }),
    ])

    const data = await getWeightRoomData()

    // Not derivable from the slug — an apostrophe is exactly the case that
    // rules out detokenizing the slug at render time.
    expect(data?.monthly_focus[0]).toMatchObject({
      exercise: 'farmers-carry',
      display_name: "Farmer's Carry",
    })
  })

  it('defaults to a single implement when a goal has no catalog row', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('orphaned')])
    stubTable('weight_room_exercises', [])

    // The FK makes this unreachable in practice; the point is that a
    // partially-migrated project still renders instead of throwing.
    const data = await getWeightRoomData()
    expect(data?.goals[0]).not.toHaveProperty('load_multiplier')
  })

  it('surfaces the roster on the assembled shape, archived rows included', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('pushups')])
    stubTable('weight_room_exercises', [
      catalogRow('pushups', { display_name: 'Pushups', muscle_group: 'chest' }),
      catalogRow('leg-press', {
        display_name: 'Leg Press',
        equipment: 'machine',
        muscle_group: 'legs',
        archived: true,
      }),
    ])

    const data = await getWeightRoomData()

    // The live columns are all NOT NULL DEFAULT, so PostgREST always returns
    // them and the converter carries them through — only a `null` (a fixture
    // or a pre-default row) collapses to absent.
    expect(data?.exercises).toEqual([
      {
        slug: 'pushups',
        display_name: 'Pushups',
        equipment: 'bodyweight',
        muscle_group: 'chest',
        load_multiplier: 1,
        is_unilateral: false,
        archived: false,
      },
      {
        slug: 'leg-press',
        display_name: 'Leg Press',
        equipment: 'machine',
        muscle_group: 'legs',
        load_multiplier: 1,
        is_unilateral: false,
        archived: true,
      },
    ])
  })

  it('throws a descriptive error when the catalog query fails', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('pushups')])
    stubTable('weight_room_exercises', null, { message: 'relation does not exist' })
    await expect(getWeightRoomData()).rejects.toThrow(/relation does not exist/)
  })

  it('throws when a catalog row carries an equipment value outside the enum', async () => {
    stubTable('weight_room_sets', [])
    stubTable('weight_room_goals', [goalRow('pushups')])
    stubTable('weight_room_exercises', [catalogRow('pushups', { equipment: 'trebuchet' })])
    await expect(getWeightRoomData()).rejects.toThrow(
      /weight_room_exercises failed schema validation/
    )
  })
})

describe('getWeightRoomData — paged sets read (#336)', () => {
  /** `count` well-formed set rows, one per minute so `logged_at` stays unique. */
  function manySets(count: number): Array<Record<string, unknown>> {
    return Array.from({ length: count }, (_, i) => ({
      id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
      logged_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      exercise: 'pushups',
      reps: 10,
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }))
  }

  const GOAL = {
    exercise: 'pushups',
    daily_target: 100,
    color: '#EA580C',
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  it('reads every set past PostgREST’s 1000-row response cap', async () => {
    // The real regression: an unbounded select silently returned only the
    // first 1000 rows, dropping the newest sets (the query sorts ascending).
    stubTable('weight_room_sets', manySets(1038))
    stubTable('weight_room_goals', [GOAL])

    const data = await getWeightRoomData()
    expect(data?.sets).toHaveLength(1038)
    // The last row is the one truncation used to eat.
    expect(data?.sets.at(-1)?.id).toBe('11111111-1111-4111-8111-000000001037')
  })

  it('requests successive pages until one comes back short', async () => {
    stubTable('weight_room_sets', manySets(1038))
    stubTable('weight_room_goals', [GOAL])

    await getWeightRoomData()

    expect(queriesByTable.weight_room_sets.range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('stops after a single page when the table fits under the cap', async () => {
    stubTable('weight_room_sets', manySets(3))
    stubTable('weight_room_goals', [GOAL])

    const data = await getWeightRoomData()
    expect(data?.sets).toHaveLength(3)
    // One full-size request returns 3 rows (< PAGE_SIZE), so the loop ends
    // without a second round-trip.
    expect(queriesByTable.weight_room_sets.range.mock.calls).toEqual([[0, 999]])
  })

  it('surfaces a page error rather than returning a partial log', async () => {
    stubTable('weight_room_sets', null, { message: 'connection reset' })
    stubTable('weight_room_goals', [GOAL])

    await expect(getWeightRoomData()).rejects.toThrow(
      /Failed to load weight room sets: connection reset/
    )
  })
})
