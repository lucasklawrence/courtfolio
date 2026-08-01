import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { WeightRoomData } from '@/types/weight-room'

import { LogDataIsland } from './LogDataIsland'

/**
 * Harness for the Log View's client island (#366).
 *
 * Everything this island *composes* — rings, quick-log, set list, streak
 * badges — has its own test file. What had none was the island itself: the
 * fetch/error/race orchestration and the day-scoping that decides which
 * numbers those children are handed. That gap is why the #365 regression
 * shipped, where pointing the day picker at a past date scored it against
 * today's target.
 *
 * So these tests deliberately assert the *wiring*, not the children's
 * rendering. The `ActivityRings` accessible label ("pullups 30 of 30") is the
 * cheapest honest window onto what the island actually passed down.
 *
 * `getWeightRoomData` is stubbed at the data layer, matching
 * `CombineDataIsland.test.tsx`; the write paths go through global `fetch`, so
 * that is stubbed too.
 */

const getWeightRoomDataMock = vi.fn<() => Promise<WeightRoomData | null>>()

vi.mock('@/lib/data/weight-room', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/data/weight-room')>('@/lib/data/weight-room')
  return { ...actual, getWeightRoomData: () => getWeightRoomDataMock() }
})

/**
 * A day far enough in the past that it can't collide with the real "today"
 * the component computes at mount, and that sits before the goal's raise.
 */
const PAST_DAY = '2020-07-15'

/**
 * Pullups at 50/day now, but 30/day back when {@link PAST_DAY} was logged.
 * The gap between the two is the whole point: a day scored against the wrong
 * one is off by a number the assertions can see.
 */
function fixture(): WeightRoomData {
  return {
    imported_at: '2020-07-15T19:00:00Z',
    goals: [
      {
        exercise: 'pullups',
        daily_target: 50,
        color: '#0EA5A1',
        target_history: [
          { daily_target: 30, effective_from: '2020-01-01' },
          { daily_target: 50, effective_from: '2021-01-01' },
        ],
      },
    ],
    sets: [
      // 19:00Z is midday Pacific year-round, so this buckets to PAST_DAY in
      // the Pacific day-keying the app uses (#319) regardless of the runner.
      { id: 'set-1', logged_at: `${PAST_DAY}T19:00:00Z`, exercise: 'pullups', reps: 30 },
    ],
    monthly_focus: [],
  }
}

/** The rings' accessible label, which spells out "<exercise> <reps> of <target>". */
async function ringsLabel(): Promise<string> {
  const rings = await screen.findByTestId('activity-rings')
  return rings.querySelector('svg')?.getAttribute('aria-label') ?? ''
}

/**
 * Point the day picker at `day`.
 *
 * `fireEvent.change` rather than `user.type`: the picker is a controlled
 * `<input type="date">` whose handler ignores anything that isn't already a
 * complete `YYYY-MM-DD`, so character-by-character typing never yields a
 * value it accepts. A date input is set wholesale by real users too — the
 * native picker emits one change, not ten.
 */
async function selectDay(day: string): Promise<void> {
  const input = await screen.findByTestId('log-day-input')
  fireEvent.change(input, { target: { value: day } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  getWeightRoomDataMock.mockReset()
  getWeightRoomDataMock.mockResolvedValue(fixture())
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LogDataIsland — day scoping (#365 regression)', () => {
  it('scores a past day against the target that was live that day', async () => {
    render(<LogDataIsland />)
    await selectDay(PAST_DAY)

    // 30 reps against the 30 goal in force in 2020 — not 30 against today's
    // 50, which is what reading `goal.daily_target` directly produced.
    await waitFor(async () => {
      expect(await ringsLabel()).toContain('pullups 30 of 30')
    })
  })

  it('scores today against the current target', async () => {
    render(<LogDataIsland />)
    // No sets today, and the 2021 raise is the newest entry.
    await waitFor(async () => {
      expect(await ringsLabel()).toContain('pullups 0 of 50')
    })
  })

  it('shows the past day’s sets, not today’s', async () => {
    render(<LogDataIsland />)
    // Today has no sets at all.
    expect(await screen.findByTestId('set-list-empty')).toBeInTheDocument()

    await selectDay(PAST_DAY)
    expect(await screen.findByTestId('set-row-set-1')).toBeInTheDocument()
  })

  it('keeps streaks all-time when the viewed day changes', async () => {
    // Streaks span the whole log by design, so they must not follow the
    // picker — the one thing on this surface that is deliberately *not*
    // day-scoped.
    render(<LogDataIsland />)
    const before = (await screen.findByText(/longest/i)).closest('div')?.textContent

    await selectDay(PAST_DAY)
    await screen.findByTestId('set-row-set-1')

    const after = (await screen.findByText(/longest/i)).closest('div')?.textContent
    expect(after).toBe(before)
  })
})

describe('LogDataIsland — load states', () => {
  it('shows the loading state until the first fetch settles', async () => {
    let resolve: (v: WeightRoomData) => void = () => {}
    getWeightRoomDataMock.mockReturnValue(
      new Promise<WeightRoomData>((r) => {
        resolve = r
      }),
    )
    render(<LogDataIsland />)
    expect(screen.getByTestId('log-loading')).toBeInTheDocument()

    resolve(fixture())
    await screen.findByTestId('activity-rings')
  })

  it('distinguishes a fetch failure from genuinely empty tables', async () => {
    // The split matters: an empty database should invite the admin to log a
    // set, whereas a transient Supabase blip must not masquerade as "no data
    // yet" and imply the log is gone.
    getWeightRoomDataMock.mockRejectedValue(new Error('supabase exploded'))
    render(<LogDataIsland />)

    expect(await screen.findByText(/supabase exploded/i)).toBeInTheDocument()
  })

  it('renders the log surface with no error banner when the tables are empty', async () => {
    getWeightRoomDataMock.mockResolvedValue(null)
    render(<LogDataIsland />)

    // Empty is a legitimate steady state — no goals configured yet.
    expect(await screen.findByText(/add one in settings/i)).toBeInTheDocument()
    expect(screen.queryByText(/failed to load/i)).toBeNull()
  })
})

describe('LogDataIsland — write orchestration', () => {
  it('stamps a backdated log with the selected day, not now', async () => {
    const user = userEvent.setup()
    render(<LogDataIsland />)
    await selectDay(PAST_DAY)
    await screen.findByTestId('set-row-set-1')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/weight-room/sets')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.exercise).toBe('pullups')
    expect(body.reps).toBe(10)
    // Pacific midday of the picked day (#319), so the set buckets back onto
    // the square the admin was looking at rather than an adjacent one.
    expect(body.logged_at).toBe(`${PAST_DAY}T19:00:00.000Z`)
  })

  it('omits logged_at for a same-day log so the API keeps its now() default', async () => {
    const user = userEvent.setup()
    render(<LogDataIsland />)
    await screen.findByTestId('activity-rings')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.logged_at).toBeUndefined()
  })

  it('refetches after a successful log so the new set appears', async () => {
    const user = userEvent.setup()
    render(<LogDataIsland />)
    await screen.findByTestId('activity-rings')
    expect(getWeightRoomDataMock).toHaveBeenCalledTimes(1)

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    await waitFor(() => expect(getWeightRoomDataMock).toHaveBeenCalledTimes(2))
  })

  it('surfaces a failed write without wiping the loaded data', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'nope' }) })
    render(<LogDataIsland />)
    await screen.findByTestId('activity-rings')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    // The island keeps rendering; a write failure is not a data-loss event.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByTestId('activity-rings')).toBeInTheDocument()
  })
})

describe('LogDataIsland — stale response guard', () => {
  it('does not let a slow mount fetch clobber fresher post-write data', async () => {
    // The request-id guard exists for exactly this interleaving: a mount
    // fetch that resolves *after* a write-triggered refetch would otherwise
    // paint pre-write data over post-write data, and the admin would watch
    // their just-logged set vanish.
    const user = userEvent.setup()

    let resolveSlowMount: (v: WeightRoomData) => void = () => {}
    const slowMount = new Promise<WeightRoomData>((r) => {
      resolveSlowMount = r
    })

    // The set the refetch discovers, absent from the stale mount payload.
    const afterWrite = fixture()
    afterWrite.sets = [
      ...afterWrite.sets,
      { id: 'set-2', logged_at: `${PAST_DAY}T20:00:00Z`, exercise: 'pullups', reps: 10 },
    ]

    getWeightRoomDataMock.mockReturnValueOnce(slowMount)
    getWeightRoomDataMock.mockResolvedValue(afterWrite)

    render(<LogDataIsland />)
    expect(screen.getByTestId('log-loading')).toBeInTheDocument()

    // Resolve the mount fetch so the surface renders, then log — the write's
    // refetch takes a newer request id.
    resolveSlowMount(fixture())
    await selectDay(PAST_DAY)
    await screen.findByTestId('set-row-set-1')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))
    await waitFor(() => expect(getWeightRoomDataMock).toHaveBeenCalledTimes(2))

    // The refetched set is present and stays present.
    expect(await screen.findByTestId('set-row-set-2')).toBeInTheDocument()
  })
})
