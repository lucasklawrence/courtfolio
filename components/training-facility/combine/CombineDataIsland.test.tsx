import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CombineDataIsland } from './CombineDataIsland'

/**
 * Tests for the Combine page's client island. Verifies that the
 * Scoreboard renders against fetched entries and that saving via the
 * admin-only entry form triggers a refetch (the contract the form's
 * `onSaved` callback fulfils so a freshly-logged entry lands in the
 * Scoreboard with no manual reload).
 *
 * `getMovementBenchmarks` and `logBenchmark` are stubbed at the data
 * layer; `useAdminSession` is stubbed to control whether row-level
 * actions and the entry form panel render.
 */

interface MockAdminSession {
  isAdmin: boolean
  isLoading: boolean
  email: string | null
}
const adminSessionMock = vi.fn<() => MockAdminSession>(() => ({
  isAdmin: true,
  isLoading: false,
  email: 'admin@example.com',
}))
vi.mock('@/lib/auth/use-admin-session', () => ({
  useAdminSession: () => adminSessionMock(),
}))

/**
 * Mock for `next/navigation` so `useSearchParams()` (added for the
 * `?preview=demo` empty-state affordance, #160) returns a controllable
 * value and `useRouter().replace` is observable. Tests that don't care
 * about preview mode get an empty `URLSearchParams` by default.
 */
const searchParamsMock = vi.fn<() => URLSearchParams>(() => new URLSearchParams())
const routerReplaceMock = vi.fn<(href: string) => void>()
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn(), prefetch: vi.fn() }),
}))

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
  adminSessionMock.mockReset()
  adminSessionMock.mockReturnValue({
    isAdmin: true,
    isLoading: false,
    email: 'admin@example.com',
  })
  searchParamsMock.mockReset()
  searchParamsMock.mockReturnValue(new URLSearchParams())
  routerReplaceMock.mockReset()
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
  })

  it('falls back to an empty Scoreboard when the fetch rejects (transient failure)', async () => {
    getMovementBenchmarksMock.mockRejectedValueOnce(new Error('network down'))
    render(<CombineDataIsland />)
    await waitFor(() =>
      expect(screen.getByRole('group', { name: /combine scoreboard/i })).toBeInTheDocument(),
    )
  })

  it('refetches after the form saves a new entry', async () => {
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-20', bodyweight_lbs: 230 },
    ])
    logBenchmarkMock.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    render(<CombineDataIsland />)

    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: /log a session/i }))
    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-20')
    await user.type(screen.getByLabelText(/bodyweight/i), '230')
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(2))
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

  it('hides row-level admin actions and the entry form for non-admin viewers', async () => {
    adminSessionMock.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      email: null,
    })
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', bodyweight_lbs: 232 },
    ])
    render(<CombineDataIsland />)
    await waitFor(() => expect(screen.getByText('2026-04-15')).toBeInTheDocument())

    expect(
      screen.queryByRole('button', { name: /log a session/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /edit benchmark from 2026-04-15/i }),
    ).not.toBeInTheDocument()
  })

  it('clicking Edit on a row puts the entry form into edit mode (prefilled, locked date)', async () => {
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
    confirmSpy.mockRestore()
  })

  it('Delete cancelled in confirm() short-circuits — no API call, no refetch', async () => {
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

    await user.click(screen.getByRole('button', { name: /log a session/i }))
    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-20')
    await user.type(screen.getByLabelText(/bodyweight/i), '230')
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/230\.0 lbs/i)).toBeInTheDocument(),
    )

    resolveMount([{ date: '2026-04-15', bodyweight_lbs: 999 }])
    await new Promise((r) => setTimeout(r, 20))

    expect(screen.getByLabelText(/230\.0 lbs/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/999/i)).not.toBeInTheDocument()
  })

  /**
   * Empty-state preview (#160). The data island renders one of three
   * branches once the real fetch settles: empty + no param (CTA),
   * empty + `?preview=demo` (badge + fixture), or non-empty (real data
   * always wins, regardless of param).
   */
  describe('empty-state preview affordance (#160)', () => {
    it('shows the "Preview with sample data" CTA when real fetch is empty and no preview param', async () => {
      getMovementBenchmarksMock.mockResolvedValueOnce([])
      render(<CombineDataIsland />)

      await waitFor(() =>
        expect(
          screen.getByRole('link', { name: /preview with sample data/i }),
        ).toBeInTheDocument(),
      )
      // Badge must NOT render in this branch — only the CTA.
      expect(screen.queryByText(/preview — sample data/i)).not.toBeInTheDocument()
      // The empty-state Scoreboard should still render below the CTA.
      expect(
        screen.getByRole('group', { name: /combine scoreboard summary/i }),
      ).toBeInTheDocument()
    })

    it('shows the demo fixture and badge when preview=demo and the real fetch is empty', async () => {
      getMovementBenchmarksMock.mockResolvedValueOnce([])
      searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
      render(<CombineDataIsland />)

      // Wait for the fetch to resolve so the island commits to the
      // empty branch (preview is empty-state-only — preview mode is
      // never decided before the real fetch settles).
      await waitFor(() => expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1))
      await waitFor(() =>
        expect(screen.getByText(/preview — sample data/i)).toBeInTheDocument(),
      )

      // History table should reflect a fixture row (`2026-05-01` is the
      // last entry in `COMBINE_DEMO_BENCHMARKS`).
      expect(await screen.findByText('2026-05-01')).toBeInTheDocument()
      // CTA must NOT render once we're in preview mode.
      expect(
        screen.queryByRole('link', { name: /preview with sample data/i }),
      ).not.toBeInTheDocument()
    })

    it('ignores preview=demo when real entries exist (real data wins)', async () => {
      getMovementBenchmarksMock.mockResolvedValueOnce([
        { date: '2026-04-15', bodyweight_lbs: 232 },
      ])
      searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
      render(<CombineDataIsland />)

      await waitFor(() =>
        expect(screen.getByText('2026-04-15')).toBeInTheDocument(),
      )
      // Neither preview surface should render — real data fully owns
      // the page once it lands.
      expect(screen.queryByText(/preview — sample data/i)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /preview with sample data/i }),
      ).not.toBeInTheDocument()
      // The fixture's last-row date should NOT appear because the
      // demo set is never consulted in this branch.
      expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument()
    })

    it('"Exit preview" button on the badge strips the param via router.replace', async () => {
      getMovementBenchmarksMock.mockResolvedValueOnce([])
      searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
      const user = userEvent.setup()
      render(<CombineDataIsland />)

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /exit preview/i }),
        ).toBeInTheDocument(),
      )
      await user.click(screen.getByRole('button', { name: /exit preview/i }))

      expect(routerReplaceMock).toHaveBeenCalledWith('/training-facility/combine')
    })

    it('hides admin row actions while in preview mode (fixture is read-only)', async () => {
      // Even an admin should not see edit/delete/mark-incomplete on
      // demo rows — they don't exist in Supabase, so a write would
      // fail with a confusing error. The island gates `showActions`
      // off when `isPreviewMode` is true.
      adminSessionMock.mockReturnValue({
        isAdmin: true,
        isLoading: false,
        email: 'admin@example.com',
      })
      getMovementBenchmarksMock.mockResolvedValueOnce([])
      searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
      render(<CombineDataIsland />)

      await waitFor(() =>
        expect(screen.getByText(/preview — sample data/i)).toBeInTheDocument(),
      )
      expect(
        screen.queryByRole('button', { name: /edit benchmark from 2026-05-01/i }),
      ).not.toBeInTheDocument()
    })
  })
})
