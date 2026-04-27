import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CombineDataIsland } from './CombineDataIsland'

/**
 * Tests for the Combine page's client island. Verifies that the
 * Scoreboard renders against fetched entries and that saving via the
 * dev-only entry form triggers a cache-busting refetch (the contract
 * the form's `onSaved` callback fulfils so a freshly-logged entry
 * lands in the Scoreboard with no manual reload).
 *
 * `getMovementBenchmarks` and `logBenchmark` are both stubbed at the
 * data-layer module — the wrappers and the dev API route have their
 * own tests; this file is about the wiring between Scoreboard and
 * form.
 */

const getMovementBenchmarksMock = vi.fn()
const logBenchmarkMock = vi.fn()

vi.mock('@/lib/data/movement', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/movement')>(
    '@/lib/data/movement',
  )
  return {
    ...actual,
    getMovementBenchmarks: (...args: unknown[]) => getMovementBenchmarksMock(...args),
    logBenchmark: (...args: unknown[]) => logBenchmarkMock(...args),
  }
})

beforeEach(() => {
  getMovementBenchmarksMock.mockReset()
  logBenchmarkMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CombineDataIsland', () => {
  it('fetches entries on mount and renders the Scoreboard region', async () => {
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    render(<CombineDataIsland />)
    await waitFor(() =>
      expect(
        screen.getByRole('group', { name: /combine scoreboard summary/i }),
      ).toBeInTheDocument(),
    )
    expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1)
    // First mount fetch should NOT bypass the cache — that's reserved
    // for the post-write refetch.
    expect(getMovementBenchmarksMock).toHaveBeenCalledWith(undefined)
  })

  it('falls back to an empty Scoreboard when the fetch rejects (transient failure)', async () => {
    getMovementBenchmarksMock.mockRejectedValueOnce(new Error('network down'))
    render(<CombineDataIsland />)
    await waitFor(() =>
      expect(screen.getByRole('group', { name: /combine scoreboard/i })).toBeInTheDocument(),
    )
  })

  it('refetches with cache: "no-store" after the form saves a new entry', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-20', bodyweight_lbs: 230 },
    ])
    logBenchmarkMock.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    render(<CombineDataIsland />)

    // Wait for the initial fetch to complete.
    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: /log a session/i }))
    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-20')
    await user.type(screen.getByLabelText(/bodyweight/i), '230')
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(2))
    expect(getMovementBenchmarksMock.mock.calls[1][0]).toEqual({ cache: 'no-store' })
  })
})
