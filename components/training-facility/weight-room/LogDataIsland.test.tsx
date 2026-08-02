import { StrictMode } from 'react'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
 *
 * `next/navigation` is mocked because the live panel navigates to the ended
 * session's summary (#377), and `useRouter` throws under jsdom without a
 * mounted app router — same treatment as `StrengthSettings.test.tsx`.
 */

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

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
  // Module-scoped and the config doesn't enable `clearMocks`, so without this a
  // navigation assertion could pass on a call from an earlier test.
  pushMock.mockReset()
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
      new Promise<WeightRoomData>(r => {
        resolve = r
      })
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

/**
 * The set POST, found by URL rather than by call index.
 *
 * The live workout panel (#376) probes `GET /workouts?open=true` on mount, so
 * `calls[0]` is no longer the write these assertions are about — and indexing
 * blind would silently start asserting against the wrong request the next time
 * anything else on the page fetches.
 */
function setPostCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      url === '/api/admin/weight-room/sets' && (init as RequestInit | undefined)?.method === 'POST'
  )
  if (!call) throw new Error('no POST to /api/admin/weight-room/sets was issued')
  return [call[0] as string, call[1] as RequestInit]
}

describe('LogDataIsland — write orchestration', () => {
  it('stamps a backdated log with the selected day, not now', async () => {
    const user = userEvent.setup()
    render(<LogDataIsland />)
    await selectDay(PAST_DAY)
    await screen.findByTestId('set-row-set-1')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = setPostCall()
    expect(url).toBe('/api/admin/weight-room/sets')
    const body = JSON.parse(init.body as string)
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
    const body = JSON.parse(setPostCall()[1].body as string)
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
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'set rejected by the API' }),
    })
    render(<LogDataIsland />)
    await screen.findByTestId('activity-rings')

    await user.click(await screen.findByTestId('quick-log-pullups-10'))

    // The API's own message has to reach the user — a write that fails
    // silently is worse than one that fails loudly, because the admin walks
    // away believing the set is logged.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/set rejected by the API/i)

    // ...and the loaded data survives: a failed write is not a data-loss event.
    expect(screen.getByTestId('activity-rings')).toBeInTheDocument()
  })
})

describe('LogDataIsland — stale response guard', () => {
  it('ignores a stale read that lands after a newer one', async () => {
    // The guard's real interleaving is React's double-invoked mount effect:
    // effect runs (id 1), cleanup bumps to 2, effect runs again (id 3). Two
    // reads are genuinely in flight, and the first is already stale by the
    // time it resolves. Without the guard its late response paints over the
    // current one.
    //
    // Reaching this through the UI isn't possible — the surface only renders
    // once a read has resolved, and `busy` disables the log buttons while a
    // write is in flight, so two overlapping refetches can't be triggered by
    // clicking. StrictMode is where this actually happens.
    let resolveStale: (v: WeightRoomData) => void = () => {}
    const stalePending = new Promise<WeightRoomData>(r => {
      resolveStale = r
    })

    // What the *current* read returns: the fixture plus a second set.
    const fresh = fixture()
    fresh.sets = [
      ...fresh.sets,
      { id: 'set-2', logged_at: `${PAST_DAY}T20:00:00Z`, exercise: 'pullups', reps: 10 },
    ]

    getWeightRoomDataMock.mockReturnValueOnce(stalePending) // first (abandoned) mount
    getWeightRoomDataMock.mockResolvedValue(fresh) // the mount that counts

    render(
      <StrictMode>
        <LogDataIsland />
      </StrictMode>
    )

    await selectDay(PAST_DAY)
    // The current read won: both sets are on screen.
    expect(await screen.findByTestId('set-row-set-2')).toBeInTheDocument()

    // Now the abandoned read finally lands, carrying data without set-2.
    //
    // Flushed inside `act` rather than asserted behind `waitFor`: waitFor
    // succeeds on its first check, so it would return *before* the stale
    // response was ever processed and the test would pass no matter what the
    // component did with it. Draining the microtask queue here means the
    // stale `setData` has definitely run by the time we assert.
    await act(async () => {
      resolveStale(fixture())
      await Promise.resolve()
      await Promise.resolve()
    })

    // It must have been discarded. Without the request-id check, set-2
    // disappears and the admin watches a set they just logged vanish.
    expect(screen.getByTestId('set-row-set-2')).toBeInTheDocument()
    expect(screen.getByTestId('set-row-set-1')).toBeInTheDocument()
  })
})
