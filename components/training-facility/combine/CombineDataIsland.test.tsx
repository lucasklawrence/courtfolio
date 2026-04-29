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
const updateBenchmarkMock = vi.fn()
const deleteBenchmarkMock = vi.fn()

vi.mock('@/lib/data/movement', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/movement')>(
    '@/lib/data/movement',
  )
  return {
    ...actual,
    getMovementBenchmarks: (...args: unknown[]) => getMovementBenchmarksMock(...args),
    logBenchmark: (...args: unknown[]) => logBenchmarkMock(...args),
    updateBenchmark: (...args: unknown[]) => updateBenchmarkMock(...args),
    deleteBenchmark: (...args: unknown[]) => deleteBenchmarkMock(...args),
  }
})

beforeEach(() => {
  getMovementBenchmarksMock.mockReset()
  logBenchmarkMock.mockReset()
  updateBenchmarkMock.mockReset()
  deleteBenchmarkMock.mockReset()
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
    expect(getMovementBenchmarksMock).toHaveBeenCalledWith()
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

  it('renders the history table once entries fetch resolves', async () => {
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    render(<CombineDataIsland />)
    await waitFor(() =>
      expect(screen.getByText(/benchmark history/i)).toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByText('2026-04-15')).toBeInTheDocument())
  })

  it('clicking Edit on a row puts the entry form into edit mode (prefilled, locked date)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /edit benchmark from 2026-04-15/i }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', { name: /edit benchmark from 2026-04-15/i }),
    )

    expect(screen.getByText(/edit session for 2026-04-15/i)).toBeInTheDocument()
    const dateInput = screen.getByLabelText(/^date/i) as HTMLInputElement
    expect(dateInput.value).toBe('2026-04-15')
    expect(dateInput.readOnly).toBe(true)
    expect((screen.getByLabelText(/bodyweight/i) as HTMLInputElement).value).toBe(
      '232',
    )
  })

  it('Delete with confirmation calls deleteBenchmark and refetches', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    deleteBenchmarkMock.mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /delete benchmark from 2026-04-15/i }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', { name: /delete benchmark from 2026-04-15/i }),
    )

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/delete benchmark from 2026-04-15.*cannot be undone/i),
    )
    await waitFor(() => expect(deleteBenchmarkMock).toHaveBeenCalledWith('2026-04-15'))
    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(2))
    expect(getMovementBenchmarksMock.mock.calls[1][0]).toEqual({ cache: 'no-store' })
    confirmSpy.mockRestore()
  })

  it('Delete cancelled in confirm() short-circuits — no API call, no refetch', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /delete benchmark from 2026-04-15/i }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', { name: /delete benchmark from 2026-04-15/i }),
    )

    expect(deleteBenchmarkMock).not.toHaveBeenCalled()
    expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('Mark-incomplete on a complete row sends is_complete: false', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232, is_complete: false },
    ])
    updateBenchmarkMock.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /mark benchmark from 2026-04-15 as incomplete/i,
        }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', {
        name: /mark benchmark from 2026-04-15 as incomplete/i,
      }),
    )

    await waitFor(() =>
      expect(updateBenchmarkMock).toHaveBeenCalledWith('2026-04-15', {
        is_complete: false,
      }),
    )
    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(2))
  })

  it('Mark-complete on an incomplete row sends is_complete: true', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232, is_complete: false },
    ])
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    updateBenchmarkMock.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /mark benchmark from 2026-04-15 as complete/i,
        }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', {
        name: /mark benchmark from 2026-04-15 as complete/i,
      }),
    )

    await waitFor(() =>
      expect(updateBenchmarkMock).toHaveBeenCalledWith('2026-04-15', {
        is_complete: true,
      }),
    )
  })

  it('does NOT let a stale mount-time fetch overwrite fresher post-save data (Codex P2 race)', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    // Mount-time fetch resolves AFTER the post-save fetch — the slow
    // first-loader race the request-id ref pattern guards against.
    let resolveMount: (data: unknown) => void = () => {}
    const mountPromise = new Promise((resolve) => {
      resolveMount = resolve
    })
    getMovementBenchmarksMock.mockReturnValueOnce(mountPromise)
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-20', bodyweight_lbs: 230 },
    ])
    logBenchmarkMock.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    render(<CombineDataIsland />)

    // Mount fetch is in-flight (unresolved promise). Save now.
    await user.click(screen.getByRole('button', { name: /log a session/i }))
    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-20')
    await user.type(screen.getByLabelText(/bodyweight/i), '230')
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    // Post-save fetch completes first → Scoreboard reflects 230.
    await waitFor(() =>
      expect(screen.getByLabelText(/230\.0 lbs/i)).toBeInTheDocument(),
    )

    // Now resolve the stale mount-time fetch with stale data. The
    // request-id guard should drop it.
    resolveMount([{ date: '2026-04-15', bodyweight_lbs: 999 }])
    await new Promise((r) => setTimeout(r, 20))

    // Scoreboard still shows the post-save value, NOT the stale 999.
    expect(screen.getByLabelText(/230\.0 lbs/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/999/i)).not.toBeInTheDocument()
  })
})
